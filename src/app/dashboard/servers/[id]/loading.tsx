import { DashboardListSkeleton } from "@/components/dashboard-loading-skeleton";
import { DashboardPage } from "@/components/dashboard-page";

export default function ServerDetailLoading() {
  return (
    <DashboardPage>
      <DashboardListSkeleton rows={5} />
    </DashboardPage>
  );
}
