#!/usr/bin/env node

/**
 * Enhanced OpenAPI generation script for typed routes with Zod
 * Generates documentation from route-level Zod schema definitions
 */

import { writeFileSync, mkdirSync } from 'fs';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { join } from 'path';

import { createTypedApp } from '../core/typed-app';
import registerPocEndpoints from '../../examples/zod-poc-endpoints';
import { demonstrateTypeSafeRoutes } from '../../examples/type-safety-demo';
import demonstrateStrictnessFeatures from '../../examples/strictness-demo';

// Mock app to register routes for documentation
const mockRestanaApp = {
  get: () => {},
  post: () => {},
  put: () => {},
  patch: () => {},
  delete: () => {},
  use: () => {}
} as any;

// Create typed app and register routes for documentation
const mockTypedApp = createTypedApp(mockRestanaApp);

// Register all route types
console.log('📝 Registering POC endpoints for OpenAPI...');
registerPocEndpoints(mockTypedApp);

console.log('📝 Registering demo routes for OpenAPI...');
demonstrateTypeSafeRoutes(mockTypedApp);

console.log('🔧 Registering strictness demo for OpenAPI...');
demonstrateStrictnessFeatures(mockTypedApp);

/**
 * Convert Zod schema to JSON Schema using zod-to-json-schema
 */
function zodToOpenApi(schema: any) {
  if (!schema) return undefined;

  try {
    // Use zod-to-json-schema for Zod v3 compatibility
    const jsonSchema = zodToJsonSchema(schema, {
      target: 'openApi3', // Target OpenAPI 3.0
      $refStrategy: 'none' // Don't use refs for cleaner inline schemas
    });
    
    // Remove the $schema property for cleaner OpenAPI
    if (jsonSchema && typeof jsonSchema === 'object') {
      const cleanSchema = { ...jsonSchema };
      delete cleanSchema.$schema;
      return cleanSchema;
    }
    
    return jsonSchema;
  } catch (error) {
    console.warn('Failed to convert Zod schema to JSON Schema:', error);
    console.warn('Schema object:', schema);
    return {
      type: 'object',
      description: 'Schema conversion failed - please check the source schema'
    };
  }
}

/**
 * Generate OpenAPI paths from typed routes
 */
function generateTypedRoutePaths() {
  const paths: any = {};
  const typedRoutes = mockTypedApp.getRoutes();

  console.log(`🔍 Processing ${typedRoutes.length} routes for OpenAPI generation...`);

  for (const route of typedRoutes) {
    const pathKey = route.path.replace(/:([^/]+)/g, '{$1}'); // Convert :id to {id}
    const method = route.method.toLowerCase();

    console.log(`   Processing: ${method.toUpperCase()} ${pathKey}`);

    if (!paths[pathKey]) {
      paths[pathKey] = {};
    }

    const operation: any = {
      summary: route.metadata?.summary || `${method.toUpperCase()} ${pathKey}`,
      description: route.metadata?.description,
      operationId: route.metadata?.operationId,
      tags: route.metadata?.tags || [],
      parameters: [],
      responses: {}
    };

    // Add query parameters
    if (route.schema?.query) {
      console.log(`     → Processing query schema for ${pathKey}`);
      const querySchema = zodToOpenApi(route.schema.query) as any;
      if (querySchema && querySchema.type === 'object' && querySchema.properties) {
        for (const [paramName, paramSchema] of Object.entries(querySchema.properties)) {
          operation.parameters.push({
            name: paramName,
            in: 'query',
            required: querySchema.required?.includes(paramName) || false,
            schema: paramSchema,
            description: (paramSchema as any)?.description
          });
        }
      }
    }

    // Add path parameters
    if (route.schema?.params) {
      console.log(`     → Processing params schema for ${pathKey}`);
      const paramsSchema = zodToOpenApi(route.schema.params) as any;
      if (paramsSchema && paramsSchema.type === 'object' && paramsSchema.properties) {
        for (const [paramName, paramSchema] of Object.entries(paramsSchema.properties)) {
          operation.parameters.push({
            name: paramName,
            in: 'path',
            required: true,
            schema: paramSchema,
            description: (paramSchema as any)?.description
          });
        }
      }
    }

    // Add request body
    if (route.schema?.body) {
      console.log(`     → Processing body schema for ${pathKey}`);
      const bodySchema = zodToOpenApi(route.schema.body);
      if (bodySchema) {
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: bodySchema
            }
          }
        };
      }
    }

    // Add responses
    if (route.schema?.responses) {
      console.log(`     → Processing response schemas for ${pathKey}`);
      for (const [statusCode, responseConfig] of Object.entries(route.schema.responses)) {
        const config = responseConfig as any;
        const responseSchema = zodToOpenApi(config.schema);
        operation.responses[statusCode] = {
          description: config.description || `Response ${statusCode}`,
          content: responseSchema
            ? {
                'application/json': {
                  schema: responseSchema
                }
              }
            : undefined
        };
      }
    }

    // Add default responses if none specified
    if (Object.keys(operation.responses).length === 0) {
      operation.responses['200'] = {
        description: 'Success'
      };
    }

    paths[pathKey][method] = operation;
  }

  return paths;
}

