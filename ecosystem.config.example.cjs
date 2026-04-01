module.exports = {
  apps: [
    {
      name: "9router",
      cwd: "/var/www/app.example.com",
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: "20128",
        HOSTNAME: "0.0.0.0",
        BASE_URL: "http://127.0.0.1:20128",
        NEXT_PUBLIC_BASE_URL: "https://app.example.com",
      },
    },
  ],
};
