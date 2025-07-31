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

// Examples and demonstrations
export { default as demonstrateTypeSafeRoutes } from './examples/type-safety-demo';
export { default as registerPocEndpoints } from './examples/zod-poc-endpoints';
export { default as demonstrateStrictnessFeatures, strictnessExamples } from './examples/strictness-demo';

// Re-export Zod for convenience
export { z } from 'zod';

// Type utilities
export type {
  TypeSafeApp as TypedApp,
  TypeSafeRouteConfig as RouteConfig,
  TypeSafeRouteHandler as RouteHandler
} from './core/schema-types';