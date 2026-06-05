// Carrega DATABASE_URL de .env (que está no .gitignore).
// Em produção (Easypanel), defina DATABASE_URL direto no ambiente do PM2/systemd.
const fs = require('fs');
const path = require('path');

function loadDotenv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && process.env[m[1]] === undefined) out[m[1]] = m[2];
  }
  return out;
}

const fileEnv = loadDotenv(path.resolve(__dirname, '.env'));

module.exports = {
  apps: [{
    name: 'waba-engine',
    script: 'dist/server.js',
    cwd: '/root/boilerplate-project',
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
      ...fileEnv,
    },
    max_memory_restart: '500M',
    out_file: '/root/boilerplate-project/logs/out.log',
    error_file: '/root/boilerplate-project/logs/err.log',
    merge_logs: true,
    time: true,
  }]
};
