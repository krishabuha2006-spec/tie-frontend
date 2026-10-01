import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-spec-compatibility-handler',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // 1. Alias /api/auth/refresh to /api/auth/refresh-token
          if (req.url === '/api/auth/refresh') {
            req.url = '/api/auth/refresh-token';
          }

          // 2. Alias /api/users/profile to /api/auth/me
          if (req.url === '/api/users/profile' || req.url?.startsWith('/api/users/profile?')) {
            req.url = req.url.replace('/api/users/profile', '/api/auth/me');
          }

          // 3. Mock/Fallback for select-company if backend session not multi-tenant
          if (req.url === '/api/auth/select-company' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
              let parsed = {};
              try { parsed = JSON.parse(body); } catch {}
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                message: 'Active company switched successfully',
                data: {
                  companyId: parsed.companyId || parsed.company,
                },
              }));
            });
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'https://tie-backend-ruddy.vercel.app',
        changeOrigin: true,
        secure: false,
        timeout: 60000,
        proxyTimeout: 60000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.warn('[Vite Proxy]:', err.message);
          });
        },
      },
    },
  },
})
