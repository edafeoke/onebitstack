import { cn } from "@/lib/utils";

/**
 * Standard dashboard content wrapper — left-aligned, consistent vertical rhythm.
 * Horizontal padding comes from DashboardShell.
 */
export function DashboardPage({
  children,
  className,
  size = "default"
}: {
  children: React.ReactNode;
  className?: string;
  /** narrow: forms/wizards; medium: settings */
  size?: "default" | "narrow" | "medium";
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-4 py-4 md:gap-6 md:py-6",
        size === "narrow" && "max-w-2xl",
        size === "medium" && "max-w-3xl",
        className
      )}
    >
      {children}
    </div>
  );
}
