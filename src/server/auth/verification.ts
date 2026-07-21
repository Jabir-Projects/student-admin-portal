import "server-only";

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
