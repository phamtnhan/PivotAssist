import { pageMetadata } from "@/lib/page-metadata";

export const generateMetadata = () =>
  pageMetadata(
    {
      title: "Tạo tài khoản",
      description: "Tạo tài khoản ứng viên hoặc doanh nghiệp trên PivotAssist.",
    },
    {
      title: "Create account",
      description: "Create a candidate or company account on PivotAssist.",
    },
  );

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
