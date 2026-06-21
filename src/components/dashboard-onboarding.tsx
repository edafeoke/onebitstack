import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { OnboardingStep } from "@/lib/onboarding/steps";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function DashboardOnboarding({ steps }: { steps: OnboardingStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Get started</CardTitle>
        <CardDescription>
          {doneCount} of {steps.length} steps complete
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {steps.map((step) => (
            <li key={step.id} className="flex items-start gap-2 text-sm">
              {step.done ? (
                <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
              ) : (
                <Circle className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              )}
              <span className={step.done ? "text-muted-foreground line-through" : ""}>
                {step.label}
              </span>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="outline" render={<Link href="/dashboard/settings" />}>
          Open settings
        </Button>
      </CardContent>
    </Card>
  );
}
