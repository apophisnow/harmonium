interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
  circle?: boolean;
}

export function Skeleton({
  className = '',
  width,
  height,
  rounded = false,
  circle = false,
}: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`animate-pulse bg-th-bg-accent ${
        circle ? 'rounded-full' : rounded ? 'rounded-md' : 'rounded'
      } ${className}`}
      style={style}
    />
  );
}

/** Pre-composed skeleton for a chat message row */
export function MessageSkeleton() {
  return (
    <div className="flex items-start gap-4 px-4 py-2">
      <Skeleton circle width={40} height={40} />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton width={100} height={14} rounded />
          <Skeleton width={60} height={10} rounded />
        </div>
        <Skeleton width="80%" height={14} rounded />
        <Skeleton width="60%" height={14} rounded />
      </div>
    </div>
  );
}

/** Pre-composed skeleton for a channel item in the sidebar */
export function ChannelSkeleton() {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <Skeleton width={20} height={20} rounded />
      <Skeleton width="70%" height={14} rounded />
    </div>
  );
}

/** Pre-composed skeleton for a server icon in the sidebar */
export function ServerSkeleton() {
  return <Skeleton circle width={48} height={48} className="mx-auto" />;
}
