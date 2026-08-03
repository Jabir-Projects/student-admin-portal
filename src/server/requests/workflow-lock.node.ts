import "server-only";

import { Prisma } from "@/generated/prisma/client";

export async function lockRequestWorkflow(
  transaction: Prisma.TransactionClient,
  requestId: string,
) {
  await transaction.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`request-workflow:${requestId}`}, 0::bigint)
    )::text AS "lock"
  `);
}
