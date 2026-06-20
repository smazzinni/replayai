"use client";
import { fmtRelativeTime } from "@/lib/replay-data";
import { useMounted } from "@/hooks/use-mounted";
interface RelativeTimeProps { iso: string; className?: string; }
export function RelativeTime({ iso, className }: RelativeTimeProps) {
  const mounted = useMounted();
  if (!mounted) {
    const d = new Date(iso);
    return <span className={className} suppressHydrationWarning>{d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>;
  }
  return <span className={className}>{fmtRelativeTime(iso)}</span>;
}
