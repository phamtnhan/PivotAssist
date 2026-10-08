import { pageMetadata } from "@/lib/page-metadata";

export const generateMetadata = () =>
  pageMetadata(
    {
      title: "Doanh nghiệp",
      description: "Phễu tuyển dụng, tin tuyển dụng và phòng phỏng vấn trên PivotAssist.",
    },
    {
      title: "Employers",
      description: "Hiring pipeline, listings, and interview rooms on PivotAssist.",
    },
  );

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
