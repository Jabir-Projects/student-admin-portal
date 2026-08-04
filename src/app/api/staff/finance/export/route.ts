import { exportStaffFinance } from "@/server/finance/exports.node";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";
export async function GET(request: Request) {
  const u = new URL(request.url);
  const result = await exportStaffFinance(
    await getActorSessionClaims(),
    {
      from: u.searchParams.get("from") ?? undefined,
      to: u.searchParams.get("to") ?? undefined,
    },
    db,
  );
  if (!result.ok)
    return Response.json(
      { error: "The finance export could not be generated." },
      {
        status:
          result.reason === "UNAUTHENTICATED"
            ? 401
            : result.reason === "INVALID_INPUT"
              ? 400
              : 403,
      },
    );
  return new Response(result.body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
