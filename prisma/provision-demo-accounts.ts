import { createPrismaClient } from "../src/server/db/factory.node";
import { databaseEnv } from "../src/server/db/env.node";
import {
  AccountStatus,
  Capability,
  PreferredLanguage,
  UserRole,
} from "../src/generated/prisma/enums";
import { hashPassword } from "../src/server/auth/password.node";

const provisionedAt = new Date("2026-01-15T09:00:00.000Z");

const ids = {
  manager: "10000000-0000-4000-8000-000000000001",
  studentOne: "10000000-0000-4000-8000-000000000002",
  studentTwo: "10000000-0000-4000-8000-000000000003",
  reviewer: "10000000-0000-4000-8000-000000000004",
  pendingStudent: "10000000-0000-4000-8000-000000000005",
  disabledStudent: "10000000-0000-4000-8000-000000000006",
  financeStaff: "10000000-0000-4000-8000-000000000007",
  financeUploader: "10000000-0000-4000-8000-000000000008",
  financeApprover: "10000000-0000-4000-8000-000000000009",
  documentsStaff: "10000000-0000-4000-8000-000000000010",
  registryUploader: "10000000-0000-4000-8000-000000000011",
  registryApprover: "10000000-0000-4000-8000-000000000012",
  auditStaff: "10000000-0000-4000-8000-000000000013",
  zeroCapabilityStaff: "10000000-0000-4000-8000-000000000014",
} as const;

type DemoAccount = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  capabilities: readonly Capability[];
};

const accounts: readonly DemoAccount[] = [
  {
    id: ids.manager,
    email: "admin.dev@example.invalid",
    fullName: "Development Staff Manager",
    role: UserRole.STAFF,
    status: AccountStatus.ACTIVE,
    capabilities: Object.values(Capability),
  },
  {
    id: ids.reviewer,
    email: "reviewer.dev@example.invalid",
    fullName: "Development Staff Reviewer",
    role: UserRole.STAFF,
    status: AccountStatus.ACTIVE,
    capabilities: [
      Capability.REGISTRY_IMPORT_APPROVE,
      Capability.FINANCE_IMPORT_APPROVE,
    ],
  },
  {
    id: ids.studentOne,
    email: "student.one.dev@example.invalid",
    fullName: "Development Student One",
    role: UserRole.STUDENT,
    status: AccountStatus.ACTIVE,
    capabilities: [],
  },
  {
    id: ids.studentTwo,
    email: "student.two.dev@example.invalid",
    fullName: "Development Student Two",
    role: UserRole.STUDENT,
    status: AccountStatus.ACTIVE,
    capabilities: [],
  },
  {
    id: ids.pendingStudent,
    email: "student.pending.dev@example.invalid",
    fullName: "Development Pending Student",
    role: UserRole.STUDENT,
    status: AccountStatus.PENDING_APPROVAL,
    capabilities: [],
  },
  {
    id: ids.disabledStudent,
    email: "student.disabled.dev@example.invalid",
    fullName: "Development Disabled Student",
    role: UserRole.STUDENT,
    status: AccountStatus.DISABLED,
    capabilities: [],
  },
  {
    id: ids.financeStaff,
    email: "finance.staff.dev@example.invalid",
    fullName: "Development Finance Staff",
    role: UserRole.STAFF,
    status: AccountStatus.ACTIVE,
    capabilities: [
      Capability.FINANCE_IMPORT_UPLOAD,
      Capability.FINANCE_IMPORT_APPROVE,
      Capability.VIEW_FINANCE,
    ],
  },
  {
    id: ids.financeUploader,
    email: "finance.upload.dev@example.invalid",
    fullName: "Development Finance Uploader",
    role: UserRole.STAFF,
    status: AccountStatus.ACTIVE,
    capabilities: [Capability.FINANCE_IMPORT_UPLOAD],
  },
  {
    id: ids.financeApprover,
    email: "finance.approve.dev@example.invalid",
    fullName: "Development Finance Approver",
    role: UserRole.STAFF,
    status: AccountStatus.ACTIVE,
    capabilities: [Capability.FINANCE_IMPORT_APPROVE, Capability.VIEW_FINANCE],
  },
  {
    id: ids.documentsStaff,
    email: "documents.staff.dev@example.invalid",
    fullName: "Development Documents and Requests Staff",
    role: UserRole.STAFF,
    status: AccountStatus.ACTIVE,
    capabilities: [
      Capability.GENERATE_DOCUMENTS,
      Capability.RELEASE_DOCUMENTS,
      Capability.REVOKE_DOCUMENTS,
    ],
  },
  {
    id: ids.registryUploader,
    email: "registry.upload.dev@example.invalid",
    fullName: "Development Registry Uploader",
    role: UserRole.STAFF,
    status: AccountStatus.ACTIVE,
    capabilities: [Capability.REGISTRY_IMPORT_UPLOAD],
  },
  {
    id: ids.registryApprover,
    email: "registry.approve.dev@example.invalid",
    fullName: "Development Registry Approver",
    role: UserRole.STAFF,
    status: AccountStatus.ACTIVE,
    capabilities: [Capability.REGISTRY_IMPORT_APPROVE],
  },
  {
    id: ids.auditStaff,
    email: "audit.staff.dev@example.invalid",
    fullName: "Development Audit Staff",
    role: UserRole.STAFF,
    status: AccountStatus.ACTIVE,
    capabilities: [Capability.VIEW_AUDIT_LOG],
  },
  {
    id: ids.zeroCapabilityStaff,
    email: "zero.staff.dev@example.invalid",
    fullName: "Development Zero-Capability Staff",
    role: UserRole.STAFF,
    status: AccountStatus.ACTIVE,
    capabilities: [],
  },
];

