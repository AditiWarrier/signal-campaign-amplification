const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

test('server/index.js startup serves the auth diagnostic contract in health and response headers', async (t) => {
  const projectRoot = path.resolve(__dirname, '../..');
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'signal-api-startup-'));
  const port = await reservePort();
  const env = { ...process.env, SIGNAL_API_PORT: String(port), SIGNAL_DATA_FILE: path.join(temporaryDirectory, 'state.json'), NODE_ENV: 'test' };
  for (const key of Object.keys(env)) {
    if (/SUPABASE|EXPO_PUBLIC/i.test(key)) delete env[key];
  }
  const child = spawn(process.execPath, [path.join(projectRoot, 'server', 'index.js')], {
    cwd: temporaryDirectory,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      child.once('exit', resolve);
      setTimeout(resolve, 1000).unref();
    });
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`SIGNAL API did not start. ${stderr}`)), 5000);
    const onOutput = () => {
      if (!stdout.includes(`port ${port};`)) return;
      clearTimeout(timeout);
      resolve();
    };
    child.stdout.on('data', onOutput);
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => {
      if (code !== 0) { clearTimeout(timeout); reject(new Error(`SIGNAL API exited before listening. ${stderr}`)); }
    });
  });

  assert.ok(stdout.includes(`entrypoint: ${path.join(projectRoot, 'server', 'index.js')}`));
  assert.ok(stdout.includes(`app module: ${path.join(projectRoot, 'server', 'app.js')}`));
  assert.ok(stdout.includes('auth contract: auth-diagnostics-v1'));
  assert.ok(stdout.includes(`pid: ${child.pid}`));
  assert.ok(stdout.includes(`cwd: ${temporaryDirectory}`));

  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-SIGNAL-API-Contract'), 'auth-diagnostics-v1');
  const health = await response.json();
  assert.equal(health.ok, true);
  assert.equal(health.service, 'signal-api');
  assert.equal(health.contract, 'auth-diagnostics-v1');
  assert.ok(['supabase', 'unconfigured'].includes(health.persistence));
  const startupDriver = stdout.match(/campaign storage driver: (supabase|unconfigured)/)?.[1];
  assert.equal(health.persistence, startupDriver);
});
