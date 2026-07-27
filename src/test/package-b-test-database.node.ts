import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { Client, type ClientConfig, type QueryResultRow } from "pg";

import { PrismaClient } from "@/generated/prisma/client";

export const PACKAGE_B_TEST_DATABASE_FINGERPRINT =
  "SIST_PACKAGE_B_ISOLATED_TEST_DATABASE_V1";

export const PACKAGE_B_EXPECTED_MIGRATIONS = [
  "20260720144407_init_database",
  "20260721120000_phase_3_authentication",
  "20260722125928_phase_3_2_student_registry",
  "20260727120000_v2_3_add_staff_role",
  "20260727121000_v2_3_capability_session_foundation",
  "20260727122000_v2_3_development_admin_capability_backfill",
] as const;

export type PackageBTestDatabaseEnvironment = Readonly<
  Partial<
    Record<
      | "NODE_ENV"
      | "RUN_PACKAGE_B_POSTGRES_INTEGRATION"
      | "DATABASE_URL"
      | "DIRECT_URL"
      | "TEST_DATABASE_URL",
      string | undefined
    >
  >
>;

type FingerprintRow = QueryResultRow & { fingerprint: string | null };
type MigrationRow = QueryResultRow & {
  migrationName: string;
  finished: boolean;
  rolledBack: boolean;
};
type EffectiveConnectionTarget = {
  host: string;
  port: number;
  database: string;
};
type PackageBPostgresClientConfiguration = ClientConfig & {
  ssl: { readonly rejectUnauthorized: true };
  sslnegotiation?: "postgres" | "direct";
};
type ParsedConnectionConfiguration = {
  client: PackageBPostgresClientConfiguration;
  target: EffectiveConnectionTarget;
};
type VerifiedConnectionConfiguration = {
  testClient: PackageBPostgresClientConfiguration;
  testTarget: EffectiveConnectionTarget;
};
type ReadOnlyDatabaseProbe = {
  connect: () => Promise<void>;
  queryRows: <Row extends QueryResultRow>(sql: string) => Promise<Row[]>;
  close: () => Promise<void>;
};
type PackageBTestDatabaseDependencies = {
  createReadOnlyProbe: (
    configuration: PackageBPostgresClientConfiguration,
  ) => ReadOnlyDatabaseProbe;
  createMutableClient: (
    configuration: PackageBPostgresClientConfiguration,
  ) => PrismaClient;
};

const allowedConnectionParameters = new Set(["sslmode", "sslnegotiation"]);
const rejectedRoutingParameters = new Set([
  "host",
  "hostaddr",
  "port",
  "database",
  "dbname",
  "user",
  "password",
  "service",
  "servicefile",
  "options",
]);

declare const verifiedPackageBTestDatabaseBrand: unique symbol;

export type VerifiedPackageBTestDatabaseClient = PrismaClient & {
  readonly [verifiedPackageBTestDatabaseBrand]: true;
};

export type VerifiedPackageBTestDatabase = {
  database: VerifiedPackageBTestDatabaseClient;
  openIndependentConnection: () => Promise<VerifiedPackageBTestDatabaseClient>;
  closeIndependentConnection: (
    database: VerifiedPackageBTestDatabaseClient,
  ) => Promise<void>;
  close: () => Promise<void>;
};

export type PackageBTestDatabaseReadiness =
  | { ready: true; verified: VerifiedPackageBTestDatabase }
  | {
      ready: false;
      reason: "NOT_APPROVED_OR_CONFIGURED" | "ISOLATION_NOT_VERIFIED";
    };

function hasSafeQueryParameters(parsed: URL): boolean {
  const seen = new Set<string>();
  for (const [parameter, value] of parsed.searchParams) {
    if (
      seen.has(parameter) ||
      rejectedRoutingParameters.has(parameter) ||
      !allowedConnectionParameters.has(parameter) ||
      (parameter === "sslmode" && value !== "verify-full") ||
      (parameter === "sslnegotiation" &&
        value !== "postgres" &&
        value !== "direct")
    ) {
      return false;
    }
    seen.add(parameter);
  }
  return seen.has("sslmode");
}

