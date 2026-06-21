import { logLineClass } from "@/lib/log-line-styles";
import { cn } from "@/lib/utils";

export function ColoredLogLine({
  line,
  className
}: {
  line: string;
  className?: string;
}) {
  return (
    <div className={cn("whitespace-pre-wrap break-all", logLineClass(line), className)}>
      {line}
    </div>
  );
}
