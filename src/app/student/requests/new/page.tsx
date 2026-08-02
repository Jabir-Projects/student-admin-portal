import { RequestForm } from "@/components/student/portal/request-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { listAvailableRequestCategories } from "@/server/student-portal/reads.node";

export default async function NewStudentRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const result = await listAvailableRequestCategories(
    await getActorSessionClaims(),
    db,
  );
  if (!result.ok) redirectForAuthorizationFailure(result.reason);
  const requested = (await searchParams).category;
  const selectedCategoryId = result.categories.some(
    (category) => category.id === requested,
  )
    ? requested
    : undefined;
  return (
    <div className="mx-auto max-w-5xl">
      <header>
        <p className="text-muted-foreground text-sm font-medium">
          Student services
        </p>
        <h1 className="text-sist-navy-dark mt-1 text-3xl font-bold">
          Request catalogue
        </h1>
        <p className="text-muted-foreground mt-2">
          Choose an available service and submit your request.
        </p>
      </header>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)]">
        <section aria-labelledby="available-categories" className="grid gap-3">
          <h2 className="text-xl font-semibold" id="available-categories">
            Available categories
          </h2>
          {result.categories.length === 0 ? (
            <p className="text-muted-foreground rounded-xl border p-6">
              No request categories are currently available.
            </p>
          ) : (
            result.categories.map((category) => (
              <Card key={category.id}>
                <CardHeader>
                  <CardTitle>{category.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-7">
                    {category.description?.trim() ||
                      "Administrative document request"}
                  </p>
                  <a
                    className="text-primary mt-4 inline-flex font-semibold hover:underline"
                    href={`/student/requests/new?category=${category.id}`}
                  >
                    Request document
                  </a>
                </CardContent>
              </Card>
            ))
          )}
        </section>
        <Card>
          <CardHeader>
            <CardTitle>Submit request</CardTitle>
          </CardHeader>
          <CardContent>
            {result.categories.length ? (
              <RequestForm
                categories={result.categories}
                selectedCategoryId={selectedCategoryId}
              />
            ) : (
              <p className="text-muted-foreground">
                Submission is unavailable until a category is enabled.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
