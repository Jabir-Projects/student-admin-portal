export default function StaffDocumentsLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="space-y-5"
      role="status"
    >
      <span className="sr-only">Loading documents</span>
      <div className="bg-muted h-10 w-72 animate-pulse rounded" />
      <div className="bg-muted h-48 animate-pulse rounded-xl" />
      <div className="bg-muted h-72 animate-pulse rounded-xl" />
    </div>
  );
}
