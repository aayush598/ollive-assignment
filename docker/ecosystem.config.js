module.exports = {
  apps: [
    {
      name: "llm-inference-logger",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "1G",
      restart_delay: 5000,
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
      listen_timeout: 10000,
      kill_timeout: 5000,
      error_file: "/tmp/pm2-error.log",
      out_file: "/tmp/pm2-out.log",
      merge_logs: true,
      log_type: "json",
    },
  ],
};
