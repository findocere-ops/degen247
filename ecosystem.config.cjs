module.exports = {
  apps: [{
    name: 'degen247',
    script: 'dist/index.js',
    autorestart: true,
    max_memory_restart: '1500M',
    restart_delay: 5000,
    max_restarts: 20,
    min_uptime: '10s',
    cron_restart: '0 23 * * *',  // daily 6am GMT+7 (23:00 UTC) restart clears memory leaks
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    watch: ['user-config.json'],
    watch_delay: 2000,
    ignore_watch: ['node_modules', 'logs', 'data', '.git', 'dist'],
  }],
};
