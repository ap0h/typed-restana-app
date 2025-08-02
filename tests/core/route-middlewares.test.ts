import request from 'supertest';
import { z } from 'zod';
import { TypeSafeApp } from '../../src/core/schema-types';
import { createTestApp } from '../test-utils';

describe('Route middlewares', () => {
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

  test('should execute middlewares before validation and modify req/res', async () => {
    const QuerySchema = z.object({
      token: z.string()
    });

    const mw = (req: any, res: any, next: any) => {
      req.query.token = 'from-middleware';
      (req as any).fromMw = true;
      res.setHeader('x-middleware', 'yes');
      next();
    };

    app.get('/with-mw', {
      schema: { query: QuerySchema },
      middlewares: [mw],
      handler: async ({ query, req }) => {
        return {
          token: query.token,
          fromMw: (req as any).fromMw
        };
      }
    });

    server = await app.start(0);
    const port = server.address().port;

    const res = await request(`http://localhost:${port}`)
      .get('/with-mw')
      .expect(200);

    expect(res.headers['x-middleware']).toBe('yes');
    expect(res.body).toEqual({ token: 'from-middleware', fromMw: true });
  });

  test('should apply middlewares only to configured routes', async () => {
    const QuerySchema = z.object({
      token: z.string()
    });

    const mw = (req: any, res: any, next: any) => {
      req.query.token = 'from-middleware';
      res.setHeader('x-middleware', 'yes');
      next();
    };

    app.get('/with-mw', {
      schema: { query: QuerySchema },
      middlewares: [mw],
      handler: async ({ query }) => ({ token: query.token })
    });

    app.get('/without-mw', {
      schema: { query: QuerySchema },
      handler: async ({ query }) => ({ token: query.token })
    });

    server = await app.start(0);
    const port = server.address().port;

    // Route without middleware should fail validation when token is missing
    await request(`http://localhost:${port}`)
      .get('/without-mw')
      .expect(400);

    // Route with middleware should inject token and set header
    const withMwRes = await request(`http://localhost:${port}`)
      .get('/with-mw')
      .expect(200);
    expect(withMwRes.headers['x-middleware']).toBe('yes');
    expect(withMwRes.body).toEqual({ token: 'from-middleware' });

    // Route without middleware succeeds when token provided but header is absent
    const withoutMwRes = await request(`http://localhost:${port}`)
      .get('/without-mw?token=client')
      .expect(200);
    expect(withoutMwRes.headers['x-middleware']).toBeUndefined();
    expect(withoutMwRes.body).toEqual({ token: 'client' });
  });
});

