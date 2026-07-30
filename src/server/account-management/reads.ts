import "server-only";

import type {
  CapabilityAssignmentReadInput,
  DisabledStudentReadInput,
  ManagedStudentReadInput,
  StaffInventoryReadInput,
} from "@/features/account-management/schemas";
import {
  authorizePackageDPageEntry,
  type PackageDPage,
} from "@/server/account-management/authorization.node";
import {
  readDisabledStudentAccounts,
  readManagedStudentAccounts,
  readStaffCapabilityAssignments,
  readStaffInventory,
} from "@/server/account-management/reads.node";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { getAuthenticationSecret } from "@/server/auth/env";
import { db } from "@/server/db";

function accountReferenceSecret(): string {
  const secret = getAuthenticationSecret(process.env);
  if (!secret) {
    throw new Error("Authentication secret is unavailable.");
  }
  return secret;
}

export async function authorizeAccountManagementPage(page: PackageDPage) {
  return authorizePackageDPageEntry(await getActorSessionClaims(), page, db);
}

export async function getManagedStudentAccounts(
  input: ManagedStudentReadInput,
) {
  return readManagedStudentAccounts(
    await getActorSessionClaims(),
    input,
    db,
    accountReferenceSecret(),
  );
}

export async function getDisabledStudentAccounts(
  input: DisabledStudentReadInput,
) {
  return readDisabledStudentAccounts(
    await getActorSessionClaims(),
    input,
    db,
    accountReferenceSecret(),
  );
}

export async function getStaffInventory(input: StaffInventoryReadInput) {
  return readStaffInventory(
    await getActorSessionClaims(),
    input,
    db,
    accountReferenceSecret(),
  );
}

export async function getStaffCapabilityAssignments(
  input: CapabilityAssignmentReadInput,
) {
  return readStaffCapabilityAssignments(
    await getActorSessionClaims(),
    input,
    db,
    accountReferenceSecret(),
  );
}
