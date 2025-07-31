import { z } from 'zod';
import restana from 'restana';
import { createTypedApp } from '../../typed-restana-app/core/typed-app';
import { generateOpenApiSpec } from '../../typed-restana-app/scripts/generate-typed-openapi';

describe('OpenAPI Generation', () => {
  describe('Schema Generation', () => {
    test('should generate OpenAPI spec for basic routes', () => {
      const restanaApp = restana();
      const app = createTypedApp(restanaApp);

      const UserQuerySchema = z.object({
        search: z.string().optional().describe('Search term for users'),
        page: z.coerce.number().default(1).describe('Page number'),
        limit: z.coerce.number().default(10).describe('Number of users per page')
      });

      const UserResponseSchema = z.object({
        id: z.number().describe('User ID'),
        name: z.string().describe('User name'),
        email: z.string().email().describe('User email')
      });

      app.get('/users', {
        schema: {
          query: UserQuerySchema,
          responses: {
            '200': {
              schema: z.object({
                users: z.array(UserResponseSchema),
                total: z.number(),
                page: z.number()
              }),
              description: 'List of users'
            }
          }
        },
        handler: async () => ({ users: [], total: 0, page: 1 }),
        metadata: {
          summary: 'Get users',
          description: 'Retrieve a paginated list of users',
          tags: ['Users']
        }
      });

      const routes = app.getRoutes();
      const spec = generateOpenApiSpec({
        title: 'Test API',
        description: 'Test API for OpenAPI generation',
        version: '1.0.0'
      }, routes);

      expect(spec).toMatchObject({
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          description: 'Test API for OpenAPI generation',
          version: '1.0.0'
        },
        paths: {
          '/users': {
            get: {
              summary: 'Get users',
              description: 'Retrieve a paginated list of users',
              tags: ['Users'],
              parameters: expect.any(Array),
              responses: {
                '200': expect.objectContaining({
                  description: 'List of users',
                  content: {
                    'application/json': {
                      schema: expect.any(Object)
                    }
                  }
                })
              }
            }
          }
        }
      });

      // Verify query parameters are included
      const getUsersOp = spec.paths['/users'].get;
      expect(getUsersOp.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'search',
            in: 'query',
            required: false,
            schema: expect.objectContaining({
              description: 'Search term for users'
            })
          }),
          expect.objectContaining({
            name: 'page',
            in: 'query',
            required: false,
            schema: expect.objectContaining({
              description: 'Page number'
            })
          })
        ])
      );
    });

    test('should generate OpenAPI spec for POST routes with body schema', () => {
      const restanaApp = restana();
      const app = createTypedApp(restanaApp);

      const CreateUserSchema = z.object({
        name: z.string().min(1).describe('User name'),
        email: z.string().email().describe('User email address'),
        age: z.number().min(18).describe('User age (must be 18+)')
      });

      const UserResponseSchema = z.object({
        id: z.number().describe('Generated user ID'),
        name: z.string(),
        email: z.string(),
        age: z.number(),
        createdAt: z.string().describe('Creation timestamp')
      });

      app.post('/users', {
        schema: {
          body: CreateUserSchema,
          responses: {
            '201': {
              schema: UserResponseSchema,
              description: 'User created successfully'
            },
            '400': {
              schema: z.object({
                error: z.string(),
                details: z.array(z.any())
              }),
              description: 'Validation error'
            }
          }
        },
        handler: async ({ body }) => ({
          id: 1,
          ...body,
          createdAt: new Date().toISOString()
        }),
        metadata: {
          summary: 'Create user',
          description: 'Create a new user account',
          tags: ['Users']
        }
      });

      const routes = app.getRoutes();
      const spec = generateOpenApiSpec({
        title: 'Test API',
        version: '1.0.0'
      }, routes);

      const createUserOp = spec.paths['/users'].post;

      expect(createUserOp).toMatchObject({
        summary: 'Create user',
        description: 'Create a new user account',
        tags: ['Users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: expect.any(Object)
            }
          }
        },
        responses: {
          '201': expect.objectContaining({
            description: 'User created successfully'
          }),
          '400': expect.objectContaining({
            description: 'Validation error'
          })
        }
      });
    });

    test('should generate OpenAPI spec for routes with path parameters', () => {
      const restanaApp = restana();
      const app = createTypedApp(restanaApp);

      const UserParamsSchema = z.object({
        id: z.coerce.number().describe('User ID')
      });

      const UserResponseSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string()
      });

      app.get('/users/:id', {
        schema: {
          params: UserParamsSchema,
          responses: {
            '200': {
              schema: UserResponseSchema,
              description: 'User found'
            },
            '404': {
              schema: z.object({
                error: z.string(),
                code: z.number()
              }),
              description: 'User not found'
            }
          }
        },
        handler: async ({ params }) => ({
          id: params.id,
          name: `User ${params.id}`,
          email: `user${params.id}@example.com`
        }),
        metadata: {
          summary: 'Get user by ID',
          tags: ['Users']
        }
      });

      const routes = app.getRoutes();
      const spec = generateOpenApiSpec({
        title: 'Test API',
        version: '1.0.0'
      }, routes);

      const getUserOp = spec.paths['/users/{id}'].get;

      expect(getUserOp).toMatchObject({
        summary: 'Get user by ID',
        tags: ['Users'],
        parameters: [
          expect.objectContaining({
            name: 'id',
            in: 'path',
            required: true,
            schema: expect.objectContaining({
              type: 'number',
              description: 'User ID'
            })
          })
        ]
      });
    });

    test('should handle routes without schemas', () => {
      const restanaApp = restana();
      const app = createTypedApp(restanaApp);

      app.get('/health', {
        handler: async () => ({ status: 'OK' }),
        metadata: {
          summary: 'Health check',
          description: 'Check API health status'
        }
      });

      const routes = app.getRoutes();
      const spec = generateOpenApiSpec({
        title: 'Test API',
        version: '1.0.0'
      }, routes);

      expect(spec.paths['/health'].get).toMatchObject({
        summary: 'Health check',
        description: 'Check API health status'
      });
    });

    test('should generate spec with multiple HTTP methods on same path', () => {
      const restanaApp = restana();
      const app = createTypedApp(restanaApp);

      const UserSchema = z.object({
        id: z.number(),
        name: z.string()
      });

      app.get('/users/:id', {
        schema: {
          params: z.object({ id: z.coerce.number() }),
          responses: {
            '200': { schema: UserSchema, description: 'User found' }
          }
        },
        handler: async ({ params }) => ({ id: params.id, name: 'User' }),
        metadata: { summary: 'Get user' }
      });

      app.put('/users/:id', {
        schema: {
          params: z.object({ id: z.coerce.number() }),
          body: z.object({ name: z.string() }),
          responses: {
            '200': { schema: UserSchema, description: 'User updated' }
          }
        },
        handler: async ({ params, body }) => ({ id: params.id, ...body }),
        metadata: { summary: 'Update user' }
      });

      app.delete('/users/:id', {
        schema: {
          params: z.object({ id: z.coerce.number() }),
          responses: {
            '204': { 
              schema: z.void(),
              description: 'User deleted' 
            }
          }
        },
        handler: async () => undefined,
        metadata: { summary: 'Delete user' }
      });

      const routes = app.getRoutes();
      const spec = generateOpenApiSpec({
        title: 'Test API',
        version: '1.0.0'
      }, routes);

      const userPath = spec.paths['/users/{id}'];

      expect(userPath).toHaveProperty('get');
      expect(userPath).toHaveProperty('put');
      expect(userPath).toHaveProperty('delete');

      expect(userPath.get.summary).toBe('Get user');
      expect(userPath.put.summary).toBe('Update user');
      expect(userPath.delete.summary).toBe('Delete user');
    });

    test('should handle complex nested schemas', () => {
      const restanaApp = restana();
      const app = createTypedApp(restanaApp);

      const AddressSchema = z.object({
        street: z.string(),
        city: z.string(),
        zipCode: z.string(),
        country: z.string().default('US')
      });

      const UserSchema = z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number().min(18),
        addresses: z.array(AddressSchema),
        preferences: z.object({
          newsletter: z.boolean().default(true),
          notifications: z.enum(['email', 'sms', 'none']).default('email')
        })
      });

      app.post('/users/complex', {
        schema: {
          body: UserSchema,
          responses: {
            '201': {
              schema: UserSchema.extend({
                id: z.number(),
                createdAt: z.string()
              }),
              description: 'Complex user created'
            }
          }
        },
        handler: async ({ body }) => ({
          id: 1,
          ...body,
          createdAt: new Date().toISOString()
        }),
        metadata: {
          summary: 'Create complex user',
          tags: ['Users']
        }
      });

      const routes = app.getRoutes();
      const spec = generateOpenApiSpec({
        title: 'Test API',
        version: '1.0.0'
      }, routes);

      const operation = spec.paths['/users/complex'].post;

      expect(operation.requestBody.content['application/json'].schema).toMatchObject({
        type: 'object',
        properties: expect.objectContaining({
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          age: { type: 'number', minimum: 18 },
          addresses: {
            type: 'array',
            items: expect.objectContaining({
              type: 'object',
              additionalProperties: false,
              properties: expect.objectContaining({
                street: { type: 'string' },
                city: { type: 'string' },
                zipCode: { type: 'string' },
                country: { type: 'string', default: 'US' }
              }),
              required: expect.arrayContaining(['street', 'city', 'zipCode'])
            })
          },
          preferences: {
            type: 'object',
            additionalProperties: false,
            properties: expect.objectContaining({
              newsletter: { type: 'boolean', default: true },
              notifications: {
                type: 'string',
                enum: ['email', 'sms', 'none'],
                default: 'email'
              }
            })
          }
        })
      });
    });
  });
});