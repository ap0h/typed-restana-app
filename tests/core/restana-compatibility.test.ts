import request from 'supertest';
import { z } from 'zod';
import { TypeSafeApp } from '../../typed-restana-app/core/schema-types';
import { createTestApp } from '../test-utils';

describe('Restana Compatibility', () => {
  let app: TypeSafeApp;
  let server: any;

  beforeEach(() => {
    app = createTestApp({
      strict: false,
      validateResponses: false,
      logValidationErrors: false
    });
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

  describe('HTTP Methods', () => {
    test('should support all HTTP methods', async () => {
      const schema = {
        params: z.object({ id: z.coerce.number() }).optional()
      };

      // Test all HTTP methods
      app.get('/test', { handler: async () => ({ method: 'GET' }) });
      app.post('/test', { handler: async () => ({ method: 'POST' }) });
      app.put('/test', { handler: async () => ({ method: 'PUT' }) });
      app.patch('/test', { handler: async () => ({ method: 'PATCH' }) });
      app.delete('/test', { handler: async () => ({ method: 'DELETE' }) });
      app.head('/test', { handler: async () => ({ method: 'HEAD' }) });
      app.options('/test', { handler: async () => ({ method: 'OPTIONS' }) });

      server = await app.start(0);
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;

      // Test each method
      await request(baseUrl).get('/test').expect(200);
      await request(baseUrl).post('/test').expect(200);
      await request(baseUrl).put('/test').expect(200);
      await request(baseUrl).patch('/test').expect(200);
      await request(baseUrl).delete('/test').expect(200);
      await request(baseUrl).head('/test').expect(200);
      await request(baseUrl).options('/test').expect(200);
    });

    test('should support multiple paths for single route', async () => {
      // Test string array paths (Restana feature)
      app.get(['/health', '/status', '/ping'], {
        handler: async () => ({ status: 'OK' })
      });

      server = await app.start(0);
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;

      // All paths should work
      const response1 = await request(baseUrl).get('/health').expect(200);
      const response2 = await request(baseUrl).get('/status').expect(200);
      const response3 = await request(baseUrl).get('/ping').expect(200);

      expect(response1.body).toEqual({ status: 'OK' });
      expect(response2.body).toEqual({ status: 'OK' });
      expect(response3.body).toEqual({ status: 'OK' });
    });
  });

  describe('Middleware Support', () => {
    test('should support global middleware with use()', async () => {
      let middlewareCalled = false;

      // Global middleware
      app.use((req: any, res: any, next: any) => {
        middlewareCalled = true;
        req.customData = 'middleware-data';
        next();
      });

      app.get('/test', {
        handler: async (context: any) => {
          return { 
            middlewareCalled,
            customData: context.req.customData 
          };
        }
      });

      server = await app.start(0);
      const port = server.address().port;

      const response = await request(`http://localhost:${port}`)
        .get('/test')
        .expect(200);

      expect(response.body).toEqual({
        middlewareCalled: true,
        customData: 'middleware-data'
      });
    });

    test('should support prefixed middleware with use(prefix, middleware)', async () => {
      let apiMiddlewareCalled = false;

      // Prefixed middleware
      app.use('/api', (req: any, res: any, next: any) => {
        apiMiddlewareCalled = true;
        req.apiData = 'api-middleware';
        next();
      });

      app.get('/api/users', {
        handler: async (context: any) => {
          return { 
            apiMiddlewareCalled,
            apiData: context.req.apiData 
          };
        }
      });

      app.get('/other', {
        handler: async () => ({ apiMiddlewareCalled })
      });

      server = await app.start(0);
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;

      // API route should have middleware
      const apiResponse = await request(baseUrl)
        .get('/api/users')
        .expect(200);

      expect(apiResponse.body).toEqual({
        apiMiddlewareCalled: true,
        apiData: 'api-middleware'
      });

      // Reset flag
      apiMiddlewareCalled = false;

      // Other route should not have middleware
      const otherResponse = await request(baseUrl)
        .get('/other')
        .expect(200);

      expect(otherResponse.body).toEqual({
        apiMiddlewareCalled: false
      });
    });

    test('should support method chaining with middleware', () => {
      const result = app
        .use((req: any, res: any, next: any) => next())
        .get('/test1', { handler: async () => ({ test: 1 }) })
        .use('/api', (req: any, res: any, next: any) => next())
        .post('/test2', { handler: async () => ({ test: 2 }) });

      expect(result).toBe(app);
    });
  });

  describe('Service Methods', () => {
    test('should expose routes() method', () => {
      app.get('/test1', { handler: async () => ({}) });
      app.post('/test2', { handler: async () => ({}) });

      const routes = app.routes();
      expect(Array.isArray(routes)).toBe(true);
      expect(routes.length).toBeGreaterThanOrEqual(2);
    });

    test('should expose getRouter() method', () => {
      const router = app.getRouter();
      expect(router).toBeDefined();
    });

    test('should expose newRouter() method', () => {
      const router = app.newRouter();
      expect(router).toBeDefined();
    });

    test('should expose errorHandler property', () => {
      const originalHandler = app.errorHandler;
      expect(originalHandler).toBeDefined();

      // Test setting custom error handler
      const customHandler = (err: any, req: any, res: any, next: any) => {
        res.send({ error: 'Custom error' });
      };

      (app as any).errorHandler = customHandler;
      expect(app.errorHandler).toBe(customHandler);
    });

    test('should expose getServer() method after start', async () => {
      server = await app.start(0);
      
      const httpServer = app.getServer();
      expect(httpServer).toBeDefined();
      expect(httpServer.listening).toBe(true);
    });

    test('should expose getConfigOptions() method', () => {
      const config = app.getConfigOptions();
      expect(config).toBeDefined();
    });

    test('should expose handle() method', async () => {
      app.get('/test', { handler: async () => ({ message: 'handled' }) });

      // Mock request and response objects
      const mockReq = {
        method: 'GET',
        url: '/test',
        headers: {}
      } as any;

      const mockRes = {
        statusCode: 200,
        headersSent: false,
        setHeader: jest.fn(),
        writeHead: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        send: jest.fn()
      } as any;

      // This tests that handle method exists and can be called
      expect(() => app.handle(mockReq, mockRes)).not.toThrow();
    });

    test('should expose start() and close() methods', async () => {
      // Test start with default port
      server = await app.start();
      expect(server).toBeDefined();
      expect(server.listening).toBe(true);

      // Test close
      await app.close();
      expect(server.listening).toBe(false);

      // Reset for cleanup
      server = null;
    });

    test('should expose start() with custom port and host', async () => {
      server = await app.start(0, 'localhost');
      expect(server).toBeDefined();
      expect(server.listening).toBe(true);
      expect(['127.0.0.1', '::1']).toContain(server.address().address);
    });
  });

  describe('Custom Methods', () => {
    test('should expose getRoutes() method for typed routes', () => {
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

      const typedRoutes = app.getRoutes();

      expect(typedRoutes).toHaveLength(2);
      expect(typedRoutes[0]).toMatchObject({
        method: 'GET',
        path: '/users',
        metadata: { description: 'Get users' }
      });
      expect(typedRoutes[1]).toMatchObject({
        method: 'POST',
        path: '/users',
        metadata: { description: 'Create user' }
      });
    });
  });

  describe('Full Integration', () => {
    test('should work as a complete Restana replacement', async () => {
      // Set up like a normal Restana app
      app
        .use((req: any, res: any, next: any) => {
          req.startTime = Date.now();
          next();
        })
        .use('/api', (req: any, res: any, next: any) => {
          req.apiPrefix = true;
          next();
        })
        .get('/health', { 
          handler: async () => ({ status: 'OK', timestamp: new Date().toISOString() }) 
        })
        .get('/api/users', {
          schema: {
            query: z.object({
              search: z.string().optional(),
              limit: z.coerce.number().default(10)
            })
          },
          handler: async (context) => {
            return {
              users: [],
              query: context.query,
              processingTime: Date.now() - context.req.startTime,
              fromApi: context.req.apiPrefix
            };
          }
        })
        .post('/api/users', {
          schema: {
            body: z.object({
              name: z.string().min(1),
              email: z.string().email()
            })
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
      const baseUrl = `http://localhost:${port}`;

      // Test health endpoint
      const healthResponse = await request(baseUrl)
        .get('/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('OK');

      // Test API endpoints with middleware
      const usersResponse = await request(baseUrl)
        .get('/api/users?search=john&limit=5')
        .expect(200);

      expect(usersResponse.body).toMatchObject({
        users: [],
        query: { search: 'john', limit: 5 },
        fromApi: true
      });
      expect(usersResponse.body.processingTime).toBeGreaterThanOrEqual(0);

      // Test POST with validation
      const createResponse = await request(baseUrl)
        .post('/api/users')
        .send({
          name: 'John Doe',
          email: 'john@example.com'
        })
        .expect(200);

      expect(createResponse.body).toMatchObject({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      });
      expect(createResponse.body.created).toBeDefined();
    });
  });
});