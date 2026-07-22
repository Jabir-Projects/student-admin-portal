BEGIN;

-- CreateEnum
CREATE TYPE "StudentRegistryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StudentRegistrySource" AS ENUM ('DEVELOPMENT_DEMO', 'OFFICIAL_IMPORT');

-- CreateTable
CREATE TABLE "StudentRegistry" (
    "id" UUID NOT NULL,
    "studentNumber" VARCHAR(50) NOT NULL,
    "fullName" VARCHAR(200) NOT NULL,
    "normalizedFullName" VARCHAR(200) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "program" VARCHAR(200) NOT NULL,
    "academicYear" "AcademicYear" NOT NULL,
    "status" "StudentRegistryStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "StudentRegistrySource" NOT NULL,
    "registeredUserId" UUID,
    "registeredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StudentRegistry_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraints
ALTER TABLE "StudentRegistry"
    ADD CONSTRAINT "StudentRegistry_email_normalized_check"
        CHECK ("email" = lower(btrim("email"))),
    ADD CONSTRAINT "StudentRegistry_studentNumber_normalized_check"
        CHECK ("studentNumber" = upper(btrim("studentNumber"))),
    ADD CONSTRAINT "StudentRegistry_studentNumber_format_check"
        CHECK ("studentNumber" ~ '^[A-Z0-9][A-Z0-9._/-]{0,49}$'),
    ADD CONSTRAINT "StudentRegistry_normalizedFullName_check"
        CHECK (length("normalizedFullName") > 0 AND "normalizedFullName" = btrim("normalizedFullName")),
    ADD CONSTRAINT "StudentRegistry_registration_link_pair_check"
        CHECK (("registeredUserId" IS NULL) = ("registeredAt" IS NULL));

-- CreateIndex
CREATE UNIQUE INDEX "StudentRegistry_studentNumber_key" ON "StudentRegistry"("studentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StudentRegistry_email_key" ON "StudentRegistry"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StudentRegistry_registeredUserId_key" ON "StudentRegistry"("registeredUserId");

-- AddForeignKey
ALTER TABLE "StudentRegistry" ADD CONSTRAINT "StudentRegistry_registeredUserId_fkey" FOREIGN KEY ("registeredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
