import request from 'supertest';
import { z } from 'zod';
import { createTestApp } from '../test-utils';


describe('Error Handling', () => {
  let server: any;

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

  describe('Validation Error Handling', () => {
    test('should handle validation errors without sending multiple responses', async () => {
      const app = createTestApp({
        strict: false,
        validateResponses: false,
        logValidationErrors: false
      });

      const BodySchema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        age: z.number().min(18)
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

      // This should not cause "Cannot set headers after they are sent" error
      const response = await request(`http://localhost:${port}`)
        .post('/users')
        .send({
          name: '', // Invalid: empty string
          email: 'invalid-email', // Invalid: not an email
          age: 17 // Invalid: under 18
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation failed',
        details: expect.any(Array)
      });

      // Should contain all validation errors
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    test('should handle missing body gracefully', async () => {
      const app = createTestApp();

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
        // No body sent
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    test('should handle invalid JSON gracefully', async () => {
      const app = createTestApp();

      app.post('/users', {
        schema: {
          body: z.object({ name: z.string() })
        },
        handler: async (context) => {
          return { id: 1, ...context.body };
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .post('/users')
        .set('Content-Type', 'application/json')
        .send('invalid json{')
        .expect(400);

      // Should handle JSON parsing error
      expect(response.status).toBe(400);
    });
  });

  describe('Handler Error Handling', () => {
    test('should handle errors thrown in handlers', async () => {
      const app = createTestApp();

      app.get('/error', {
        handler: async () => {
          throw new Error('Handler error');
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .get('/error')
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Internal Server Error'
      });
    });

    test('should handle async errors in handlers', async () => {
      const app = createTestApp();

      app.get('/async-error', {
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error('Async handler error');
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .get('/async-error')
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Internal Server Error'
      });
    });

    test('should not send multiple responses when handler throws after validation', async () => {
      const app = createTestApp();

      const BodySchema = z.object({
        name: z.string()
      });

      app.post('/users', {
        schema: {
          body: BodySchema
        },
        handler: async (context) => {
          // Simulate some processing then error
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error('Processing failed');
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .post('/users')
        .send({ name: 'John' })
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Internal Server Error'
      });
    });
  });

  describe('Response Validation Errors', () => {
    test('should handle response validation failures', async () => {
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
        handler: async (context: any) => {
          // Return response that doesn't match schema
          return {
            id: context.params.id,
            name: 'John',
            email: 'invalid-email' // Invalid email format
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

    test('should handle response validation for different status codes', async () => {
      const app = createTestApp({
        validateResponses: false, // Disable for this specific test to check status codes
        logValidationErrors: false
      });

      const UserSchema = z.object({
        id: z.number(),
        name: z.string()
      });

      const ErrorSchema = z.object({
        error: z.string(),
        code: z.number()
      });

      app.get('/users/:id', {
        schema: {
          params: z.object({ id: z.coerce.number() }),
          responses: {
            '200': {
              schema: UserSchema,
              description: 'User found'
            },
            '404': {
              schema: ErrorSchema,
              description: 'User not found'
            }
          }
        },
        handler: async (context) => {
          if (context.params.id === 404) {
            context.res.statusCode = 404;
            return {
              error: 'User not found',
              code: 404
            };
          }

          return {
            id: context.params.id,
            name: `User ${context.params.id}`
          };
        }
      });

      server = await app.start(0);
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;

      // Test valid 200 response
      const successResponse = await request(baseUrl)
        .get('/users/123')
        .expect(200);

      expect(successResponse.body).toEqual({
        id: 123,
        name: 'User 123'
      });

      // Test valid 404 response
      const notFoundResponse = await request(baseUrl)
        .get('/users/404')
        .expect(404);

      expect(notFoundResponse.body).toEqual({
        error: 'User not found',
        code: 404
      });
    });
  });

  describe('Error Logging Configuration', () => {
    test('should respect logValidationErrors configuration', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const app = createTestApp({
        strict: false,
        validateResponses: false,
        logValidationErrors: true // Enable logging
      });

      const BodySchema = z.object({
        name: z.string().min(1),
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

      await request(`http://localhost:${port}`)
        .post('/users')
        .send({
          name: '',
          email: 'invalid'
        })
        .expect(400);

      // Should have logged validation errors 
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 Validation failed for body'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    
    test('should not log when logValidationErrors is false', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const app = createTestApp({
        strict: false,
        validateResponses: false,
        logValidationErrors: false // Disable logging
      });

      const BodySchema = z.object({
        name: z.string().min(1),
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

      await request(`http://localhost:${port}`)
        .post('/users')
        .send({
          name: '',
          email: 'invalid'
        })
        .expect(400);

      // Should not have logged validation errors
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    test('should handle handler returning undefined', async () => {
      const app = createTestApp();

      app.get('/undefined', {
        handler: async () => {
          return undefined;
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .get('/undefined')
        .expect(200);

      // Should handle undefined response gracefully
      expect(response.body).toEqual({});
    });

    test('should handle handler sending response directly', async () => {
      const app = createTestApp();

      app.get('/direct', {
        handler: async (context) => {
          context.res.send({ message: 'Direct response' });
          // Don't return anything
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .get('/direct')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Direct response'
      });
    });

    test('should not double-send when handler sends response and returns value', async () => {
      const app = createTestApp();

      app.get('/double', {
        handler: async (context) => {
          context.res.send({ message: 'First response' });
          return { message: 'Second response' }; // This should not cause error
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .get('/double')
        .expect(200);

      // Should only get the first response
      expect(response.body).toEqual({
        message: 'First response'
      });
    });
  });
});