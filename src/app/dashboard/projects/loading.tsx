import { DashboardListSkeleton } from "@/components/dashboard-loading-skeleton";
import { DashboardPage } from "@/components/dashboard-page";

export default function ProjectsLoading() {
  return (
    <DashboardPage>
      <DashboardListSkeleton rows={8} />
    </DashboardPage>
  );
}
