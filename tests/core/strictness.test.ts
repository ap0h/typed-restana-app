import request from 'supertest';
import { z } from 'zod';
import { TypeSafeApp } from '../../typed-restana-app/core/schema-types';
import { createTestApp, strictTestConfig, responseValidationConfig } from '../test-utils';

describe('Strictness Configuration', () => {
  let server: any;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  describe('Global Strictness', () => {
    test('should allow extra fields when strict is false (default)', async () => {
      const app = createTestApp({ strict: false });

      const BodySchema = z.object({
        name: z.string(),
        email: z.string().email()
      });

      app.post('/users', {
        schema: {
          body: BodySchema
        },
        handler: async (context) => {
          return { id: 1, ...context.body };
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .post('/users')
        .send({
          name: 'John',
          email: 'john@example.com',
          extraField: 'should be allowed' // Extra field
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: 1,
        name: 'John',
        email: 'john@example.com',
        extraField: 'should be allowed'
      });
    });

    test('should reject extra fields when strict is true', async () => {
      const app = createTestApp({ strict: true });

      const BodySchema = z.object({
        name: z.string(),
        email: z.string().email()
      });

      app.post('/users', {
        schema: {
          body: BodySchema
        },
        handler: async (context) => {
          return { id: 1, ...context.body };
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .post('/users')
        .send({
          name: 'John',
          email: 'john@example.com',
          extraField: 'should be rejected' // Extra field
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('Unrecognized key')
          })
        ])
      });
    });
  });

  describe('Per-Route Strictness', () => {
    test('should override global strictness per route', async () => {
      const app = createTestApp({ 
        strict: false, // Global: allow extra fields
      });

      const BodySchema = z.object({
        name: z.string(),
        email: z.string().email()
      });

      // Route-level strict override
      app.post('/users/strict', {
        schema: {
          body: BodySchema
        },
        strict: true, // Override: reject extra fields
        handler: async (context) => {
          return { id: 1, ...context.body };
        }
      });

      // Route using global config
      app.post('/users/flexible', {
        schema: {
          body: BodySchema
        },
        handler: async ({ body }) => {
          return { id: 2, ...body };
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      // Test strict route - should reject extra fields
      const strictResponse = await request(`http://localhost:${port}`)
        .post('/users/strict')
        .send({
          name: 'John',
          email: 'john@example.com',
          extraField: 'should be rejected'
        })
        .expect(400);

      expect(strictResponse.body.error).toBe('Validation failed');

      // Test flexible route - should allow extra fields
      const flexibleResponse = await request(`http://localhost:${port}`)
        .post('/users/flexible')
        .send({
          name: 'Jane',
          email: 'jane@example.com',
          extraField: 'should be allowed'
        })
        .expect(200);

      expect(flexibleResponse.body).toMatchObject({
        id: 2,
        name: 'Jane',
        email: 'jane@example.com',
        extraField: 'should be allowed'
      });
    });
  });

  describe('Response Validation', () => {
    test('should validate responses when validateResponses is true', async () => {
      const app = createTestApp({
        strict: false,
        validateResponses: true,
        logValidationErrors: false
      });

      const ResponseSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email()
      });

      app.get('/users/:id', {
        schema: {
          params: z.object({ id: z.coerce.number() }),
          responses: {
            '200': {
              schema: ResponseSchema,
              description: 'User found'
            }
          }
        },
        handler: async (context) => {
          // Return invalid response (missing email)
          return {
            id: context.params.id,
            name: 'John Doe'
            // Missing email field
          };
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .get('/users/123')
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Response validation failed'
      });
    });

    test('should skip response validation when validateResponses is false', async () => {
      const app = createTestApp({
        strict: false,
        validateResponses: false,
        logValidationErrors: false
      });

      const ResponseSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email()
      });

      app.get('/users/:id', {
        schema: {
          params: z.object({ id: z.coerce.number() }),
          responses: {
            '200': {
              schema: ResponseSchema,
              description: 'User found'
            }
          }
        },
        handler: async (context) => {
          // Return invalid response (missing email)
          return {
            id: context.params.id,
            name: 'John Doe'
            // Missing email field - should be allowed
          };
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .get('/users/123')
        .expect(200);

      expect(response.body).toEqual({
        id: 123,
        name: 'John Doe'
      });
    });

    test('should override global response validation per route', async () => {
      const app = createTestApp({
        strict: false,
        validateResponses: false, // Global: skip response validation
        logValidationErrors: false
      });

      const ResponseSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email()
      });

      app.get('/users/:id/validated', {
        schema: {
          params: z.object({ id: z.coerce.number() }),
          responses: {
            '200': {
              schema: ResponseSchema,
              description: 'User found'
            }
          }
        },
        validateResponse: true, // Override: validate response
        handler: async (context) => {
          return {
            id: context.params.id,
            name: 'John Doe'
            // Missing email - should fail validation
          };
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .get('/users/123/validated')
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Response validation failed'
      });
    });
  });

  describe('Query Parameter Strictness', () => {
    test('should handle strict query parameters', async () => {
      const app = createTestApp({
        strict: true,
        validateResponses: false,
        logValidationErrors: false
      });

      const QuerySchema = z.object({
        search: z.string(),
        page: z.coerce.number().default(1)
      });

      app.get('/users', {
        schema: {
          query: QuerySchema
        },
        handler: async (context) => {
          return { query: context.query, results: [] };
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      // Should reject extra query parameters
      const response = await request(`http://localhost:${port}`)
        .get('/users?search=john&page=1&extraParam=should-fail')
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('Unrecognized key')
          })
        ])
      });
    });
  });
});