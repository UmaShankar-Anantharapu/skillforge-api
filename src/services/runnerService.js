const { spawn } = require('child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('fs');
const os = require('os');
const path = require('path');

function runNodeSandboxed(code, timeoutMs = 2000) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sf-run-'));
  const file = path.join(dir, 'snippet.mjs');
  writeFileSync(file, code, 'utf8');
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, ['--no-deprecation', '--disallow-code-generation-from-strings', file], {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { NODE_OPTIONS: '--no-expose-internals' },
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve({ stdout, stderr: stderr + '\n[Timeout]' });
    }, timeoutMs);
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', () => {
      clearTimeout(timer);
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
      resolve({ stdout, stderr });
    });
  });
}

module.exports = { runNodeSandboxed };


