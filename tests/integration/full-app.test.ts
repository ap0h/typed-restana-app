import request from 'supertest';
import { z } from 'zod';
import { TypeSafeApp } from '../../typed-restana-app/core/schema-types';
import { createTestApp } from '../test-utils';

describe('Full Application Integration', () => {
  let app: TypeSafeApp;
  let server: any;

  beforeEach(async () => {
    app = createTestApp({
      strict: false,
      validateResponses: false, // Disable for integration tests to focus on basic functionality
      logValidationErrors: false
    });

    // Set up a complete mini API
    setupCompleteAPI(app);

    server = await app.start(0);
  });

  afterEach(async () => {
    if (server && server.listening) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('Server close timeout, forcing shutdown');
          resolve();
        }, 2000);
        
        server.close(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    server = null;
  }, 5000); // Add timeout to afterEach itself

  function setupCompleteAPI(app: TypeSafeApp) {
    // Mock data store
    const users: any[] = [
      { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25 }
    ];

    // Schemas
    const UserSchema = z.object({
      id: z.number(),
      name: z.string(),
      email: z.string().email(),
      age: z.number().min(18)
    });

    const CreateUserSchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      age: z.number().min(18)
    });

    const UpdateUserSchema = z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      age: z.number().min(18).optional()
    });

    const UserQuerySchema = z.object({
      search: z.string().optional(),
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(10),
      minAge: z.coerce.number().optional()
    });

    const ParamsSchema = z.object({
      id: z.coerce.number()
    });

    // Middleware
    app.use((req: any, res: any, next: any) => {
      req.requestId = Math.random().toString(36).substr(2, 9);
      next();
    });

    app.use('/api', (req: any, res: any, next: any) => {
      res.setHeader('X-API-Version', '1.0.0');
      next();
    });

    // Routes
    app.get('/health', {
      handler: async () => ({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }),
      metadata: {
        summary: 'Health check',
        description: 'Check if the API is running'
      }
    });

    app.get('/api/users', {
      schema: {
        query: UserQuerySchema,
        responses: {
          '200': {
            schema: z.object({
              users: z.array(UserSchema),
              total: z.number(),
              page: z.number(),
              hasMore: z.boolean()
            }),
            description: 'List of users'
          }
        }
      },
      handler: async (context) => {
        let filteredUsers = [...users];
        const query = context.query;

        // Apply filters
        if (query.search) {
          filteredUsers = filteredUsers.filter(user =>
            user.name.toLowerCase().includes(query.search!.toLowerCase()) ||
            user.email.toLowerCase().includes(query.search!.toLowerCase())
          );
        }

        if (query.minAge) {
          filteredUsers = filteredUsers.filter(user => user.age >= query.minAge!);
        }

        // Pagination - use defaults since Zod should have applied them
        const page = query.page || 1;
        const limit = query.limit || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

        return {
          users: paginatedUsers,
          total: filteredUsers.length,
          page,
          hasMore: endIndex < filteredUsers.length
        };
      },
      metadata: {
        summary: 'Get users',
        description: 'Retrieve a paginated list of users with optional filtering',
        tags: ['Users']
      }
    });

    app.get('/api/users/:id', {
      schema: {
        params: ParamsSchema,
        responses: {
          '200': {
            schema: UserSchema,
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
      handler: async (context) => {
        const user = users.find(u => u.id === context.params.id);
        if (!user) {
          context.res.statusCode = 404;
          return {
            error: 'User not found',
            code: 404
          };
        }
        return user;
      },
      metadata: {
        summary: 'Get user by ID',
        tags: ['Users']
      }
    });

    app.post('/api/users', {
      schema: {
        body: CreateUserSchema,
        responses: {
          '201': {
            schema: UserSchema,
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
      handler: async (context) => {
        const newUser = {
          id: Math.max(...users.map(u => u.id)) + 1,
          ...context.body
        };
        users.push(newUser);
        context.res.statusCode = 201;
        return newUser;
      },
      metadata: {
        summary: 'Create user',
        description: 'Create a new user',
        tags: ['Users']
      }
    });

    app.put('/api/users/:id', {
      schema: {
        params: ParamsSchema,
        body: UpdateUserSchema,
        responses: {
          '200': {
            schema: UserSchema,
            description: 'User updated successfully'
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
      handler: async (context) => {
        const userIndex = users.findIndex(u => u.id === context.params.id);
        if (userIndex === -1) {
          context.res.statusCode = 404;
          return {
            error: 'User not found',
            code: 404
          };
        }

        users[userIndex] = { ...users[userIndex], ...context.body };
        return users[userIndex];
      },
      metadata: {
        summary: 'Update user',
        tags: ['Users']
      }
    });

    app.delete('/api/users/:id', {
      schema: {
        params: ParamsSchema,
        responses: {
          '204': {
            description: 'User deleted successfully'
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
      handler: async (context) => {
        const userIndex = users.findIndex(u => u.id === context.params.id);
        if (userIndex === -1) {
          context.res.statusCode = 404;
          return {
            error: 'User not found',
            code: 404
          };
        }

        users.splice(userIndex, 1);
        context.res.statusCode = 204;
        return undefined;
      },
      metadata: {
        summary: 'Delete user',
        tags: ['Users']
      }
    });

    // Strict validation endpoint
    app.post('/api/users/strict', {
      schema: {
        body: CreateUserSchema
      },
      strict: true, // Override global strictness
      handler: async (context) => {
        const newUser = {
          id: Math.max(...users.map(u => u.id)) + 1,
          ...context.body
        };
        return newUser;
      },
      metadata: {
        summary: 'Create user (strict validation)',
        tags: ['Users']
      }
    });
  }

  describe('Full CRUD Operations', () => {
    test('should perform complete user lifecycle', async () => {
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;

      // 1. Health check
      const healthResponse = await request(baseUrl)
        .get('/health')
        .expect(200);

      expect(healthResponse.body).toMatchObject({
        status: 'OK',
        version: '1.0.0'
      });

      // 2. Get initial users list
      const initialUsersResponse = await request(baseUrl)
        .get('/api/users')
        .expect(200);

      expect(initialUsersResponse.body).toMatchObject({
        users: expect.any(Array),
        total: 2,
        page: 1,
        hasMore: false
      });
      expect(initialUsersResponse.headers['x-api-version']).toBe('1.0.0');

      const initialCount = initialUsersResponse.body.total;

      // 3. Create new user
      const newUserData = {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        age: 28
      };

      const createResponse = await request(baseUrl)
        .post('/api/users')
        .send(newUserData)
        .expect(201);

      expect(createResponse.body).toMatchObject({
        id: expect.any(Number),
        ...newUserData
      });

      const newUserId = createResponse.body.id;

      // 4. Get the new user by ID
      const getUserResponse = await request(baseUrl)
        .get(`/api/users/${newUserId}`)
        .expect(200);

      expect(getUserResponse.body).toEqual(createResponse.body);

      // 5. Update the user
      const updateData = {
        name: 'Alice Johnson-Smith',
        age: 29
      };

      const updateResponse = await request(baseUrl)
        .put(`/api/users/${newUserId}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body).toMatchObject({
        id: newUserId,
        name: 'Alice Johnson-Smith',
        email: 'alice@example.com',
        age: 29
      });

      // 6. Verify user count increased
      const updatedUsersResponse = await request(baseUrl)
        .get('/api/users')
        .expect(200);

      expect(updatedUsersResponse.body.total).toBe(initialCount + 1);

      // 7. Delete the user
      await request(baseUrl)
        .delete(`/api/users/${newUserId}`)
        .expect(204);

      // 8. Verify user is gone
      await request(baseUrl)
        .get(`/api/users/${newUserId}`)
        .expect(404);

      // 9. Verify user count back to original
      const finalUsersResponse = await request(baseUrl)
        .get('/api/users')
        .expect(200);

      expect(finalUsersResponse.body.total).toBe(initialCount);
    });

    test('should handle filtering and pagination', async () => {
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;

      // Test search filter
      const searchResponse = await request(baseUrl)
        .get('/api/users?search=john')
        .expect(200);

      expect(searchResponse.body.users).toHaveLength(1);
      expect(searchResponse.body.users[0].name).toContain('John');

      // Test age filter
      const ageResponse = await request(baseUrl)
        .get('/api/users?minAge=30')
        .expect(200);

      expect(searchResponse.body.users).toHaveLength(1);
      expect(searchResponse.body.users[0].age).toBeGreaterThanOrEqual(30);

      // Test pagination
      const pageResponse = await request(baseUrl)
        .get('/api/users?page=1&limit=1')
        .expect(200);

      expect(pageResponse.body.users).toHaveLength(1);
      expect(pageResponse.body.page).toBe(1);
      expect(pageResponse.body.hasMore).toBe(true);
    });

    test('should handle validation errors properly', async () => {
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;

      // Test invalid email
      const invalidEmailResponse = await request(baseUrl)
        .post('/api/users')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          age: 25
        })
        .expect(400);

      expect(invalidEmailResponse.body).toMatchObject({
        error: 'Validation failed',
        details: expect.any(Array)
      });

      // Test age validation
      const invalidAgeResponse = await request(baseUrl)
        .post('/api/users')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          age: 17
        })
        .expect(400);

      expect(invalidAgeResponse.body.error).toBe('Validation failed');

      // Test missing required fields
      const missingFieldsResponse = await request(baseUrl)
        .post('/api/users')
        .send({
          name: 'Test User'
          // Missing email and age
        })
        .expect(400);

      expect(missingFieldsResponse.body.error).toBe('Validation failed');
    });

    test('should handle strict validation', async () => {
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;

      // Test strict endpoint - should reject extra fields
      const strictResponse = await request(baseUrl)
        .post('/api/users/strict')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          extraField: 'should be rejected'
        })
        .expect(400);

      expect(strictResponse.body.error).toBe('Validation failed');

      // Test regular endpoint - should allow extra fields
      const regularResponse = await request(baseUrl)
        .post('/api/users')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
          extraField: 'should be allowed'
        })
        .expect(201);

      expect(regularResponse.body).toMatchObject({
        id: expect.any(Number),
        name: 'Test User',
        email: 'test@example.com',
        age: 25,
        extraField: 'should be allowed'
      });
    });

    test('should handle 404 errors properly', async () => {
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;

      // Test get non-existent user
      const getResponse = await request(baseUrl)
        .get('/api/users/999')
        .expect(404);

      expect(getResponse.body).toEqual({
        error: 'User not found',
        code: 404
      });

      // Test update non-existent user
      const updateResponse = await request(baseUrl)
        .put('/api/users/999')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(updateResponse.body).toEqual({
        error: 'User not found',
        code: 404
      });

      // Test delete non-existent user
      const deleteResponse = await request(baseUrl)
        .delete('/api/users/999')
        .expect(404);

      expect(deleteResponse.body).toEqual({
        error: 'User not found',
        code: 404
      });
    });
  });

  describe('API Documentation', () => {
    test('should provide route information for OpenAPI generation', () => {
      const routes = app.getRoutes();

      expect(routes.length).toBeGreaterThan(0);

      // Check that routes have required information
      const getUsersRoute = routes.find(r => r.path === '/api/users' && r.method === 'GET');
      expect(getUsersRoute).toBeDefined();
      expect(getUsersRoute?.metadata).toMatchObject({
        summary: 'Get users',
        description: 'Retrieve a paginated list of users with optional filtering',
        tags: ['Users']
      });

      // Check that schemas are present
      expect(getUsersRoute?.schema).toBeDefined();
      expect(getUsersRoute?.schema.query).toBeDefined();
      expect(getUsersRoute?.schema.responses).toBeDefined();
    });
  });
});