function parseVerifiedConnectionConfiguration(
  value: string | undefined,
): ParsedConnectionConfiguration | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") ||
      !parsed.hostname ||
      parsed.pathname.length <= 1 ||
      parsed.hash ||
      !hasSafeQueryParameters(parsed)
    ) {
      return null;
    }

    // Client construction applies the exact connection-string parsing semantics
    // used by the installed node-postgres driver without opening a connection.
    const driverConfiguration = new Client({ connectionString: value });
    if (
      !driverConfiguration.host ||
      !driverConfiguration.database ||
      !Number.isSafeInteger(driverConfiguration.port)
    ) {
      return null;
    }

    const sslnegotiation = parsed.searchParams.get("sslnegotiation");
    const client: PackageBPostgresClientConfiguration = {
      host: driverConfiguration.host,
      port: driverConfiguration.port,
      database: driverConfiguration.database,
      user: driverConfiguration.user,
      password: driverConfiguration.password,
      ssl: { rejectUnauthorized: true },
      ...(sslnegotiation
        ? { sslnegotiation: sslnegotiation as "postgres" | "direct" }
        : {}),
    };
    const effectiveDriverConfiguration = new Client(client) as Client & {
      enableChannelBinding: boolean;
      ssl: false | { rejectUnauthorized?: boolean };
    };
    if (
      !effectiveDriverConfiguration.ssl ||
      effectiveDriverConfiguration.ssl.rejectUnauthorized !== true ||
      effectiveDriverConfiguration.enableChannelBinding
    ) {
      return null;
    }

    return {
      client,
      target: {
        host: effectiveDriverConfiguration.host.toLowerCase(),
        port: effectiveDriverConfiguration.port,
        database: effectiveDriverConfiguration.database!,
      },
    };
  } catch {
    return null;
  }
}

function targetsMatch(
  left: EffectiveConnectionTarget,
  right: EffectiveConnectionTarget,
): boolean {
  return (
    left.host === right.host &&
    left.port === right.port &&
    left.database === right.database
  );
}

function resolveVerifiedConnectionConfiguration(
  environment: PackageBTestDatabaseEnvironment,
): VerifiedConnectionConfiguration | null {
  if (
    environment.NODE_ENV !== "test" ||
    environment.RUN_PACKAGE_B_POSTGRES_INTEGRATION !== "true"
  ) {
    return null;
  }

  const testConfiguration = parseVerifiedConnectionConfiguration(
    environment.TEST_DATABASE_URL,
  );
  const developmentConfiguration = parseVerifiedConnectionConfiguration(
    environment.DATABASE_URL,
  );
  const directConfiguration = parseVerifiedConnectionConfiguration(
    environment.DIRECT_URL,
  );
  if (!testConfiguration || !developmentConfiguration || !directConfiguration) {
    return null;
  }
  if (
    targetsMatch(testConfiguration.target, developmentConfiguration.target) ||
    targetsMatch(testConfiguration.target, directConfiguration.target)
  ) {
    return null;
  }
  return {
    testClient: testConfiguration.client,
    testTarget: testConfiguration.target,
  };
}

export function hasPackageBTestDatabaseConfiguration(
  environment: PackageBTestDatabaseEnvironment,
): boolean {
  return resolveVerifiedConnectionConfiguration(environment) !== null;
}

function createNodePostgresReadOnlyProbe(
  configuration: PackageBPostgresClientConfiguration,
): ReadOnlyDatabaseProbe {
  const client = new Client(configuration);
  return {
    connect: async () => {
      await client.connect();
    },
    queryRows: async <Row extends QueryResultRow>(sql: string) =>
      (await client.query<Row>(sql)).rows,
    close: async () => {
      await client.end();
    },
  };
}

function createPackageBPrismaClient(
  configuration: PackageBPostgresClientConfiguration,
): PrismaClient {
  const adapter = new PrismaPg(configuration);
  return new PrismaClient({ adapter });
}

const defaultDependencies: PackageBTestDatabaseDependencies = {
  createReadOnlyProbe: createNodePostgresReadOnlyProbe,
  createMutableClient: createPackageBPrismaClient,
};

