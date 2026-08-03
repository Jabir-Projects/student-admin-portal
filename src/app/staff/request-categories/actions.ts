"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createRequestCategoryAsActor,
  setRequestCategoryActiveAsActor,
  updateRequestCategoryAsActor,
} from "@/server/administration/mutations.node";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";

function finish(result: { ok: boolean; reason?: string }): never {
  if (result.ok) revalidatePath("/staff/request-categories");
  redirect(
    `/staff/request-categories?result=${result.ok ? "success" : encodeURIComponent(result.reason ?? "error")}`,
  );
}

export async function createCategoryAction(formData: FormData) {
  finish(
    await createRequestCategoryAsActor(
      await getActorSessionClaims(),
      {
        name: formData.get("name"),
        description: formData.get("description") ?? "",
      },
      db,
    ),
  );
}

export async function updateCategoryAction(formData: FormData) {
  finish(
    await updateRequestCategoryAsActor(
      await getActorSessionClaims(),
      {
        categoryId: formData.get("categoryId"),
        name: formData.get("name"),
        description: formData.get("description") ?? "",
      },
      db,
    ),
  );
}

export async function setCategoryActiveAction(formData: FormData) {
  finish(
    await setRequestCategoryActiveAsActor(
      await getActorSessionClaims(),
      {
        categoryId: formData.get("categoryId"),
        isActive: formData.get("isActive") === "true",
      },
      db,
    ),
  );
}
