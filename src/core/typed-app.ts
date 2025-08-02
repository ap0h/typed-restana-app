import { z } from 'zod';
import { $ZodIssue } from '@zod/core';
import { Protocol, Service, Request, Response, RequestHandler } from 'restana';

import { TypeSafeApp, TypeSafeRouteConfig } from './schema-types';

/**
 * Configuration options for the typed app
 */
export interface TypedAppConfig {
  /** Enable strict validation (rejects extra fields) */
  strict?: boolean;
  /** Validate response schemas against expected types */
  validateResponses?: boolean;
  /** Log validation errors to console */
  logValidationErrors?: boolean;
}

/**
 * Legacy interfaces for backward compatibility
 */
export interface RouteSchema {
  query?: z.ZodSchema<any>;
  params?: z.ZodSchema<any>;
  body?: z.ZodSchema<any>;
  responses?: {
    [statusCode: number]: {
      schema: z.ZodSchema<any>;
      description?: string;
    };
  };
}

export interface RouteMetadata {
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  deprecated?: boolean;
}

export interface RouteConfig<TQuery = any, TParams = any, TBody = any, TResponse = any> {
  schema?: RouteSchema;
  metadata?: RouteMetadata;
  /** Per-route strictness override */
  strict?: boolean;
  /** Per-route response validation override */
  validateResponse?: boolean;
  /** Optional Restana middlewares to be executed before validation */
  middlewares?: RequestHandler<Protocol.HTTP>[];
  handler: (context: {
    query: TQuery;
    params: TParams;
    body: TBody;
    req: Request<Protocol.HTTP>;
    res: Response<Protocol.HTTP>;
  }) => Promise<TResponse> | TResponse;
}

// Re-export for compatibility
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TypedApp extends TypeSafeApp {}

/**
 * Validation error class
 */
export class ValidationError extends Error {
  public readonly statusCode = 400;
  public readonly details: any[];

