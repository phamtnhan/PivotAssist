import type { Metadata } from "next";
import { cookies } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await cookies()).get("pivotassist-locale")?.value === "en" ? "en" : "vi";
  const en = locale === "en";
  return {
    title: en ? "Jobs" : "Việc làm",
    description: en
      ? "Open roles. Compare your CV with the listing and apply on PivotAssist."
      : "Danh sách việc làm đang tuyển. Đối soát CV với tin tuyển dụng và nộp hồ sơ trên PivotAssist.",
  };
}

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
