import { pageMetadata } from "@/lib/page-metadata";
import { requirePageSession } from "@/lib/require-page-session";

export const generateMetadata = () =>
  pageMetadata(
    {
      title: "Luyện phỏng vấn",
      description: "Luyện phỏng vấn AI bằng micro. Câu hỏi bám CV và vị trí bạn chọn.",
    },
    {
      title: "Interview practice",
      description:
        "Practice AI interviews with your microphone. Questions follow your CV and role.",
    },
  );

export default async function InterviewLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession();
  return children;
}
