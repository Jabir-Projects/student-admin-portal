export default function RequestsLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="space-y-5"
      role="status"
    >
      <span className="sr-only">Loading requests</span>
      <div className="bg-muted h-10 w-72 animate-pulse rounded" />
      <div className="bg-muted h-28 animate-pulse rounded-xl" />
      <div className="bg-muted h-96 animate-pulse rounded-xl" />
    </div>
  );
}
