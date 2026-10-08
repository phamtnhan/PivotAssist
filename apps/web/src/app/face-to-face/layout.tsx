import { pageMetadata } from "@/lib/page-metadata";
import { requirePageSession } from "@/lib/require-page-session";

export const generateMetadata = () =>
  pageMetadata(
    {
      title: "Phòng phỏng vấn",
      description: "Phòng đã hẹn với nhà tuyển dụng. Xin camera và micro sau khi bạn đồng ý.",
    },
    {
      title: "Interview room",
      description: "Rooms booked with an employer. Camera and microphone open after you agree.",
    },
  );

export default async function FaceToFaceLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession();
  return children;
}
