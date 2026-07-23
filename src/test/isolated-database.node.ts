import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/server/db/factory.node";

export type TestDatabaseEnvironment = Readonly<
  Partial<
    Record<
      "NODE_ENV" | "DATABASE_URL" | "TEST_DATABASE_URL",
      string | undefined
    >
  >
>;

type DatabaseIdentityRow = {
  databaseName: string;
  databaseOid: bigint;
  systemIdentifier: string | null;
};

type DatabaseIdentity = {
  databaseName: string;
  databaseOid: string;
  systemIdentifier: string;
};

declare const verifiedTestDatabaseClientBrand: unique symbol;

export type VerifiedTestDatabaseClient = PrismaClient & {
  readonly [verifiedTestDatabaseClientBrand]: true;
};

export type ApplicationModelCounts = {
  user: number;
  studentProfile: number;
  studentRegistry: number;
  requestCategory: number;
  documentRequest: number;
  documentRequestStatusHistory: number;
  message: number;
  notification: number;
  auditLog: number;
};

export type VerifiedIsolatedTestDatabase = {
  database: VerifiedTestDatabaseClient;
  close: () => Promise<void>;
};

const invalidConfigurationMessage =
  "Isolated test database configuration is unavailable.";
const unverifiedIdentityMessage =
  "Isolated test database identity could not be verified.";
const closeFailureMessage = "Isolated test database could not be closed.";
const countFailureMessage = "Isolated test database counts are unavailable.";

function isPostgreSqlConnectionString(value: string | undefined): boolean {
  if (!value) return false;

  try {
    const protocol = new URL(value).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  } catch {
    return false;
  }
}

export function hasIsolatedTestDatabaseConfiguration(
  environment: TestDatabaseEnvironment,
): boolean {
  return Boolean(
    environment.NODE_ENV === "test" &&
    isPostgreSqlConnectionString(environment.DATABASE_URL) &&
    isPostgreSqlConnectionString(environment.TEST_DATABASE_URL) &&
    environment.DATABASE_URL !== environment.TEST_DATABASE_URL,
  );
}

async function readDatabaseIdentity(
  database: PrismaClient,
): Promise<DatabaseIdentity> {
  const rows = await database.$queryRaw<DatabaseIdentityRow[]>`
    SELECT
      current_database() AS "databaseName",
      (
        SELECT oid::bigint
        FROM pg_database
        WHERE datname = current_database()
      ) AS "databaseOid",
      (
        SELECT system_identifier::text
        FROM pg_control_system()
      ) AS "systemIdentifier"
  `;
  const row = rows[0];
  if (
    !row?.databaseName ||
    row.databaseOid === null ||
    row.databaseOid === undefined ||
    !row.systemIdentifier
  ) {
    throw new Error(unverifiedIdentityMessage);
  }

  return {
    databaseName: row.databaseName,
    databaseOid: String(row.databaseOid),
    systemIdentifier: row.systemIdentifier,
  };
}

function identitiesAreDistinct(
  development: DatabaseIdentity,
  test: DatabaseIdentity,
): boolean {
  return (
    development.systemIdentifier !== test.systemIdentifier ||
    development.databaseName !== test.databaseName ||
    development.databaseOid !== test.databaseOid
  );
}

async function disconnectWithoutExposure(
  database: PrismaClient,
): Promise<void> {
  try {
    await database.$disconnect();
  } catch {
    // Connection details and provider errors must not cross the test boundary.
  }
}

export async function openVerifiedIsolatedTestDatabase(
  environment: TestDatabaseEnvironment,
): Promise<VerifiedIsolatedTestDatabase> {
  if (!hasIsolatedTestDatabaseConfiguration(environment)) {
    throw new Error(invalidConfigurationMessage);
  }

  let development: PrismaClient | undefined;
  let test: PrismaClient | undefined;

  try {
    development = createPrismaClient(environment.DATABASE_URL!);
    test = createPrismaClient(environment.TEST_DATABASE_URL!);
    const developmentIdentity = await readDatabaseIdentity(development);
    const testIdentity = await readDatabaseIdentity(test);
    if (!identitiesAreDistinct(developmentIdentity, testIdentity)) {
      throw new Error(unverifiedIdentityMessage);
    }
    await development.$disconnect();
    development = undefined;
  } catch {
    if (test) await disconnectWithoutExposure(test);
    throw new Error(unverifiedIdentityMessage);
  } finally {
    if (development) await disconnectWithoutExposure(development);
  }

  if (!test) throw new Error(unverifiedIdentityMessage);
  const verifiedTest = test;
  let closed = false;
  let closingPromise: Promise<void> | undefined;
  return {
    database: verifiedTest as VerifiedTestDatabaseClient,
    close: async () => {
      if (closed) return;
      if (closingPromise) return closingPromise;

      closingPromise = (async () => {
        try {
          await verifiedTest.$disconnect();
          closed = true;
        } catch {
          throw new Error(closeFailureMessage);
        } finally {
          closingPromise = undefined;
        }
      })();
      return closingPromise;
    },
  };
}

export async function readApplicationModelCounts(
  database: VerifiedTestDatabaseClient,
): Promise<ApplicationModelCounts> {
  try {
    const [
      user,
      studentProfile,
      studentRegistry,
      requestCategory,
      documentRequest,
      documentRequestStatusHistory,
      message,
      notification,
      auditLog,
    ] = await Promise.all([
      database.user.count(),
      database.studentProfile.count(),
      database.studentRegistry.count(),
      database.requestCategory.count(),
      database.documentRequest.count(),
      database.requestStatusHistory.count(),
      database.requestMessage.count(),
      database.notification.count(),
      database.auditLog.count(),
    ]);

    return {
      user,
      studentProfile,
      studentRegistry,
      requestCategory,
      documentRequest,
      documentRequestStatusHistory,
      message,
      notification,
      auditLog,
    };
  } catch {
    throw new Error(countFailureMessage);
  }
}
