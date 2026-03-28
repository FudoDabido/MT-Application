module.exports = {
  apps: [
    {
      name: 'mt',
      script: 'server/index.js',
      cwd: '/home/fudomt/MT-Application',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DB_PATH: '/mnt/hdd/mt-app/mt.db'
      },
      restart_delay: 3000,
      max_restarts: 10
    },
    {
      name: 'cloud',
      script: '/home/fudomt/cloud-server/server.js',
      cwd: '/home/fudomt/cloud-server',
      env: {
        NODE_ENV: 'production'
      },
      restart_delay: 3000,
      max_restarts: 10
    }
  ]
};
