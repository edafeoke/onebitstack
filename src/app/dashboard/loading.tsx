import { DashboardOverviewSkeleton, DashboardListSkeleton } from "@/components/dashboard-loading-skeleton";
import { DashboardPage } from "@/components/dashboard-page";

export default function DashboardLoading() {
  return (
    <DashboardPage>
      <DashboardOverviewSkeleton />
      <DashboardListSkeleton rows={8} />
    </DashboardPage>
  );
}
