import { z } from 'zod';


/**
 * Type-safe route schema configuration using Zod schemas
 */
export interface TypedRouteSchema<TQuery = any, TParams = any, TBody = any> {
  query?: z.ZodSchema<TQuery>;
  params?: z.ZodSchema<TParams>;
  body?: z.ZodSchema<TBody>;
  responses?: {
    [statusCode: number]: {
      schema: z.ZodSchema<any>;
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
  handler: TypeSafeRouteHandler<TQuery, TParams, TBody, TResponse>;
}

/**
 * Enhanced TypedApp interface with stronger type safety
 */
export interface TypeSafeApp {
  get<TQuery = never, TParams = never, TResponse = any>(
    path: string,
    config: TypeSafeRouteConfig<TQuery, TParams, never, TResponse>
  ): void;

  post<TQuery = never, TParams = never, TBody = never, TResponse = any>(
    path: string,
    config: TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
  ): void;

  put<TQuery = never, TParams = never, TBody = never, TResponse = any>(
    path: string,
    config: TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
  ): void;

  patch<TQuery = never, TParams = never, TBody = never, TResponse = any>(
    path: string,
    config: TypeSafeRouteConfig<TQuery, TParams, TBody, TResponse>
  ): void;

  delete<TQuery = never, TParams = never, TResponse = any>(
    path: string,
    config: TypeSafeRouteConfig<TQuery, TParams, never, TResponse>
  ): void;

  // Get registered routes for documentation generation
  getRoutes(): Array<{
    method: string;
    path: string;
    schema?: any;
    metadata?: any;
  }>;
}
