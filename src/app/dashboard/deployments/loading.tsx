import { DashboardTableSkeleton } from "@/components/dashboard-loading-skeleton";
import { DashboardPage } from "@/components/dashboard-page";

export default function DeploymentsLoading() {
  return (
    <DashboardPage>
      <DashboardTableSkeleton rows={10} />
    </DashboardPage>
  );
}
