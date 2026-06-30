module.exports = {
  apps: [
    {
      name: '7alan-api',
      script: 'dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      kill_timeout: 10000,
      listen_timeout: 10000,
    },
  ],
};
