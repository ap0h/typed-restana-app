#!/usr/bin/env node

/**
 * Enhanced OpenAPI generation script for typed routes with Zod
 * Generates documentation from route-level Zod schema definitions
 */

import { writeFileSync, mkdirSync } from 'fs';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { join } from 'path';

import { createTypedApp } from '../core/typed-app';
import registerPocEndpoints from '../examples/zod-poc-endpoints';
import { demonstrateTypeSafeRoutes } from '../examples/type-safety-demo';

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

// Register POC endpoints
registerPocEndpoints(mockTypedApp);

// Register demo routes
demonstrateTypeSafeRoutes(mockTypedApp);

/**
 * Convert Zod schema to JSON Schema
 */
function zodToOpenApi(schema: any) {
  if (!schema) return undefined;

  try {
    return zodToJsonSchema(schema);
  } catch (error) {
    console.warn('Failed to convert Zod schema to JSON Schema:', error);
    return undefined;
  }
}

/**
 * Generate OpenAPI paths from typed routes
 */
function generateTypedRoutePaths() {
  const paths: any = {};
  const typedRoutes = mockTypedApp.getRoutes();

  for (const route of typedRoutes) {
    const pathKey = route.path.replace(/:([^/]+)/g, '{$1}'); // Convert :id to {id}
    const method = route.method.toLowerCase();

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
      const querySchema = zodToOpenApi(route.schema.query) as any;
      if (querySchema && 'properties' in querySchema) {
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
      const paramsSchema = zodToOpenApi(route.schema.params) as any;
      if (paramsSchema && 'properties' in paramsSchema) {
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



/**
 * Generate complete OpenAPI specification
 */
function generateOpenApiSpec() {
  const typedPaths = generateTypedRoutePaths();

  const spec = {
    openapi: '3.0.3',
    info: {
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
      schemas: {}
    }
  };

  const outputDir = join(__dirname, '../docs');
  mkdirSync(outputDir, { recursive: true });

  const outputPath = join(outputDir, 'openapi.json');
  writeFileSync(outputPath, JSON.stringify(spec, null, 2), 'utf-8');

  console.log(`✅ Enhanced OpenAPI specification generated successfully!`);
  console.log(`📄 Saved to: ${outputPath}`);

  const totalRoutes = mockTypedApp.getRoutes().length;
  const pathCount = Object.keys(typedPaths).length;

  console.log(`🌐 Total routes documented: ${totalRoutes}`);
  console.log(`   📋 Type-safe Zod routes: ${totalRoutes}`);
  console.log(`   📄 OpenAPI paths: ${pathCount}`);

  console.log('\n📝 Documented routes:');
  console.log('   🔷 Type-Safe Zod Routes:');
  mockTypedApp.getRoutes().forEach((route) => {
    console.log(
      `      ${route.method.toUpperCase()} ${route.path} - ${route.metadata?.summary || 'No summary'}`
    );
  });

  return outputPath;
}

// Only run if this script is executed directly
if (require.main === module) {
  try {
    generateOpenApiSpec();
  } catch (error) {
    console.error('❌ Failed to generate OpenAPI specification:', error);
    throw error;
  }
}

export { generateOpenApiSpec };
