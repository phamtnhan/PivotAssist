import { pageMetadata } from "@/lib/page-metadata";
import { requirePageSession } from "@/lib/require-page-session";

export const generateMetadata = () =>
  pageMetadata(
    {
      title: "Lộ trình nghề nghiệp",
      description: "Theo dõi các chặng kỹ năng và tài nguyên học tập theo mục tiêu nghề nghiệp.",
    },
    {
      title: "Career roadmap",
      description: "Track skill milestones and learning resources for your target role.",
    },
  );

export default async function RoadmapLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession();
  return children;
}