async function closeProbeWithoutExposure(
  probe: ReadOnlyDatabaseProbe,
): Promise<void> {
  try {
    await probe.close();
  } catch {
    // Connection and provider details must not cross this boundary.
  }
}

async function disconnectWithoutExposure(
  database: PrismaClient,
): Promise<void> {
  try {
    await database.$disconnect();
  } catch {
    // Connection and provider details must not cross this boundary.
  }
}

async function verifyTestDatabaseFingerprintAndMigrations(
  testClient: PackageBPostgresClientConfiguration,
  dependencies: PackageBTestDatabaseDependencies,
): Promise<boolean> {
  const probe = dependencies.createReadOnlyProbe(testClient);
  try {
    await probe.connect();
    const fingerprintRows = await probe.queryRows<FingerprintRow>(`
      SELECT "fingerprint"
      FROM public.sist_test_database_fingerprint
    `);
    if (
      fingerprintRows.length !== 1 ||
      fingerprintRows[0]?.fingerprint !== PACKAGE_B_TEST_DATABASE_FINGERPRINT
    ) {
      return false;
    }

    const migrationRows = await probe.queryRows<MigrationRow>(`
      SELECT
        "migration_name" AS "migrationName",
        "finished_at" IS NOT NULL AS "finished",
        "rolled_back_at" IS NOT NULL AS "rolledBack"
      FROM "_prisma_migrations"
      ORDER BY "started_at" ASC, "migration_name" ASC
    `);
    return (
      migrationRows.length === PACKAGE_B_EXPECTED_MIGRATIONS.length &&
      migrationRows.every(
        (row, index) =>
          row.migrationName === PACKAGE_B_EXPECTED_MIGRATIONS[index] &&
          row.finished &&
          !row.rolledBack,
      )
    );
  } catch {
    return false;
  } finally {
    await closeProbeWithoutExposure(probe);
  }
}

async function openVerifiedConnection(
  environment: PackageBTestDatabaseEnvironment,
  dependencies: PackageBTestDatabaseDependencies,
  expectedTarget?: EffectiveConnectionTarget,
): Promise<{
  database: VerifiedPackageBTestDatabaseClient;
  configuration: VerifiedConnectionConfiguration;
}> {
  const configuration = resolveVerifiedConnectionConfiguration(environment);
  if (
    !configuration ||
    (expectedTarget &&
      !targetsMatch(configuration.testTarget, expectedTarget)) ||
    !(await verifyTestDatabaseFingerprintAndMigrations(
      configuration.testClient,
      dependencies,
    ))
  ) {
    throw new Error("Isolated Package B test database could not be verified.");
  }

  try {
    return {
      database: dependencies.createMutableClient(
        configuration.testClient,
      ) as VerifiedPackageBTestDatabaseClient,
      configuration,
    };
  } catch {
    throw new Error("Isolated Package B test database could not be opened.");
  }
}

export async function tryOpenPackageBTestDatabase(
  environment: PackageBTestDatabaseEnvironment,
  dependencies: PackageBTestDatabaseDependencies = defaultDependencies,
): Promise<PackageBTestDatabaseReadiness> {
  if (!hasPackageBTestDatabaseConfiguration(environment)) {
    return { ready: false, reason: "NOT_APPROVED_OR_CONFIGURED" };
  }

  let opened: Awaited<ReturnType<typeof openVerifiedConnection>>;
  try {
    opened = await openVerifiedConnection(environment, dependencies);
  } catch {
    return { ready: false, reason: "ISOLATION_NOT_VERIFIED" };
  }

  let closed = false;
  return {
    ready: true,
    verified: {
      database: opened.database,
      openIndependentConnection: async () =>
        (
          await openVerifiedConnection(
            environment,
            dependencies,
            opened.configuration.testTarget,
          )
        ).database,
      closeIndependentConnection: disconnectWithoutExposure,
      close: async () => {
        if (closed) return;
        await disconnectWithoutExposure(opened.database);
        closed = true;
      },
    },
  };
}
