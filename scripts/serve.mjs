import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// URL directories end in a slash; normalize before checking containment so valid assets pass.
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };
const allowed = new Set(['/index.html', '/styles.css', '/favicon.svg']);

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const resource = pathname === '/' ? '/index.html' : pathname;
    if ((!allowed.has(resource) && !resource.startsWith('/src/')) || resource.split('/').some(part => part.startsWith('.'))) {
      response.writeHead(404).end('Not found');
      return;
    }
    const target = path.resolve(root, '.' + resource);
    if (!target.startsWith(root + path.sep) || !(await stat(target)).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`RollieRank is ready: http://127.0.0.1:${port}`));
