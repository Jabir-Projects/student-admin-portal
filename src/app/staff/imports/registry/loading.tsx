export default function RegistryImportsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading registry imports"
      aria-live="polite"
      className="space-y-6"
      role="status"
    >
      <span className="sr-only">Loading registry imports</span>
      <div className="space-y-3">
        <div className="bg-muted h-4 w-36 animate-pulse rounded" />
        <div className="bg-muted h-10 w-full max-w-xl animate-pulse rounded" />
        <div className="bg-muted h-5 w-full max-w-3xl animate-pulse rounded" />
      </div>
      <div className="bg-muted h-56 animate-pulse rounded-xl border" />
      <div className="bg-muted h-72 animate-pulse rounded-xl border" />
    </div>
  );
}
