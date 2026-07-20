import { FileQuestion } from "lucide-react";

import { StatusPage } from "@/components/feedback/status-page";

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      description="The page you requested does not exist or may have moved."
      icon={FileQuestion}
      title="Page not found"
    />
  );
}
