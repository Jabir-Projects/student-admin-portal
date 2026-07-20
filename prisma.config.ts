import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: path.join(projectRoot, ".env.local"),
  quiet: true,
});

export default defineConfig({
  schema: path.join(projectRoot, "prisma/schema.prisma"),
  migrations: {
    path: path.join(projectRoot, "prisma/migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
