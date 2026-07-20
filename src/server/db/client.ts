import { databaseEnv } from "@/server/db/env";
import { createPrismaClient } from "@/server/db/factory";

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const db =
  globalForPrisma.prisma ?? createPrismaClient(databaseEnv.DATABASE_URL);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
