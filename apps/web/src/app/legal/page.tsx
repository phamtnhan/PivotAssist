import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LegalBody } from "@/components/LegalBody";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await cookies()).get("pivotassist-locale")?.value === "en";
  return {
    title: en ? "Privacy and device permissions" : "Cam kết bảo mật và quyền thiết bị",
    description: en
      ? "PivotAssist asks for microphone and camera only for the interview purpose, under Vietnam’s Cybersecurity Law."
      : "PivotAssist xin quyền micro và camera theo đúng mục đích phỏng vấn, tuân thủ Luật An toàn thông tin mạng.",
  };
}

export default function LegalPage() {
  return <LegalBody />;
}
