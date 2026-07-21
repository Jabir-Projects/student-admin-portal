import type {
  AccountStatusValue,
  UserRoleValue,
} from "@/features/auth/constants";

export function hasActiveRole(
  account: { status: AccountStatusValue; role: UserRoleValue } | null,
  expectedRole: UserRoleValue,
): boolean {
  return account?.status === "ACTIVE" && account.role === expectedRole;
}
