"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { REGISTRY_IMPORT_MAX_BYTES } from "@/features/registry-import/schemas";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";
import {
  approveRegistryImportAsActor,
  rejectRegistryImportAsActor,
  submitRegistryImportAsActor,
  uploadRegistryImportAsActor,
} from "@/server/registry-import/workflow.node";

function detailPath(batchId: string, result?: string) {
  return `/staff/imports/registry/${batchId}${result ? `?result=${encodeURIComponent(result)}` : ""}`;
}

export async function uploadRegistryImportAction(
  formData: FormData,
): Promise<never> {
  const file = formData.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > REGISTRY_IMPORT_MAX_BYTES
  ) {
    redirect("/staff/imports/registry?result=INVALID_FILE");
  }
  const result = await uploadRegistryImportAsActor(
    await getActorSessionClaims(),
    {
      bytes: new Uint8Array(await file.arrayBuffer()),
      filename: file.name,
      mimeType: file.type,
    },
    db,
  );
  if (!result.ok) {
    redirect(
      `/staff/imports/registry?result=${encodeURIComponent(result.errorCode ?? result.reason)}`,
    );
  }
  revalidatePath("/staff/imports/registry");
  redirect(detailPath(result.batchId, result.status));
}

export async function submitRegistryImportAction(
  formData: FormData,
): Promise<never> {
  const batchId = String(formData.get("batchId") ?? "");
  const result = await submitRegistryImportAsActor(
    await getActorSessionClaims(),
    batchId,
    db,
  );
  revalidatePath(detailPath(batchId));
  redirect(detailPath(batchId, result.ok ? result.status : result.reason));
}

export async function approveRegistryImportAction(
  formData: FormData,
): Promise<never> {
  const batchId = String(formData.get("batchId") ?? "");
  const result = await approveRegistryImportAsActor(
    await getActorSessionClaims(),
    batchId,
    db,
  );
  revalidatePath(detailPath(batchId));
  redirect(detailPath(batchId, result.ok ? result.status : result.reason));
}

export async function rejectRegistryImportAction(
  formData: FormData,
): Promise<never> {
  const batchId = String(formData.get("batchId") ?? "");
  const result = await rejectRegistryImportAsActor(
    await getActorSessionClaims(),
    { batchId, reason: formData.get("reason") },
    db,
  );
  revalidatePath(detailPath(batchId));
  redirect(detailPath(batchId, result.ok ? result.status : result.reason));
}