function generateTypedRoutePathsFromRoutes(routes: any[]) {
  const paths: Record<string, any> = {};
  
  for (const route of routes) {
    const pathKey = route.path.replace(/:([^\/]+)/g, '{$1}');
    
    if (!paths[pathKey]) {
      paths[pathKey] = {};
    }
    
    const method = route.method.toLowerCase();
    paths[pathKey][method] = {
      summary: route.metadata?.summary || `${route.method} ${route.path}`,
      description: route.metadata?.description,
      tags: route.metadata?.tags,
      parameters: [],
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        }
      }
    };
    
    // Add schema-based parameters and request body
    if (route.schema) {
      if (route.schema.query) {
        const querySchema = zodToJsonSchema(route.schema.query, { target: 'openApi3', $refStrategy: 'none' });
        if (querySchema && 'properties' in querySchema) {
          for (const [name, propSchema] of Object.entries(querySchema.properties || {})) {
            paths[pathKey][method].parameters.push({
              name,
              in: 'query',
              required: ((querySchema as any).required || []).includes(name),
              schema: propSchema
            });
          }
        }
      }
      
      if (route.schema.params) {
        const paramsSchema = zodToJsonSchema(route.schema.params, { target: 'openApi3', $refStrategy: 'none' });
        if (paramsSchema && 'properties' in paramsSchema) {
          for (const [name, propSchema] of Object.entries(paramsSchema.properties || {})) {
            paths[pathKey][method].parameters.push({
              name,
              in: 'path',
              required: true,
              schema: propSchema
            });
          }
        }
      }
      
      if (route.schema.body) {
        const bodySchema = zodToJsonSchema(route.schema.body, { target: 'openApi3', $refStrategy: 'none' });
        paths[pathKey][method].requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: bodySchema
            }
          }
        };
      }
      
      if (route.schema.responses) {
        paths[pathKey][method].responses = {};
        for (const [statusCode, responseConfig] of Object.entries(route.schema.responses)) {
          const config = responseConfig as any;
          const response: any = {
            description: config.description || `Response ${statusCode}`
          };
          
          if (config.schema) {
            const responseSchema = zodToJsonSchema(config.schema, { target: 'openApi3', $refStrategy: 'none' });
            response.content = {
              'application/json': {
                schema: responseSchema
              }
            };
          }
          
          paths[pathKey][method].responses[statusCode] = response;
        }
      }
    }
  }
  
  return paths;
}

/**
 * Generate complete OpenAPI specification
 */
export function generateOpenApiSpec(info?: any, routes?: any[]) {
  const typedPaths = routes ? generateTypedRoutePathsFromRoutes(routes) : generateTypedRoutePaths();

  const spec = {
    openapi: '3.0.0',
    info: info || {
      title: 'Type-Safe Restana API with Zod',
      version: '1.0.0',
      description:
        'Type-safe REST API built with Restana and Zod validation. Demonstrates compile-time type safety, automatic validation, and OpenAPI generation.',
      contact: {
        name: 'API Team',
        email: 'api@example.com'
      },
      license: {
        name: 'MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.example.com',
        description: 'Production server'
      }
    ],
    paths: typedPaths,
    components: {
      schemas: {},
      securitySchemes: {}
    }
  };

  return spec;
}

/**
 * Main execution
 */
function main() {
  try {
    console.log('🚀 Generating Enhanced OpenAPI specification with Zod schemas...');
    
    const spec = generateOpenApiSpec();
    const outputDir = join(__dirname, '..', 'docs');
    const outputPath = join(outputDir, 'openapi.json');

    // Ensure output directory exists
    mkdirSync(outputDir, { recursive: true });

    // Write the specification
    writeFileSync(outputPath, JSON.stringify(spec, null, 2));

    console.log('✅ Enhanced OpenAPI specification generated successfully!');
    console.log(`📄 Saved to: ${outputPath}`);
    
    const routeCount = Object.keys(spec.paths).length;
    const totalOperations = Object.values(spec.paths).reduce((acc: number, path: any) => {
      return acc + Object.keys(path).length;
    }, 0);
    
    console.log(`🌐 Total routes documented: ${totalOperations}`);
    console.log(`   📋 Type-safe Zod routes: ${totalOperations}`);
    console.log(`   📄 OpenAPI paths: ${routeCount}`);
    
    console.log('\n📝 Documented routes:');
    console.log('   🔷 Type-Safe Zod Routes:');
    
    const routes = mockTypedApp.getRoutes();
    routes.forEach(route => {
      console.log(`      ${route.method} ${route.path} - ${route.metadata?.summary || 'No description'}`);
    });

  } catch (error) {
    console.error('❌ Failed to generate OpenAPI specification:', error);
    process.exit(1);
  }
}

// Run the generator
main();