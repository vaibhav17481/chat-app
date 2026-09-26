function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-raised ${className}`}
    />
  );
}

export function SidebarRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <Skeleton className="h-11 w-11 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2.5 w-1/3" />
      </div>
    </div>
  );
}

export default Skeleton;
