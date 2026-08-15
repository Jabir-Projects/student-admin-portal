import { createPrismaClient } from "../src/server/db/factory.node";
import { databaseEnv } from "../src/server/db/env.node";
import {
  AcademicYear,
  AccountStatus,
  Capability,
  DeliveryMethod,
  MessageVisibility,
  PreferredLanguage,
  RequestStatus,
  UserRole,
} from "../src/generated/prisma/enums";
import { hashPassword, verifyPassword } from "../src/server/auth/password.node";
import { reconcileStudentRegistryDemo } from "./student-registry-demo";

const ids = {
  staff: "10000000-0000-4000-8000-000000000001",
  staffReviewer: "10000000-0000-4000-8000-000000000004",
  studentOne: "10000000-0000-4000-8000-000000000002",
  studentTwo: "10000000-0000-4000-8000-000000000003",
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
  profileOne: "20000000-0000-4000-8000-000000000001",
  profileTwo: "20000000-0000-4000-8000-000000000002",
  categoryTranscript: "30000000-0000-4000-8000-000000000001",
  categoryEnrollment: "30000000-0000-4000-8000-000000000002",
  categoryDiploma: "30000000-0000-4000-8000-000000000003",
  requestOne: "40000000-0000-4000-8000-000000000001",
  requestTwo: "40000000-0000-4000-8000-000000000002",
  historyOne: "50000000-0000-4000-8000-000000000001",
  historyTwo: "50000000-0000-4000-8000-000000000002",
  historyThree: "50000000-0000-4000-8000-000000000003",
  publicMessage: "60000000-0000-4000-8000-000000000001",
  internalMessage: "60000000-0000-4000-8000-000000000002",
  notificationOne: "70000000-0000-4000-8000-000000000001",
  notificationTwo: "70000000-0000-4000-8000-000000000002",
  financeAccountOne: "80000000-0000-4000-8000-000000000001",
  financeChargeOne: "80000000-0000-4000-8000-000000000002",
  financePaymentOne: "80000000-0000-4000-8000-000000000003",
} as const;

const seededAt = new Date("2026-01-15T09:00:00.000Z");

if (process.env.NODE_ENV === "production") {
  throw new Error("Development seed is disabled in production.");
}
if (process.env.ALLOW_DEVELOPMENT_SEED !== "true") {
  throw new Error("Development seed requires explicit opt-in.");
}

const prisma = createPrismaClient(databaseEnv.DATABASE_URL);

function requireSeedPassword(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 12 || value.length > 128) {
    throw new Error(
      `Missing or invalid development seed configuration: ${name}`,
    );
  }
  return value;
}

async function reusablePasswordHash(
  userId: string,
  password: string,
): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (existing && (await verifyPassword(existing.passwordHash, password)))
    return existing.passwordHash;
  return hashPassword(password);
}

type DemoUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  preferredLanguage: PreferredLanguage;
  capabilities: readonly Capability[];
};

async function reconcileDemoUser(
  user: DemoUser,
  password: string,
): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });
  const userId = existing?.id ?? user.id;
  const passwordHash = await reusablePasswordHash(userId, password);

  if (existing) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: user.fullName,
        passwordHash,
        role: user.role,
        status: user.status,
        preferredLanguage: user.preferredLanguage,
      },
    });
  } else {
    const conflictingId = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true },
    });
    if (conflictingId) {
      throw new Error("Development demo fixture identifier conflict.");
    }
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        passwordHash,
        role: user.role,
        status: user.status,
        preferredLanguage: user.preferredLanguage,
        createdAt: seededAt,
      },
    });
  }

  await prisma.userCapabilityAssignment.deleteMany({
    where: { userId },
  });
  if (user.capabilities.length > 0) {
    await prisma.userCapabilityAssignment.createMany({
      data: user.capabilities.map((capability) => ({
        userId,
        capability,
        grantedById: null,
      })),
    });
  }

  return userId;
}

