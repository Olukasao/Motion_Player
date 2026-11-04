module.exports = {
  apps: [{
    name: 'motion-player',
    cwd: __dirname,
    script: './server.cjs',
    instances: 1,
    autorestart: true,
    max_memory_restart: '150M',
    env: { NODE_ENV: 'production', HOST: '0.0.0.0', PORT: '9540' }
  }]
};
