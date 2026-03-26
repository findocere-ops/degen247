module.exports = {
  apps: [{
    name: "degen247",
    script: "dist/index.js",
    cwd: "/home/findo/degen247",
    autorestart: true,
    max_memory_restart: "200M",
    watch: ["user-config.json"],
    cron_restart: "0 4 * * *",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    error_file: "logs/error.log",
    out_file: "logs/out.log"
  }]
};
