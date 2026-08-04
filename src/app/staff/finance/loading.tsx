export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading finance"
      className="space-y-6"
      role="status"
    >
      <span className="sr-only">Loading finance</span>
      <div className="bg-muted h-10 max-w-xl animate-pulse rounded" />
      <div className="bg-muted h-12 max-w-2xl animate-pulse rounded" />
      <div className="bg-muted h-56 animate-pulse rounded-xl border" />
    </div>
  );
}
