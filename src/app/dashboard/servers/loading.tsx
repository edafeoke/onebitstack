import { DashboardListSkeleton } from "@/components/dashboard-loading-skeleton";
import { DashboardPage } from "@/components/dashboard-page";

export default function ServersLoading() {
  return (
    <DashboardPage>
      <DashboardListSkeleton rows={6} />
    </DashboardPage>
  );
}
