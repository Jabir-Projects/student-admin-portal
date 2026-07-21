import type { DefaultSession } from "next-auth";
import type {
  AccountStatusValue,
  UserRoleValue,
} from "@/features/auth/constants";

declare module "next-auth" {
  interface User {
    role: UserRoleValue;
    status: AccountStatusValue;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: UserRoleValue;
      status: AccountStatusValue;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRoleValue;
    status?: AccountStatusValue;
  }
}
