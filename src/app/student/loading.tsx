import { SystemState } from "@/components/feedback/system-state";

export default function StudentLoading() {
  return (
    <SystemState
      description="Your student services are loading."
      kind="loading"
      title="Loading student portal"
    />
  );
}
