import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getFrameworkMeta } from "@/lib/framework/registry";

export function FrameworkBadge({
  framework,
  className
}: {
  framework: string | null | undefined;
  className?: string;
}) {
  const meta = getFrameworkMeta(framework);
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", meta.badgeClass, className)}>
      {meta.label}
    </Badge>
  );
}
