import { createPrismaClient } from "../src/server/db/factory.node";
import { databaseEnv } from "../src/server/db/env.node";

const db = createPrismaClient(databaseEnv.DATABASE_URL);

const checks = [
  [
    "unsupportedAcademicYears",
    `SELECT count(*)::int AS count FROM "StudentProfile" WHERE "academicYear" NOT IN (1, 2, 3)`,
  ],
  [
    "normalizedEmailCollisions",
    `SELECT count(*)::int AS count FROM (SELECT lower(btrim("email")) FROM "User" GROUP BY lower(btrim("email")) HAVING count(*) > 1) AS collisions`,
  ],
  [
    "normalizedStudentNumberCollisions",
    `SELECT count(*)::int AS count FROM (SELECT upper(btrim("studentNumber")) FROM "StudentProfile" GROUP BY upper(btrim("studentNumber")) HAVING count(*) > 1) AS collisions`,
  ],
  [
    "unnormalizedEmails",
    `SELECT count(*)::int AS count FROM "User" WHERE "email" <> lower(btrim("email"))`,
  ],
  [
    "unnormalizedStudentNumbers",
    `SELECT count(*)::int AS count FROM "StudentProfile" WHERE "studentNumber" <> upper(btrim("studentNumber"))`,
  ],
] as const;

try {
  for (const [label, query] of checks) {
    const rows = await db.$queryRawUnsafe<Array<{ count: number }>>(query);
    console.log(`${label}=${rows[0]?.count ?? 0}`);
  }
} finally {
  await db.$disconnect();
}
