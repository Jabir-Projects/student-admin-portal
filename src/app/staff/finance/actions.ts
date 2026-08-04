"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";
import {
  approveFinanceImportAsActor,
  rejectFinanceImportAsActor,
  reverseFinanceTransactionAsActor,
  submitFinanceImportAsActor,
  uploadFinanceImportAsActor,
} from "@/server/finance/workflow.node";

function batchPath(id: string, result?: string) {
  return `/staff/finance/imports/${id}${result ? `?result=${encodeURIComponent(result)}` : ""}`;
}
export async function uploadFinanceImportAction(
  formData: FormData,
): Promise<never> {
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size)
    redirect("/staff/finance/imports?result=INVALID_FILE");
  const result = await uploadFinanceImportAsActor(
    await getActorSessionClaims(),
    {
      bytes: new Uint8Array(await file.arrayBuffer()),
      filename: file.name,
      mimeType: file.type,
    },
    db,
  );
  if (!result.ok)
    redirect(
      `/staff/finance/imports?result=${encodeURIComponent(result.errorCode ?? result.reason)}`,
    );
  revalidatePath("/staff/finance/imports");
  redirect(batchPath(result.batchId!, result.status));
}
export async function submitFinanceImportAction(
  formData: FormData,
): Promise<never> {
  const id = String(formData.get("batchId") ?? "");
  const result = await submitFinanceImportAsActor(
    await getActorSessionClaims(),
    id,
    db,
  );
  revalidatePath(batchPath(id));
  redirect(batchPath(id, result.ok ? result.status : result.reason));
}
export async function approveFinanceImportAction(
  formData: FormData,
): Promise<never> {
  const id = String(formData.get("batchId") ?? "");
  const result = await approveFinanceImportAsActor(
    await getActorSessionClaims(),
    id,
    db,
  );
  revalidatePath(batchPath(id));
  redirect(batchPath(id, result.ok ? result.status : result.reason));
}
export async function rejectFinanceImportAction(
  formData: FormData,
): Promise<never> {
  const id = String(formData.get("batchId") ?? "");
  const result = await rejectFinanceImportAsActor(
    await getActorSessionClaims(),
    { batchId: id, reason: formData.get("reason") },
    db,
  );
  revalidatePath(batchPath(id));
  redirect(batchPath(id, result.ok ? result.status : result.reason));
}
export async function reverseFinanceTransactionAction(
  formData: FormData,
): Promise<never> {
  const studentId = String(formData.get("studentId") ?? "");
  const transactionId = String(formData.get("transactionId") ?? "");
  const result = await reverseFinanceTransactionAsActor(
    await getActorSessionClaims(),
    { transactionId, reason: formData.get("reason"), studentId },
    db,
  );
  revalidatePath(`/staff/finance/students/${studentId}`);
  redirect(
    `/staff/finance/students/${studentId}?result=${encodeURIComponent(result.ok ? result.status : result.reason)}`,
  );
}
