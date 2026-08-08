import { spawnSync } from "node:child_process";

import { config as loadEnvironment } from "dotenv";

loadEnvironment({ path: ".env.local", quiet: true });

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(args, environment = process.env) {
  const result = spawnSync(npmCommand, args, {
    env: environment,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["run", "build"]);
run(["run", "test:e2e"], {
  ...process.env,
  PLAYWRIGHT_USE_PRODUCTION_SERVER: "true",
});
