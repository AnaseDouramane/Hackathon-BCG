export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-line" />
        ))}
      </div>
      <div className="h-[520px] animate-pulse rounded-2xl bg-line" />
    </div>
  );
}
