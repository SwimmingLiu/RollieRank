import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('local preview serves the app and excludes source PDFs and repository files', async t => {
  const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: '4174' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => server.kill());
  await once(server.stdout, 'data', { signal: AbortSignal.timeout(5000) });
  for (const [path, type] of [['/', 'text/html'], ['/styles.css', 'text/css'], ['/src/app.js', 'text/javascript'], ['/src/data/papers.js', 'text/javascript'], ['/favicon.svg', 'image/svg+xml']]) {
    const response = await fetch('http://127.0.0.1:4174' + path);
    assert.equal(response.status, 200, path);
    assert.ok(response.headers.get('content-type').includes(type), path);
    assert.ok((await response.text()).length > 0, path);
  }
  for (const path of ['/.git/config', '/.raw/test.pdf', '/package.json', '/src/%2e%2e/package.json']) {
    assert.equal((await fetch('http://127.0.0.1:4174' + path)).status, 404, path);
  }
});
