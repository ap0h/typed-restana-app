/**
 * OpenAPI specification generation from TypeSafeApp routes
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import { TypeSafeApp } from './schema-types';

export interface OpenApiOptions {
  title?: string;
  description?: string;
  version?: string;
  servers?: Array<{
    url: string;
    description?: string;
  }>;
}

/**
 * Generate OpenAPI 3.0.3 specification from a TypeSafeApp instance
 */
export function generateOpenApiSpec(
  app: TypeSafeApp, 
  options: OpenApiOptions = {}
) {
  const routes = app.getRoutes();
  
  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: options.title || 'TypeSafe API',
      description: options.description || 'Generated API documentation using typed-restana-app',
      version: options.version || '1.0.0'
    },
    servers: options.servers || [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    paths: {} as any,
    components: {
      schemas: {} as any
    }
  };

  // Process each route
  routes.forEach((route, index) => {
    if (!route.schema) return;
    
    // Convert :param to {param} format for OpenAPI
    const pathKey = route.path.replace(/:([^/]+)/g, '{$1}');
    const method = route.method.toLowerCase();
    
    if (!openApiSpec.paths[pathKey]) {
      openApiSpec.paths[pathKey] = {};
    }

    const operation: any = {
      operationId: route.metadata?.operationId || `${method}${pathKey.replace(/[^a-zA-Z0-9]/g, '')}${index}`,
      summary: route.metadata?.summary || `${method.toUpperCase()} ${pathKey}`,
      description: route.metadata?.description || '',
      tags: route.metadata?.tags || ['Default']
    };

    if (route.metadata?.deprecated) {
      operation.deprecated = true;
    }

    // Add request body if present
    if (route.schema.body) {
      try {
        const bodySchema = zodToJsonSchema(route.schema.body, {
          target: 'openApi3',
          $refStrategy: 'none'
        });
        
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: bodySchema
            }
          }
        };
      } catch (error) {
        console.warn(`Failed to generate schema for body of ${method.toUpperCase()} ${route.path}:`, error);
      }
    }

    // Add query parameters if present
    if (route.schema.query) {
      try {
        const querySchema = zodToJsonSchema(route.schema.query, {
          target: 'openApi3',
          $refStrategy: 'none'
        });
        
        if (querySchema && 'properties' in querySchema) {
          const required = (querySchema as any).required || [];
          operation.parameters = Object.entries(querySchema.properties || {}).map(([name, schema]) => ({
            name,
            in: 'query',
            required: Array.isArray(required) ? required.includes(name) : false,
            schema
          }));
        }
      } catch (error) {
        console.warn(`Failed to generate query schema for ${method.toUpperCase()} ${route.path}:`, error);
      }
    }

    // Add path parameters if present
    if (route.schema.params) {
      try {
        const paramsSchema = zodToJsonSchema(route.schema.params, {
          target: 'openApi3',
          $refStrategy: 'none'
        });
        
        if (paramsSchema && 'properties' in paramsSchema) {
          if (!operation.parameters) operation.parameters = [];
          operation.parameters.push(
            ...Object.entries(paramsSchema.properties || {}).map(([name, schema]) => ({
              name,
              in: 'path',
              required: true,
              schema
            }))
          );
        }
      } catch (error) {
        console.warn(`Failed to generate params schema for ${method.toUpperCase()} ${route.path}:`, error);
      }
    }

    // Add responses
    operation.responses = {};
    
    if (route.schema.responses) {
      Object.entries(route.schema.responses).forEach(([statusCode, responseConfig]) => {
        const config = responseConfig as any; // Type assertion for flexibility
        if (config?.schema) {
          try {
            const responseSchema = zodToJsonSchema(config.schema, {
              target: 'openApi3',
              $refStrategy: 'none'
            });
            
            operation.responses[statusCode] = {
              description: config.description || `Response ${statusCode}`,
              content: {
                'application/json': {
                  schema: responseSchema
                }
              }
            };
          } catch (error) {
            console.warn(`Failed to generate response schema for ${statusCode} of ${method.toUpperCase()} ${route.path}:`, error);
            operation.responses[statusCode] = {
              description: config.description || `Response ${statusCode}`
            };
          }
        } else {
          operation.responses[statusCode] = {
            description: config?.description || `Response ${statusCode}`
          };
        }
      });
    } else {
      // Default response if none specified
      operation.responses['200'] = {
        description: 'Success'
      };
    }

    openApiSpec.paths[pathKey][method] = operation;
  });

  return openApiSpec;
}

/**
 * Generate OpenAPI spec and save it to a file
 */
export async function saveOpenApiSpec(
  app: TypeSafeApp,
  filePath: string,
  options: OpenApiOptions = {}
) {
  const { writeFileSync } = await import('fs');
  const spec = generateOpenApiSpec(app, options);
  writeFileSync(filePath, JSON.stringify(spec, null, 2));
  return spec;
}