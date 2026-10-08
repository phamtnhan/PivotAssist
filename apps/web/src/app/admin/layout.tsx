import { pageMetadata } from "@/lib/page-metadata";
import { requirePageSession } from "@/lib/require-page-session";

export const generateMetadata = () =>
  pageMetadata(
    {
      title: "Quản trị",
      description: "Tổng quan hệ thống, người dùng và hộp thư hỗ trợ PivotAssist.",
    },
    { title: "Admin", description: "System overview, users, and support inbox on PivotAssist." },
  );

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession();
  return children;
}
