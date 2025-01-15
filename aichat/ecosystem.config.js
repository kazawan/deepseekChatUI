module.exports = {
  apps: [{
    name: 'frontend',
    script: 'serve',
    env: {
      PM2_SERVE_PATH: './dist',
      PM2_SERVE_PORT: 3030,
      PM2_SERVE_SPA: true,
      PM2_SERVE_BASIC_AUTH: true,
      PM2_SERVE_BASIC_AUTH_USER: 'admin',
      PM2_SERVE_BASIC_AUTH_PASS: 'admin'
    }
  }]
} 