  constructor(message: string, details: any[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * Create a typed app wrapper around Restana service with enhanced type safety
 */
export function createTypedApp(
  restanaApp: Service<Protocol.HTTP>, 
  config: TypedAppConfig = {}
): TypedApp {
  // Default configuration with environment-based defaults
  const appConfig: Required<TypedAppConfig> = {
    strict: config.strict ?? process.env.NODE_ENV === 'development',
    validateResponses: config.validateResponses ?? process.env.NODE_ENV === 'development',
    logValidationErrors: config.logValidationErrors ?? true,
    ...config
  };

  const routes: Array<{
    method: string;
    path: string;
    schema?: any;
    metadata?: any;
  }> = [];

  /**
   * Validate data against a Zod schema with optional strictness
   */
  function validateData(
    data: any, 
    schema: z.ZodSchema<any>, 
    context: string, 
    strict?: boolean
  ) {
    // Apply strictness if specified or use global setting
    const shouldBeStrict = strict ?? appConfig.strict;
    const validationSchema = shouldBeStrict && 'strict' in schema 
      ? (schema as any).strict() 
      : (schema as any).passthrough()
  
    const result = validationSchema.safeParse(data);

    if (!result.success) {
      const details = result.error.issues.map((issue: $ZodIssue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        value: data
      }));

      if (appConfig.logValidationErrors) {
        console.warn(`🚨 Validation failed for ${context}:`, {
          data,
          errors: details,
          strict: shouldBeStrict
        });
      }

      throw new ValidationError(`Validation failed for ${context}`, details);
    }

    return result.data;
  }

  /**
   * Validate response data against response schema
   */
  function validateResponse(
    data: any, 
    schema: z.ZodSchema<any>, 
    statusCode: number,
    strict?: boolean
  ) {
    try {
      return validateData(data, schema, `response (${statusCode})`, strict);
    } catch (error) {
      if (appConfig.logValidationErrors) {
        console.error(`🚨 Response validation failed for status ${statusCode}:`, {
          data,
          error: error instanceof Error ? error.message : error
        });
      }
      // In development, you might want to throw, in production just log
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
      return data; // Return original data in production
    }
  }

  /**
   * Create a route handler that validates input and calls the typed handler
   */
  function createValidatedHandler<TQuery, TParams, TBody, TResponse>(
    config:
      | RouteConfig<TQuery, TParams, TBody, TResponse>
      | TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
  ) {
    return async (
      req: Request<Protocol.HTTP>,
      res: Response<Protocol.HTTP>,
      next: (e?: unknown) => void
    ) => {
      try {
        const routeStrict = 'strict' in config ? config.strict : undefined;
        const routeValidateResponse = 'validateResponse' in config 
          ? config.validateResponse 
          : appConfig.validateResponses;

        // Validate query parameters
        const query = config.schema?.query
          ? validateData(req.query || {}, config.schema.query, 'query', routeStrict)
          : ((req.query || {}) as TQuery);

        // Validate path parameters  
        const params = config.schema?.params
          ? validateData(req.params || {}, config.schema.params, 'params', routeStrict)
          : ((req.params || {}) as TParams);

        // Validate request body
        const body = config.schema?.body
          ? validateData(req.body || {}, config.schema.body, 'body', routeStrict)
          : ((req.body || {}) as TBody);

        // Call the typed handler with validated data
        const result = await config.handler({
          query,
          params,
          body,
          req,
          res
        });

        // Send the response only if headers haven't been sent yet
        if (!res.headersSent) {
          let responseData = result;

          // Handle undefined result
          if (result === undefined) {
            responseData = {} as any;
          }

          // Validate response if enabled
          if (routeValidateResponse && config.schema?.responses) {
            const responseSchema = config.schema.responses[200]?.schema;
            if (responseSchema) {
              responseData = validateResponse(responseData, responseSchema, 200, routeStrict);
            }
          }

          // Use the status code set by the handler, or default to 200
          const statusCode = res.statusCode || 200;
          return res.send(responseData, statusCode, {
            'Content-Type': 'application/json'
          });
        }
      } catch (error) {
        // Check if response has already been sent
        if (res.headersSent) {
          console.error('Headers already sent, cannot send error response:', error);
          return;
        }

        if (error instanceof ValidationError) {
          // Check if this is a response validation error
          if (error.message.includes('response (')) {
            res.send(
              {
                error: 'Response validation failed',
                message: error.message,
                details: error.details
              },
              500,
              { 'Content-Type': 'application/json' }
            );
          } else {
            res.send(
              {
                error: 'Validation failed',
                message: error.message,
                details: error.details
              },
              400,
              { 'Content-Type': 'application/json' }
            );
          }
        } else {
          // Send a generic error response
          if (!res.headersSent) {
            try {
              res.send(
                {
                  error: 'Internal Server Error',
                  message: error instanceof Error ? error.message : 'An unexpected error occurred'
                },
                500,
                { 'Content-Type': 'application/json' }
              );
            } catch (sendError) {
              console.error('Failed to send error response:', sendError);
              // Fallback: try to end the response manually
              if (res.statusCode === undefined) res.statusCode = 500;
              if (!res.headersSent) {
                res.setHeader('Content-Type', 'application/json');
                res.end({
                  error: 'Internal Server Error',
                  message: error instanceof Error ? error.message : 'An unexpected error occurred'
                });
              }
            }
          }
        }
      }
    };
  }

  /**
   * Register a route with the given method
   */
  function registerRoute<TQuery, TParams, TBody, TResponse>(
    method: string,
    path: string | string[],
    config:
      | RouteConfig<TQuery, TParams, TBody, TResponse>
      | TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
  ) {
    // Store route information for documentation (use first path if array)
    const pathForDoc = Array.isArray(path) ? path[0] : path;
    routes.push({
      method: method.toUpperCase(),
      path: pathForDoc,
      schema: config.schema,
      metadata: config.metadata
    });

    // Register the route with Restana
    const handler = createValidatedHandler(config);
    const middlewares = config.middlewares ?? [];
    (restanaApp as any)[method](path, ...middlewares, handler);
  }

  // Create the typed app object
  const typedApp: TypeSafeApp = {
    // HTTP Methods with type safety
    get: <TQuery = never, TParams = never, TResponse = any>(
      path: string | string[],
      config: TypeSafeRouteConfig<TQuery, TParams, never, TResponse>
    ) => { registerRoute('get', path, config as any); return typedApp; },

    post: <TQuery = never, TParams = never, TBody = never, TResponse = any>(
      path: string | string[],
      config: TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
    ) => { registerRoute('post', path, config as any); return typedApp; },

    put: <TQuery = never, TParams = never, TBody = never, TResponse = any>(
      path: string | string[],
      config: TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
    ) => { registerRoute('put', path, config as any); return typedApp; },

    patch: <TQuery = never, TParams = never, TBody = never, TResponse = any>(
      path: string | string[],
      config: TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
    ) => { registerRoute('patch', path, config as any); return typedApp; },

    delete: <TQuery = never, TParams = never, TResponse = any>(
      path: string | string[],
      config: TypeSafeRouteConfig<TQuery, TParams, never, TResponse>
    ) => { registerRoute('delete', path, config as any); return typedApp; },

    head: <TQuery = never, TParams = never, TResponse = any>(
      path: string | string[],
      config: TypeSafeRouteConfig<TQuery, TParams, never, TResponse>
    ) => { registerRoute('head', path, config as any); return typedApp; },

    options: <TQuery = never, TParams = never, TResponse = any>(
      path: string | string[],
      config: TypeSafeRouteConfig<TQuery, TParams, never, TResponse>
    ) => { registerRoute('options', path, config as any); return typedApp; },

    trace: <TQuery = never, TParams = never, TResponse = any>(
      path: string | string[],
      config: TypeSafeRouteConfig<TQuery, TParams, never, TResponse>
    ) => { registerRoute('trace', path, config as any); return typedApp; },

    all: <TQuery = never, TParams = never, TBody = never, TResponse = any>(
      path: string | string[],
      config: TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
    ) => { registerRoute('all', path, config as any); return typedApp; },

    // Restana Service Methods - Direct proxy to underlying Restana instance with proper types
    use: ((prefixOrMiddleware: any, middleware?: any) => {
      if (typeof prefixOrMiddleware === 'string') {
        restanaApp.use(prefixOrMiddleware, middleware);
      } else {
        restanaApp.use(prefixOrMiddleware);
      }
      return typedApp;
    }) as TypeSafeApp['use'],

    routes: () => restanaApp.routes(),
    getRouter: () => restanaApp.getRouter(),
    newRouter: () => restanaApp.newRouter(),
    get errorHandler() { return restanaApp.errorHandler; },
    set errorHandler(handler) { restanaApp.errorHandler = handler; },
    getServer: () => restanaApp.getServer(),
    getConfigOptions: () => restanaApp.getConfigOptions(),
    handle: (req, res) => restanaApp.handle(req, res),
    start: (port?: number, host?: string) => restanaApp.start(port, host),
    close: () => restanaApp.close(),

    getRoutes: () => routes
  };
  
  return typedApp;
}