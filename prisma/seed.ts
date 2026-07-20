import { createPrismaClient } from "../src/server/db/factory";
import { databaseEnv } from "../src/server/db/env";
import {
  DeliveryMethod,
  MessageVisibility,
  PreferredLanguage,
  RequestStatus,
  UserRole,
} from "../src/generated/prisma/enums";

const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  studentOne: "10000000-0000-4000-8000-000000000002",
  studentTwo: "10000000-0000-4000-8000-000000000003",
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
} as const;

const placeholderHash =
  "PHASE_2_NON_AUTHENTICATING_PLACEHOLDER_HASH_REPLACE_IN_PHASE_3";
const seededAt = new Date("2026-01-15T09:00:00.000Z");

if (process.env.NODE_ENV === "production") {
  throw new Error("Development seed is disabled in production.");
}

const prisma = createPrismaClient(databaseEnv.DATABASE_URL);

async function seed(): Promise<void> {
  const users = [
    {
      id: ids.admin,
      email: "admin.dev@example.invalid",
      displayName: "Development Administrator",
      passwordHash: placeholderHash,
      role: UserRole.ADMIN,
      preferredLanguage: PreferredLanguage.ENGLISH,
    },
    {
      id: ids.studentOne,
      email: "student.one.dev@example.invalid",
      displayName: "Development Student One",
      passwordHash: placeholderHash,
      role: UserRole.STUDENT,
      preferredLanguage: PreferredLanguage.FRENCH,
    },
    {
      id: ids.studentTwo,
      email: "student.two.dev@example.invalid",
      displayName: "Development Student Two",
      passwordHash: placeholderHash,
      role: UserRole.STUDENT,
      preferredLanguage: PreferredLanguage.ARABIC,
    },
  ] as const;

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: { ...user, createdAt: seededAt },
      update: user,
    });
  }

  const profiles = [
    {
      id: ids.profileOne,
      userId: ids.studentOne,
      studentNumber: "DEV-STUDENT-001",
      program: "Computer Science",
      academicYear: 2,
    },
    {
      id: ids.profileTwo,
      userId: ids.studentTwo,
      studentNumber: "DEV-STUDENT-002",
      program: "Business Administration",
      academicYear: 3,
    },
  ] as const;

  for (const profile of profiles) {
    await prisma.studentProfile.upsert({
      where: { id: profile.id },
      create: { ...profile, createdAt: seededAt },
      update: profile,
    });
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
        changedById: ids.admin,
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
      authorId: ids.admin,
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
      authorId: ids.admin,
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
      title: "Request under review",
      body: "Your transcript request is now under review.",
    },
    {
      id: ids.notificationTwo,
      userId: ids.studentTwo,
      requestId: ids.requestTwo,
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
