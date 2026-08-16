import { logoutAction } from "@/app/logout/actions";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <PendingSubmitButton
        pendingLabel="Logging out…"
        size="sm"
        variant="outline"
      >
        Sign out
      </PendingSubmitButton>
    </form>
  );
}
