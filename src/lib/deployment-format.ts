export function formatDeploymentDuration(
  startedAt: Date | null,
  finishedAt: Date | null
): string {
  if (!startedAt) return "—";
  const end = finishedAt ?? new Date();
  const ms = end.getTime() - startedAt.getTime();
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}
