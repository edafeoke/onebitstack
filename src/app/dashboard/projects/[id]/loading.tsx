import { DashboardListSkeleton } from "@/components/dashboard-loading-skeleton";
import { DashboardPage } from "@/components/dashboard-page";

export default function ProjectDetailLoading() {
  return (
    <DashboardPage>
      <DashboardListSkeleton rows={6} />
    </DashboardPage>
  );
}
