"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";
import {
  generateDocumentAsActor,
  releaseDocumentAsActor,
  revokeDocumentAsActor,
} from "@/server/documents/mutations.node";
import { createRuntimeDocumentStorage } from "@/server/documents/runtime.node";

function destination(result: { ok: boolean; reason?: string }) {
  const value = result.ok
    ? "success"
    : (result.reason?.toLowerCase() ?? "error");
  return `/staff/documents?result=${encodeURIComponent(value)}`;
}

function revalidateDocuments(requestId?: string) {
  revalidatePath("/staff/documents");
  revalidatePath("/student/documents");
  if (requestId) {
    revalidatePath(`/staff/requests/${requestId}`);
    revalidatePath(`/student/requests/${requestId}`);
  }
}

export async function generateDocumentAction(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const result = await generateDocumentAsActor(
    await getActorSessionClaims(),
    { requestId },
    db,
    { storage: createRuntimeDocumentStorage() },
  );
  if (result.ok) revalidateDocuments(requestId);
  redirect(destination(result));
}

export async function releaseDocumentAction(formData: FormData) {
  const result = await releaseDocumentAsActor(
    await getActorSessionClaims(),
    { artifactId: formData.get("artifactId") },
    db,
    createRuntimeDocumentStorage(),
  );
  if (result.ok) revalidateDocuments();
  redirect(destination(result));
}

export async function revokeDocumentAction(formData: FormData) {
  const result = await revokeDocumentAsActor(
    await getActorSessionClaims(),
    { artifactId: formData.get("artifactId"), reason: formData.get("reason") },
    db,
  );
  if (result.ok) revalidateDocuments();
  redirect(destination(result));
}
