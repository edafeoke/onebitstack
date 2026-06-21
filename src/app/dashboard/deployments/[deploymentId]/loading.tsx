import { DashboardListSkeleton } from "@/components/dashboard-loading-skeleton";
import { DashboardPage } from "@/components/dashboard-page";

export default function DeploymentDetailLoading() {
  return (
    <DashboardPage>
      <DashboardListSkeleton rows={12} />
    </DashboardPage>
  );
}
