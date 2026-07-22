import "server-only";

export {
  claimStudentRegistryEntry,
  findAvailableStudentRegistryEntry,
  getAllowedStudentRegistrySources,
  type StudentRegistryClaimInput,
  type StudentRegistryMatch,
} from "@/server/auth/verification.node";

export type StudentNumberVerification = {
  verified: false;
  manualApprovalRequired: true;
  reason: "INSTITUTIONAL_VERIFICATION_UNAVAILABLE";
};

export async function verifyStudentNumberInstitutionally(
  studentNumber: string,
): Promise<StudentNumberVerification> {
  void studentNumber;
  return {
    verified: false,
    manualApprovalRequired: true,
    reason: "INSTITUTIONAL_VERIFICATION_UNAVAILABLE",
  };
}
