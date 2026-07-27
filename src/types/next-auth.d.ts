import type { DefaultSession } from "next-auth";
import type {
  AccountStatusValue,
  UserRoleValue,
} from "@/features/auth/constants";

declare module "next-auth" {
  interface User {
    role: UserRoleValue;
    status: AccountStatusValue;
    sessionVersion: number;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: UserRoleValue;
      status: AccountStatusValue;
      sessionVersion: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRoleValue;
    status?: AccountStatusValue;
    sessionVersion?: number;
  }
}
