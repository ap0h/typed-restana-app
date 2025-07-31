import request from 'supertest';
import { z } from 'zod';
import { TypeSafeApp } from '../../typed-restana-app/core/schema-types';
import { createTestApp } from '../test-utils';

describe('TypedApp Core Functionality', () => {
  let app: TypeSafeApp;
  let server: any;

  beforeEach(() => {
    app = createTestApp();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  describe('Basic Route Registration', () => {
    test('should register GET route with query validation', async () => {
      const QuerySchema = z.object({
        search: z.string().optional(),
        page: z.coerce.number().default(1)
      });

      type Query = z.infer<typeof QuerySchema>;

      app.get('/users', {
        schema: {
          query: QuerySchema
        },
        handler: async (context) => {
          return {
            users: [],
            search: context.query.search,
            page: context.query.page
          };
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .get('/users?search=john&page=2')
        .expect(200);

      expect(response.body).toEqual({
        users: [],
        search: 'john',
        page: 2
      });
    });

    test('should register POST route with body validation', async () => {
      const BodySchema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        age: z.number().min(18)
      });

      type Body = z.infer<typeof BodySchema>;

      app.post('/users', {
        schema: {
          body: BodySchema
        },
        handler: async (context) => {
          return {
            id: 1,
            ...context.body,
            created: new Date().toISOString()
          };
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 25
      };

      const response = await request(`http://localhost:${port}`)
        .post('/users')
        .send(userData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        age: 25
      });
      expect(response.body.created).toBeDefined();
    });

    test('should register route with params validation', async () => {
      const ParamsSchema = z.object({
        id: z.coerce.number()
      });

      type Params = z.infer<typeof ParamsSchema>;

      app.get('/users/:id', {
        schema: {
          params: ParamsSchema
        },
        handler: async (context) => {
          return {
            id: context.params.id,
            name: `User ${context.params.id}`
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
        name: 'User 123'
      });
    });
  });

  describe('Validation Errors', () => {
    test('should return 400 for invalid query parameters', async () => {
      const QuerySchema = z.object({
        age: z.coerce.number().min(18)
      });

      app.get('/users', {
        schema: {
          query: QuerySchema
        },
        handler: async () => ({ users: [] })
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .get('/users?age=17')
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation failed',
        details: expect.any(Array)
      });
    });

    test('should return 400 for invalid body', async () => {
      const BodySchema = z.object({
        email: z.string().email(),
        age: z.number().min(18)
      });

      app.post('/users', {
        schema: {
          body: BodySchema
        },
        handler: async () => ({ id: 1 })
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .post('/users')
        .send({ email: 'invalid-email', age: 17 })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation failed',
        details: expect.any(Array)
      });
    });

    test('should not send multiple responses for validation errors', async () => {
      const BodySchema = z.object({
        name: z.string().min(1)
      });

      app.post('/users', {
        schema: {
          body: BodySchema
        },
        handler: async () => ({ id: 1 })
      });

      server = await app.start(0);
      const port = server.address().port;

      // This should not cause "Cannot set headers after they are sent" error
      const response = await request(`http://localhost:${port}`)
        .post('/users')
        .send({}) // Invalid body
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Method Chaining', () => {
    test('should support method chaining for route registration', async () => {
      const result = app
        .get('/test1', {
          handler: async () => ({ message: 'test1' })
        })
        .post('/test2', {
          handler: async () => ({ message: 'test2' })
        })
        .put('/test3', {
          handler: async () => ({ message: 'test3' })
        });

      expect(result).toBe(app);

      server = await app.start(0);
      const port = server.address().port;

      const response1 = await request(`http://localhost:${port}`)
        .get('/test1')
        .expect(200);
      expect(response1.body.message).toBe('test1');

      const response2 = await request(`http://localhost:${port}`)
        .post('/test2')
        .expect(200);
      expect(response2.body.message).toBe('test2');
    });
  });

  describe('Route Information', () => {
    test('should track registered routes', () => {
      const QuerySchema = z.object({ search: z.string() });
      const BodySchema = z.object({ name: z.string() });

      app.get('/users', {
        schema: { query: QuerySchema },
        handler: async () => ({ users: [] }),
        metadata: { description: 'Get users' }
      });

      app.post('/users', {
        schema: { body: BodySchema },
        handler: async () => ({ id: 1 }),
        metadata: { description: 'Create user' }
      });

      const routes = app.getRoutes();

      expect(routes).toHaveLength(2);
      expect(routes[0]).toMatchObject({
        method: 'GET',
        path: '/users',
        metadata: { description: 'Get users' }
      });
      expect(routes[1]).toMatchObject({
        method: 'POST',
        path: '/users',
        metadata: { description: 'Create user' }
      });
    });
  });
});