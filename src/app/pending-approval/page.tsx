import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PendingApprovalPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Administrative approval pending</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-4 text-sm">
          <p>
            Your registration has been submitted. Access will remain unavailable
            until an administrator approves the account.
          </p>
          <p>If you require assistance, please contact SIST administration.</p>
          <Link
            className="text-primary font-medium hover:underline"
            href="/login"
          >
            Return to login
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
