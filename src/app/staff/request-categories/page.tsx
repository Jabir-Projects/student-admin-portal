import { CreateCategoryForm } from "./create-category-form";
import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { listRequestCategories } from "@/server/administration/reads.node";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { setCategoryActiveAction, updateCategoryAction } from "./actions";

export default async function RequestCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const result = await listRequestCategories(await getActorSessionClaims(), db);
  if (!result.ok) redirectForAuthorizationFailure(result.reason);
  const feedback = (await searchParams).result;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sist-olive-dark text-sm font-semibold">
          Administration portal
        </p>
        <h1 className="text-sist-navy-dark mt-1 text-3xl font-semibold">
          Request categories
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage categories available for new student requests without changing
          historical requests.
        </p>
      </header>
      {feedback ? (
        <FeedbackBanner tone={feedback === "success" ? "success" : "error"}>
          {feedback === "success"
            ? "The category was updated."
            : "The category operation could not be completed."}
        </FeedbackBanner>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Create category</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateCategoryForm />
        </CardContent>
      </Card>
      <section aria-labelledby="categories-heading">
        <h2 className="sr-only" id="categories-heading">
          Existing request categories
        </h2>
        {result.categories.length === 0 ? (
          <p
            className="bg-staff-panel rounded-xl border p-8 text-center"
            role="status"
          >
            No request categories exist.
          </p>
        ) : (
          <div className="grid gap-4">
            {result.categories.map((category) => (
              <Card key={category.id}>
                <CardHeader className="flex-row items-start justify-between">
                  <div>
                    <CardTitle>{category.name}</CardTitle>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Slug: {category.slug} · {category._count.requests}{" "}
                      historical request
                      {category._count.requests === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Badge variant={category.isActive ? "success" : "secondary"}>
                    {category.isActive ? "Active" : "Inactive"}
                  </Badge>
                </CardHeader>
                <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <form
                    action={updateCategoryAction}
                    className="grid gap-4 sm:grid-cols-2"
                  >
                    <input
                      name="categoryId"
                      type="hidden"
                      value={category.id}
                    />
                    <label className="grid gap-1.5">
                      <span className="text-sm font-semibold">Name</span>
                      <input
                        className="border-input bg-background h-10 rounded-md border px-3"
                        defaultValue={category.name}
                        maxLength={120}
                        minLength={2}
                        name="name"
                        required
                      />
                    </label>
                    <label className="grid gap-1.5 sm:col-span-2">
                      <span className="text-sm font-semibold">Description</span>
                      <textarea
                        className="border-input bg-background min-h-20 rounded-md border p-3"
                        defaultValue={category.description ?? ""}
                        maxLength={1000}
                        name="description"
                      />
                    </label>
                    <PendingSubmitButton
                      className="w-fit"
                      pendingLabel="Saving…"
                      variant="outline"
                    >
                      Save changes
                    </PendingSubmitButton>
                  </form>
                  <form
                    action={setCategoryActiveAction}
                    className="flex items-end"
                  >
                    <input
                      name="categoryId"
                      type="hidden"
                      value={category.id}
                    />
                    <input
                      name="isActive"
                      type="hidden"
                      value={category.isActive ? "false" : "true"}
                    />
                    <PendingSubmitButton
                      pendingLabel={
                        category.isActive ? "Deactivating…" : "Activating…"
                      }
                      variant={category.isActive ? "destructive" : "default"}
                    >
                      {category.isActive ? "Deactivate" : "Activate"}
                    </PendingSubmitButton>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
