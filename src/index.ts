/**
 * Type-Safe Restana App with Zod Validation
 * 
 * Main export file for the typed-restana-app package.
 * Provides type-safe API development with Zod validation and OpenAPI generation.
 */

// Core type system and app creation
export { createTypedApp } from './core/typed-app';
export { 
  TypedRouteSchema,
  TypeSafeRouteHandler,
  TypeSafeRouteConfig,
  TypeSafeApp
} from './core/schema-types';

// Configuration and validation exports
export {
  RouteSchema,
  RouteMetadata,
  ValidationError,
  TypedAppConfig,
} from './core/typed-app';

// OpenAPI generation
export {
  generateOpenApiSpec,
  saveOpenApiSpec,
  type OpenApiOptions
} from './core/openapi';

// Note: Examples are available in the /examples directory for reference
// Users should import { z } from 'zod' directly in their projects

// Type utilities
export type {
  TypeSafeApp as TypedApp,
  TypeSafeRouteConfig as RouteConfig,
  TypeSafeRouteHandler as RouteHandler
} from './core/schema-types';