export default function StaffCapabilitiesLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading STAFF accounts"
      aria-live="polite"
      className="space-y-6"
      role="status"
    >
      <span className="sr-only">Loading STAFF accounts</span>
      <div className="space-y-3">
        <div className="bg-muted h-4 w-36 animate-pulse rounded" />
        <div className="bg-muted h-10 w-full max-w-md animate-pulse rounded" />
        <div className="bg-muted h-5 w-full max-w-2xl animate-pulse rounded" />
      </div>
      <div aria-hidden="true" className="bg-card h-28 rounded-xl border" />
      <div
        aria-hidden="true"
        className="bg-card h-80 animate-pulse rounded-xl border"
      />
    </div>
  );
}
