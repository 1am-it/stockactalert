import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Dev-only middleware that serves /api/* through the real Vercel Edge
// Function handlers in api/, without needing `vercel dev` (incompatible
// with this Vite major as of 2026-07) or a plain `node script.mjs` runner
// (Node's strict ESM loader rejects the bare `import x from './x.json'`
// form that src/lib/sectors.js deliberately uses — that form is required
// there because Vercel's esbuild Edge bundler rejects the `with { type:
// 'json' }` attribute in production; see that file's comment before
// "fixing" it).
//
// This works because `server.ssrLoadModule` runs the request through
// Vite's own transform pipeline (which already handles the bare JSON
// import correctly — same reason api/trades.js's transitive sectors.js
// import works fine in the browser via plain `vite dev`), so no source
// change is needed to get real API responses locally.
//
// `apply: 'serve'` — dev only. Production still uses real Vercel Edge
// Functions; this plugin never runs during `vite build`.
function apiDevMiddleware() {
  return {
    name: 'api-dev-middleware',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();

        const [pathname, search] = req.url.split('?');
        // Try /api/foo.js, then /api/foo/index.js.
        const candidates = [
          resolve(process.cwd(), `.${pathname}.js`),
          resolve(process.cwd(), `.${pathname}/index.js`),
        ];
        const filePath = candidates.find((p) => existsSync(p));
        if (!filePath) return next();

        try {
          const mod = await server.ssrLoadModule(filePath);
          const handler = mod.default;
          if (typeof handler !== 'function') return next();

          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;

          const webReq = new Request(`http://localhost${pathname}${search ? `?${search}` : ''}`, {
            method: req.method,
            headers: req.headers,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
          });

          const webRes = await handler(webReq);
          res.statusCode = webRes.status;
          webRes.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await webRes.arrayBuffer()));
        } catch (err) {
          console.error(`[api-dev-middleware] ${pathname} failed:`, err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(err?.message || err) }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiDevMiddleware()],
})
