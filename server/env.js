const fs = require('node:fs');
const path = require('node:path');

// Load this SIGNAL project's Expo .env regardless of the shell's working
// directory. Explicit process environment values continue to take precedence.
function loadProjectEnv(filePath = path.resolve(__dirname, '..', '.env')) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || Object.hasOwn(process.env, match[1])) continue;
    const rawValue = match[2];
    const value = rawValue.startsWith('"') && rawValue.endsWith('"')
      ? rawValue.slice(1, -1)
      : rawValue.startsWith("'") && rawValue.endsWith("'")
        ? rawValue.slice(1, -1)
        : rawValue;
    process.env[match[1]] = value;
  }
}

module.exports = { loadProjectEnv };
