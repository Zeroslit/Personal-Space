import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('ps-skeleton animate-shimmer rounded-control', className)} />;
}
