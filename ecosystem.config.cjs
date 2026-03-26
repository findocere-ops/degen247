module.exports = {
  apps: [{
    name: 'degen247',
    script: 'dist/index.js',
    max_memory_restart: '1800M',
    restart_delay: 5000,
    max_restarts: 10,
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    watch: ['user-config.json'],
    watch_delay: 1000,
    ignore_watch: ['node_modules', 'logs', 'data', '.git'],
  }],
};
