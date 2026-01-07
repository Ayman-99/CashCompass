module.exports = {
  apps: [{
    name: 'finance-app-backend',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 9001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 9001
    },
    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    // Auto restart
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    // Health check
    min_uptime: '10s',
    max_restarts: 10
  }]
}

