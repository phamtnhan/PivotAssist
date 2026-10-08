import { pageMetadata } from "@/lib/page-metadata";
import { requirePageSession } from "@/lib/require-page-session";

export const generateMetadata = () =>
  pageMetadata(
    {
      title: "Hồ sơ năng lực",
      description: "CV đã đọc: tên, kỹ năng và kinh nghiệm trên PivotAssist.",
    },
    {
      title: "Profile",
      description: "Your parsed CV: name, skills, and experience on PivotAssist.",
    },
  );

export default async function ProfilesLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession();
  return children;
}
