-- Backfill only the deterministic development ADMIN approved by the product
-- owner. Production identities require their own explicit approved manifest.
BEGIN;

DO $development_admin_backfill$
DECLARE
  target_user_id CONSTANT UUID := '10000000-0000-4000-8000-000000000001'::UUID;
  expected_email CONSTANT TEXT := 'admin.dev@example.invalid';
  target_email TEXT;
  target_role "UserRole";
  target_status "AccountStatus";
  resulting_capability_count INTEGER;
BEGIN
  SELECT "email", "role", "status"
  INTO target_email, target_role, target_status
  FROM "User"
  WHERE "id" = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved development ADMIN account was not found';
  END IF;
  IF target_email <> expected_email THEN
    RAISE EXCEPTION 'Approved development ADMIN identity does not match';
  END IF;
  IF target_role <> 'ADMIN'::"UserRole" THEN
    RAISE EXCEPTION 'Approved development account is not an ADMIN';
  END IF;
  IF target_status <> 'ACTIVE'::"AccountStatus" THEN
    RAISE EXCEPTION 'Approved development ADMIN account is not active';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "UserCapabilityAssignment"
    WHERE "userId" = target_user_id
  ) THEN
    RAISE EXCEPTION 'Approved development ADMIN already has capability assignments';
  END IF;

  INSERT INTO "UserCapabilityAssignment"
    ("userId", "capability", "grantedById")
  VALUES
    (target_user_id, 'MANAGE_STUDENT_ACCOUNTS'::"Capability", NULL),
    (target_user_id, 'REACTIVATE_STUDENT_ACCOUNTS'::"Capability", NULL),
    (target_user_id, 'MANAGE_STAFF_ACCOUNTS'::"Capability", NULL),
    (target_user_id, 'MANAGE_STAFF_CAPABILITIES'::"Capability", NULL);

  SELECT count(*)
  INTO resulting_capability_count
  FROM "UserCapabilityAssignment"
  WHERE "userId" = target_user_id;

  IF resulting_capability_count <> 4 THEN
    RAISE EXCEPTION 'Development ADMIN capability count verification failed';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "UserCapabilityAssignment"
    WHERE "userId" = target_user_id
      AND "capability" NOT IN (
        'MANAGE_STUDENT_ACCOUNTS'::"Capability",
        'REACTIVATE_STUDENT_ACCOUNTS'::"Capability",
        'MANAGE_STAFF_ACCOUNTS'::"Capability",
        'MANAGE_STAFF_CAPABILITIES'::"Capability"
      )
  ) THEN
    RAISE EXCEPTION 'Development ADMIN capability set verification failed';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "UserCapabilityAssignment"
    WHERE "userId" = target_user_id
      AND "grantedById" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Development ADMIN bootstrap grantor verification failed';
  END IF;
END
$development_admin_backfill$;

COMMIT;
