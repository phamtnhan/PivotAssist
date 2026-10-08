import { pageMetadata } from "@/lib/page-metadata";

export const generateMetadata = () =>
  pageMetadata(
    { title: "Gói dịch vụ", description: "Các gói luyện phỏng vấn AI trên PivotAssist." },
    { title: "Plans", description: "AI interview practice plans on PivotAssist." },
  );

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
