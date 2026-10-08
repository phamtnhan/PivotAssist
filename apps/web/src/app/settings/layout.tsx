import { pageMetadata } from "@/lib/page-metadata";
import { requirePageSession } from "@/lib/require-page-session";

export const generateMetadata = () =>
  pageMetadata(
    { title: "Cài đặt", description: "Tài khoản, bảo mật, thông báo và hỗ trợ trên PivotAssist." },
    {
      title: "Settings",
      description: "Account, security, notifications, and support on PivotAssist.",
    },
  );

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession();
  return children;
}
