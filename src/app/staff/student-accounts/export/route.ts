import { exportStudentsAsActor } from "@/server/administration/exports.node";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";

function deniedStatus(reason: string): number {
  return reason === "UNAUTHENTICATED" ? 401 : 403;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await exportStudentsAsActor(
    await getActorSessionClaims(),
    {
      search: url.searchParams.get("search") ?? undefined,
      status: url.searchParams.get("status") ?? "all",
    },
    db,
  );
  if (!result.ok) {
    return Response.json(
      { error: "The student export could not be generated." },
      {
        status:
          result.reason === "INVALID_INPUT" ? 400 : deniedStatus(result.reason),
      },
    );
  }
  return new Response(result.body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
