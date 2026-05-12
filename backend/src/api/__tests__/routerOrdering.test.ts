import express, { Router } from 'express';
import http from 'http';

describe('API router ordering', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../server/public.router');
    jest.dontMock('../server/platform.router');
    jest.dontMock('../server/tenant.router');
  });

  it('routes tenant requests before root-mounted platform guards', async () => {
    jest.resetModules();

    const publicRouter = Router();

    const platformRouter = Router();
    platformRouter.use((req, res) => {
      res.status(403).json({ success: false, message: 'Forbidden: SUPER_ADMIN access required' });
    });

    const tenantRouter = Router();
    tenantRouter.get('/company-admin/modules', (req, res) => {
      res.json({ success: true, data: [] });
    });

    jest.doMock('../server/public.router', () => ({ __esModule: true, default: publicRouter }));
    jest.doMock('../server/platform.router', () => ({ __esModule: true, default: platformRouter }));
    jest.doMock('../server/tenant.router', () => ({ __esModule: true, default: tenantRouter }));

    const { default: router } = await import('../server/router');
    const app = express();
    app.use('/api/v1', router);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/tenant/company-admin/modules`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ success: true, data: [] });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
