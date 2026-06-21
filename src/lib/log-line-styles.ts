/** Tailwind classes for log line severity (deploy, provision, server tail, etc.). */
export function logLineClass(line: string): string {
  if (
    /\[stderr\]|npm error|ERR!|ERESOLVE|EUSAGE|\bfailed\b|Failed:|exit code [1-9]|(?:^|\s)error(?:\s|:|\])|\[error\]|\[crit\]|\[alert\]|\[emerg\]|fatal:|Build failed/i.test(
      line
    )
  ) {
    return "text-red-400";
  }
  if (/\s5\d{2}\s/.test(line)) {
    return "text-red-400";
  }
  if (
    /\[deploy\].*Completed|successfully|✓|\[provision\] Finished|\[nginx\] Reloaded|\[apache\] Reloaded|\[pm2\]|Reload scheduled/i.test(
      line
    )
  ) {
    return "text-emerald-400";
  }
  if (/\bwarn\b|WARNING|\[warn\]/i.test(line)) {
    return "text-amber-300";
  }
  if (/\s4\d{2}\s/.test(line)) {
    return "text-amber-300";
  }
  if (
    /\[(deploy|provision|nginx|apache|pm2|infra|env|manual|rollback|stdout)\]/i.test(
      line
    )
  ) {
    return "text-sky-300";
  }
  if (/Cloning into|git fetch|git clone/i.test(line)) {
    return "text-violet-300";
  }
  return "text-zinc-300";
}

/** @deprecated Use logLineClass */
export const deploymentLogLineClass = logLineClass;

export const LOG_CONSOLE_SCROLL_CLASS =
  "w-full rounded-md border bg-black/40 p-3 font-mono text-xs leading-relaxed";
