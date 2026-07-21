import { logoutAction } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button size="sm" type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  );
}
