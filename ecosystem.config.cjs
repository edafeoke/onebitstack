const path = require("path");

/** PM2 config — loads .env from the app root so DATABASE_URL (MySQL) is always set. */
module.exports = {
  apps: [
    {
      name: "central-server",
      cwd: __dirname,
      script: "npm",
      args: "start",
      interpreter: "none",
      env_file: path.join(__dirname, ".env"),
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "central-deploy-worker",
      cwd: __dirname,
      script: "npm",
      args: "run worker:deploy",
      interpreter: "none",
      env_file: path.join(__dirname, ".env"),
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
