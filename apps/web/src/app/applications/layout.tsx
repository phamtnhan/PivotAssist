import { pageMetadata } from "@/lib/page-metadata";
import { requirePageSession } from "@/lib/require-page-session";

export const generateMetadata = () =>
  pageMetadata(
    {
      title: "Hồ sơ đã nộp",
      description: "Theo dõi trạng thái từng hồ sơ đã nộp theo vị trí tuyển dụng.",
    },
    { title: "Applications", description: "Track each submitted application by role." },
  );

export default async function ApplicationsLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession();
  return children;
}
