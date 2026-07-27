-- Commit STAFF before any later migration uses the new PostgreSQL enum value.
BEGIN;

ALTER TYPE "UserRole" ADD VALUE 'STAFF';

COMMIT;
