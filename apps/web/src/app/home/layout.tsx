import { pageMetadata } from "@/lib/page-metadata";
import { requirePageSession } from "@/lib/require-page-session";

export const generateMetadata = () =>
  pageMetadata(
    {
      title: "Trang chủ",
      description: "Tải CV, nộp hồ sơ và luyện phỏng vấn AI trên PivotAssist.",
    },
    {
      title: "Home",
      description: "Upload a CV, apply, and practice AI interviews on PivotAssist.",
    },
  );

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession();
  return children;
}