function requireDemoPassword(): string {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password || password.length < 12 || password.length > 128) {
    throw new Error("Missing or invalid development demo account password.");
  }
  return password;
}

if (process.env.NODE_ENV === "production") {
  throw new Error(
    "Development demo account provisioning is disabled in production.",
  );
}
if (process.env.ALLOW_DEVELOPMENT_SEED !== "true") {
  throw new Error(
    "Development demo account provisioning requires explicit opt-in.",
  );
}

const prisma = createPrismaClient(databaseEnv.DATABASE_URL);

async function provision(): Promise<void> {
  const password = requireDemoPassword();
  const passwordHashes = new Map(
    await Promise.all(
      accounts.map(
        async (account) =>
          [account.email, await hashPassword(password)] as const,
      ),
    ),
  );
  await prisma.$transaction(async (transaction) => {
    for (const account of accounts) {
      const passwordHash = passwordHashes.get(account.email);
      if (!passwordHash) {
        throw new Error("Development demo account password setup failed.");
      }
      const existing = await transaction.user.findUnique({
        where: { email: account.email },
        select: { id: true },
      });
      const userId = existing?.id ?? account.id;

      if (existing) {
        await transaction.user.update({
          where: { id: userId },
          data: {
            fullName: account.fullName,
            passwordHash,
            role: account.role,
            status: account.status,
            preferredLanguage: PreferredLanguage.ENGLISH,
          },
        });
      } else {
        const conflictingId = await transaction.user.findUnique({
          where: { id: account.id },
          select: { id: true },
        });
        if (conflictingId) {
          throw new Error("Development demo fixture identifier conflict.");
        }
        await transaction.user.create({
          data: {
            id: account.id,
            email: account.email,
            fullName: account.fullName,
            passwordHash,
            role: account.role,
            status: account.status,
            preferredLanguage: PreferredLanguage.ENGLISH,
            createdAt: provisionedAt,
          },
        });
      }

      await transaction.userCapabilityAssignment.deleteMany({
        where: { userId },
      });
      if (account.capabilities.length > 0) {
        await transaction.userCapabilityAssignment.createMany({
          data: account.capabilities.map((capability) => ({
            userId,
            capability,
            grantedById: null,
          })),
        });
      }
    }
  });
}

try {
  await provision();
  console.info("Development demo account provisioning completed.");
} catch {
  console.error("Development demo account provisioning failed.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
