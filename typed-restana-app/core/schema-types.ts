import { z } from 'zod';
import * as restana from 'restana';

/**
 * Type-safe route schema configuration using Zod schemas
 */
export interface TypedAppConfig {
  strict?: boolean;
  validateResponses?: boolean;
  logValidationErrors?: boolean;
}

export interface TypedRouteSchema<TQuery = any, TParams = any, TBody = any> {
  query?: z.ZodSchema<TQuery>;
  params?: z.ZodSchema<TParams>;
  body?: z.ZodSchema<TBody>;
  responses?: {
    [statusCode: number]: {
      schema?: z.ZodSchema<any>;
      description?: string;
    };
  };
}

/**
 * Type-safe route handler with enforced schema-type relationship
 */
export interface TypeSafeRouteHandler<TQuery = any, TParams = any, TBody = any, TResponse = any> {
  (context: {
    query: TQuery;
    params: TParams;
    body: TBody;
    req: any;
    res: any;
  }): Promise<TResponse> | TResponse;
}

/**
 * Type-safe route configuration that enforces schema-type relationships
 */
export interface TypeSafeRouteConfig<TQuery = any, TParams = any, TBody = any, TResponse = any> {
  schema?: TypedRouteSchema<TQuery, TParams, TBody>;
  metadata?: {
    summary?: string;
    description?: string;
    tags?: string[];
    operationId?: string;
    deprecated?: boolean;
  };
  /** Per-route strictness override - rejects extra fields when enabled */
  strict?: boolean;
  /** Per-route response validation override - validates response against schema */
  validateResponse?: boolean;
  handler: TypeSafeRouteHandler<TQuery, TParams, TBody, TResponse>;
}

/**
 * Enhanced TypedApp interface - provides type-safe routes + full Restana compatibility
 */
export interface TypeSafeApp {
  // Type-safe HTTP methods that return TypeSafeApp for chaining
  get<TQuery = never, TParams = never, TResponse = any>(
    path: string | string[],
    config: TypeSafeRouteConfig<TQuery, TParams, never, TResponse>
  ): TypeSafeApp;

  post<TQuery = never, TParams = never, TBody = never, TResponse = any>(
    path: string | string[],
    config: TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
  ): TypeSafeApp;

  put<TQuery = never, TParams = never, TBody = never, TResponse = any>(
    path: string | string[],
    config: TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
  ): TypeSafeApp;

  patch<TQuery = never, TParams = never, TBody = never, TResponse = any>(
    path: string | string[],
    config: TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
  ): TypeSafeApp;

  delete<TQuery = never, TParams = never, TResponse = any>(
    path: string | string[],
    config: TypeSafeRouteConfig<TQuery, TParams, never, TResponse>
  ): TypeSafeApp;

  head<TQuery = never, TParams = never, TResponse = any>(
    path: string | string[],
    config: TypeSafeRouteConfig<TQuery, TParams, never, TResponse>
  ): TypeSafeApp;

  options<TQuery = never, TParams = never, TResponse = any>(
    path: string | string[],
    config: TypeSafeRouteConfig<TQuery, TParams, never, TResponse>
  ): TypeSafeApp;

  trace<TQuery = never, TParams = never, TResponse = any>(
    path: string | string[],
    config: TypeSafeRouteConfig<TQuery, TParams, never, TResponse>
  ): TypeSafeApp;

  all<TQuery = never, TParams = never, TBody = never, TResponse = any>(
    path: string | string[],
    config: TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
  ): TypeSafeApp;

  // Restana Service Methods - Direct proxy for full compatibility
  use(middleware: restana.RequestHandler<restana.Protocol.HTTP>): TypeSafeApp;
  use(prefix: string, middleware: restana.RequestHandler<restana.Protocol.HTTP>): TypeSafeApp;
  use(prefix: string, router: restana.Router<restana.Protocol.HTTP>): TypeSafeApp;
  
  routes(): string[];
  getRouter(): restana.Router<restana.Protocol.HTTP>;
  newRouter(): restana.Router<restana.Protocol.HTTP>;
  errorHandler: restana.ErrorHandler<restana.Protocol.HTTP>;
  getServer(): restana.Server<restana.Protocol.HTTP>;
  getConfigOptions(): restana.Options<restana.Protocol.HTTP>;
  handle(req: restana.Request<restana.Protocol.HTTP>, res: restana.Response<restana.Protocol.HTTP>): void;
  start(port?: number, host?: string): Promise<restana.Server<restana.Protocol.HTTP>>;
  close(): Promise<void>;

  // Custom method for getting typed routes information
  getRoutes(): Array<{
    method: string;
    path: string;
    schema?: any;
    metadata?: any;
  }>;
}