async function reconcileStudentProfile(profile: {
  id: string;
  userId: string;
  studentNumber: string;
  program: string;
  academicYear: AcademicYear;
}): Promise<void> {
  const existing = await prisma.studentProfile.findUnique({
    where: { id: profile.id },
    select: { userId: true },
  });
  if (existing && existing.userId !== profile.userId) {
    throw new Error("Development student profile ownership conflict.");
  }
  await prisma.studentProfile.upsert({
    where: { id: profile.id },
    create: { ...profile, createdAt: seededAt },
    update: profile,
  });
}

async function seed(): Promise<void> {
  const demoPassword = requireSeedPassword("SEED_DEMO_PASSWORD");
  const users: readonly DemoUser[] = [
    {
      id: ids.staff,
      email: "admin.dev@example.invalid",
      fullName: "Development Staff Manager",
      role: UserRole.STAFF,
      status: AccountStatus.ACTIVE,
      preferredLanguage: PreferredLanguage.ENGLISH,
      capabilities: Object.values(Capability),
    },
    {
      id: ids.staffReviewer,
      email: "reviewer.dev@example.invalid",
      fullName: "Development Staff Reviewer",
      role: UserRole.STAFF,
      status: AccountStatus.ACTIVE,
      preferredLanguage: PreferredLanguage.ENGLISH,
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
      preferredLanguage: PreferredLanguage.FRENCH,
      capabilities: [],
    },
    {
      id: ids.studentTwo,
      email: "student.two.dev@example.invalid",
      fullName: "Development Student Two",
      role: UserRole.STUDENT,
      status: AccountStatus.ACTIVE,
      preferredLanguage: PreferredLanguage.ARABIC,
      capabilities: [],
    },
    {
      id: ids.pendingStudent,
      email: "student.pending.dev@example.invalid",
      fullName: "Development Pending Student",
      role: UserRole.STUDENT,
      status: AccountStatus.PENDING_APPROVAL,
      preferredLanguage: PreferredLanguage.ENGLISH,
      capabilities: [],
    },
    {
      id: ids.disabledStudent,
      email: "student.disabled.dev@example.invalid",
      fullName: "Development Disabled Student",
      role: UserRole.STUDENT,
      status: AccountStatus.DISABLED,
      preferredLanguage: PreferredLanguage.ENGLISH,
      capabilities: [],
    },
    {
      id: ids.financeStaff,
      email: "finance.staff.dev@example.invalid",
      fullName: "Development Finance Staff",
      role: UserRole.STAFF,
      status: AccountStatus.ACTIVE,
      preferredLanguage: PreferredLanguage.ENGLISH,
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
      preferredLanguage: PreferredLanguage.ENGLISH,
      capabilities: [Capability.FINANCE_IMPORT_UPLOAD],
    },
    {
      id: ids.financeApprover,
      email: "finance.approve.dev@example.invalid",
      fullName: "Development Finance Approver",
      role: UserRole.STAFF,
      status: AccountStatus.ACTIVE,
      preferredLanguage: PreferredLanguage.ENGLISH,
      capabilities: [
        Capability.FINANCE_IMPORT_APPROVE,
        Capability.VIEW_FINANCE,
      ],
    },
    {
      id: ids.documentsStaff,
      email: "documents.staff.dev@example.invalid",
      fullName: "Development Documents and Requests Staff",
      role: UserRole.STAFF,
      status: AccountStatus.ACTIVE,
      preferredLanguage: PreferredLanguage.ENGLISH,
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
      preferredLanguage: PreferredLanguage.ENGLISH,
      capabilities: [Capability.REGISTRY_IMPORT_UPLOAD],
    },
    {
      id: ids.registryApprover,
      email: "registry.approve.dev@example.invalid",
      fullName: "Development Registry Approver",
      role: UserRole.STAFF,
      status: AccountStatus.ACTIVE,
      preferredLanguage: PreferredLanguage.ENGLISH,
      capabilities: [Capability.REGISTRY_IMPORT_APPROVE],
    },
    {
      id: ids.auditStaff,
      email: "audit.staff.dev@example.invalid",
      fullName: "Development Audit Staff",
      role: UserRole.STAFF,
      status: AccountStatus.ACTIVE,
      preferredLanguage: PreferredLanguage.ENGLISH,
      capabilities: [Capability.VIEW_AUDIT_LOG],
    },
    {
      id: ids.zeroCapabilityStaff,
      email: "zero.staff.dev@example.invalid",
      fullName: "Development Zero-Capability Staff",
      role: UserRole.STAFF,
      status: AccountStatus.ACTIVE,
      preferredLanguage: PreferredLanguage.ENGLISH,
      capabilities: [],
    },
  ];

  const userIds = new Map<string, string>();
  for (const user of users) {
    userIds.set(user.email, await reconcileDemoUser(user, demoPassword));
  }

  const profiles = [
    {
      id: ids.profileOne,
      userId: userIds.get("student.one.dev@example.invalid")!,
      studentNumber: "DEV-STUDENT-001",
      program: "BAC+3 Software Engineering",
      academicYear: AcademicYear.YEAR_2,
    },
    {
      id: ids.profileTwo,
      userId: userIds.get("student.two.dev@example.invalid")!,
      studentNumber: "DEV-STUDENT-002",
      program: "BAC+5 Business Administration",
      academicYear: AcademicYear.YEAR_3,
    },
  ] as const;

  for (const profile of profiles) {
    await reconcileStudentProfile(profile);
  }

  const categories = [
    {
      id: ids.categoryTranscript,
      name: "Official Transcript",
      slug: "official-transcript",
      description: "Request an official academic transcript.",
    },
    {
      id: ids.categoryEnrollment,
      name: "Enrollment Certificate",
      slug: "enrollment-certificate",
      description: "Request proof of current enrollment.",
    },
    {
      id: ids.categoryDiploma,
      name: "Diploma Copy",
      slug: "diploma-copy",
      description: "Request an official copy of a diploma.",
    },
  ] as const;

  for (const category of categories) {
    await prisma.requestCategory.upsert({
      where: { id: category.id },
      create: { ...category, createdAt: seededAt },
      update: category,
    });
  }

  const requests = [
    {
      id: ids.requestOne,
      studentId: ids.profileOne,
      categoryId: ids.categoryTranscript,
      status: RequestStatus.UNDER_REVIEW,
      deliveryMethod: DeliveryMethod.DIGITAL_DELIVERY,
      copyCount: 1,
      details: "Development fixture for an active request.",
    },
    {
      id: ids.requestTwo,
      studentId: ids.profileTwo,
      categoryId: ids.categoryEnrollment,
      status: RequestStatus.SUBMITTED,
      deliveryMethod: DeliveryMethod.CAMPUS_PICKUP,
      copyCount: 2,
      details: "Development fixture for a submitted request.",
    },
  ] as const;

  for (const request of requests) {
    await prisma.documentRequest.upsert({
      where: { id: request.id },
      create: { ...request, createdAt: seededAt },
      update: request,
    });
  }

  await prisma.requestStatusHistory.createMany({
    data: [
      {
        id: ids.historyOne,
        requestId: ids.requestOne,
        fromStatus: null,
        toStatus: RequestStatus.SUBMITTED,
        changedById: ids.studentOne,
        note: "Development request submitted.",
        createdAt: seededAt,
      },
      {
        id: ids.historyTwo,
        requestId: ids.requestOne,
        fromStatus: RequestStatus.SUBMITTED,
        toStatus: RequestStatus.UNDER_REVIEW,
        changedById: ids.staff,
        note: "Development request entered review.",
        createdAt: new Date("2026-01-15T10:00:00.000Z"),
      },
      {
        id: ids.historyThree,
        requestId: ids.requestTwo,
        fromStatus: null,
        toStatus: RequestStatus.SUBMITTED,
        changedById: ids.studentTwo,
        note: "Development request submitted.",
        createdAt: new Date("2026-01-16T09:00:00.000Z"),
      },
    ],
    skipDuplicates: true,
  });

  await prisma.requestMessage.upsert({
    where: { id: ids.publicMessage },
    create: {
      id: ids.publicMessage,
      requestId: ids.requestOne,
      authorId: ids.staff,
      visibility: MessageVisibility.PUBLIC,
      body: "Your request is being reviewed.",
      createdAt: seededAt,
    },
    update: {
      visibility: MessageVisibility.PUBLIC,
      body: "Your request is being reviewed.",
    },
  });

  await prisma.requestMessage.upsert({
    where: { id: ids.internalMessage },
    create: {
      id: ids.internalMessage,
      requestId: ids.requestOne,
      authorId: ids.staff,
      visibility: MessageVisibility.INTERNAL,
      body: "Verify the academic record before approval.",
      createdAt: seededAt,
    },
    update: {
      visibility: MessageVisibility.INTERNAL,
      body: "Verify the academic record before approval.",
    },
  });

  const notifications = [
    {
      id: ids.notificationOne,
      userId: ids.studentOne,
      requestId: ids.requestOne,
      eventType: "LEGACY" as const,
      eventKey: `legacy:${ids.notificationOne}`,
      title: "Request under review",
      body: "Your transcript request is now under review.",
    },
    {
      id: ids.notificationTwo,
      userId: ids.studentTwo,
      requestId: ids.requestTwo,
      eventType: "LEGACY" as const,
      eventKey: `legacy:${ids.notificationTwo}`,
      title: "Request submitted",
      body: "Your enrollment certificate request was submitted.",
    },
  ] as const;

  for (const notification of notifications) {
    await prisma.notification.upsert({
      where: { id: notification.id },
      create: { ...notification, createdAt: seededAt },
      update: notification,
    });
  }

  await prisma.studentFinanceAccount.upsert({
    where: { id: ids.financeAccountOne },
    create: { id: ids.financeAccountOne, studentId: ids.profileOne },
    update: { studentId: ids.profileOne },
  });

  const financeTransactions = [
    {
      id: ids.financeChargeOne,
      accountId: ids.financeAccountOne,
      entryType: "CHARGE" as const,
      amountMinor: BigInt(125000),
      ledgerEffectMinor: BigInt(125000),
      currency: "MAD",
      effectiveDate: new Date("2026-01-15T00:00:00.000Z"),
      billingPeriod: "2025-2026",
      term: "ANNUAL" as const,
      sourceSystem: "DEVELOPMENT_DEMO",
      externalTransactionId: "DEV-DEMO-CHARGE-001",
      sourceReference: "DEMO-ANNUAL-FEE",
      description: "Development demonstration annual fee.",
      createdById: ids.staff,
      appliedById: ids.staff,
    },
    {
      id: ids.financePaymentOne,
      accountId: ids.financeAccountOne,
      entryType: "PAYMENT" as const,
      amountMinor: BigInt(50000),
      ledgerEffectMinor: BigInt(-50000),
      currency: "MAD",
      effectiveDate: new Date("2026-01-20T00:00:00.000Z"),
      billingPeriod: "2025-2026",
      term: "ANNUAL" as const,
      sourceSystem: "DEVELOPMENT_DEMO",
      externalTransactionId: "DEV-DEMO-PAYMENT-001",
      sourceReference: "DEMO-PAYMENT-001",
      description: "Development demonstration payment.",
      createdById: ids.staff,
      appliedById: ids.staff,
    },
  ] as const;

  for (const transaction of financeTransactions) {
    await prisma.financeTransaction.upsert({
      where: { id: transaction.id },
      create: transaction,
      update: transaction,
    });
  }

  await reconcileStudentRegistryDemo(prisma, process.env.NODE_ENV);
}

try {
  await seed();
  console.info("Development database seed completed.");
} catch {
  console.error("Development database seed failed.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
