import { pageMetadata } from "@/lib/page-metadata";

export const generateMetadata = () =>
  pageMetadata(
    {
      title: "Đăng nhập",
      description: "Đăng nhập PivotAssist để luyện phỏng vấn, nộp hồ sơ và vào phòng phỏng vấn.",
    },
    {
      title: "Sign in",
      description:
        "Sign in to PivotAssist to practice interviews, apply, and join interview rooms.",
    },
  );

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
