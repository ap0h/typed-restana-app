import { z } from 'zod';
import { Protocol, Service, Request, Response } from 'restana';

import { TypeSafeApp, TypeSafeRouteConfig } from './schema-types';

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
export function createTypedApp(restanaApp: Service<Protocol.HTTP>): TypedApp {
  const routes: Array<{
    method: string;
    path: string;
    schema?: any;
    metadata?: any;
  }> = [];

  /**
   * Validate data against a Zod schema
   */
  function validateData(data: any, schema: z.ZodSchema<any>, context: string) {
    const result = schema.safeParse(data);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        value: data
      }));

      throw new ValidationError(`Validation failed for ${context}`, details);
    }

    return result.data;
  }

  /**
   * Create a route handler that validates input and calls the typed handler
   * Supports both legacy RouteConfig and new TypeSafeRouteConfig
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
        // Validate query parameters
        const query = config.schema?.query
          ? validateData(req.query || {}, config.schema.query, 'query')
          : ((req.query || {}) as TQuery);

        // Validate path parameters
        const params = config.schema?.params
          ? validateData(req.params || {}, config.schema.params, 'params')
          : ((req.params || {}) as TParams);

        // Validate request body
        const body = config.schema?.body
          ? validateData(req.body || {}, config.schema.body, 'body')
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
        if (result !== undefined && !res.headersSent) {
          return res.send(result, 200, {
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
          res.send(
            JSON.stringify({
              error: 'Validation Error',
              message: error.message,
              details: error.details
            }),
            400,
            { 'Content-Type': 'application/json' }
          );
        } else {
          // Send a generic error response
          res.send(
            JSON.stringify({
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : 'An unexpected error occurred'
            }),
            500,
            { 'Content-Type': 'application/json' }
          );
        }
      }
    };
  }

  /**
   * Register a route with the given method
   * Supports both legacy and type-safe configurations
   */
  function registerRoute<TQuery, TParams, TBody, TResponse>(
    method: string,
    path: string,
    config:
      | RouteConfig<TQuery, TParams, TBody, TResponse>
      | TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
  ) {
    // Store route information for documentation
    routes.push({
      method: method.toUpperCase(),
      path,
      schema: config.schema,
      metadata: config.metadata
    });

    // Register the route with Restana
    const handler = createValidatedHandler(config);
    (restanaApp as any)[method](path, handler);
  }

  return {
    // TypeSafeApp implementation with enhanced type safety
    get: <TQuery = never, TParams = never, TResponse = any>(
      path: string,
      config: TypeSafeRouteConfig<TQuery, TParams, never, TResponse>
    ) => registerRoute('get', path, config as any),

    post: <TQuery = never, TParams = never, TBody = never, TResponse = any>(
      path: string,
      config: TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
    ) => registerRoute('post', path, config as any),

    put: <TQuery = never, TParams = never, TBody = never, TResponse = any>(
      path: string,
      config: TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
    ) => registerRoute('put', path, config as any),

    patch: <TQuery = never, TParams = never, TBody = never, TResponse = any>(
      path: string,
      config: TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
    ) => registerRoute('patch', path, config as any),

    delete: <TQuery = never, TParams = never, TResponse = any>(
      path: string,
      config: TypeSafeRouteConfig<TQuery, TParams, never, TResponse>
    ) => registerRoute('delete', path, config as any),

    getRoutes: () => routes
  };
}
