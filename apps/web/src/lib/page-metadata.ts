import type { Metadata } from "next";
import { cookies } from "next/headers";

export async function pageMetadata(
  vi: { title: string; description: string },
  en: { title: string; description: string },
): Promise<Metadata> {
  const isEn = (await cookies()).get("pivotassist-locale")?.value === "en";
  const copy = isEn ? en : vi;
  return { title: copy.title, description: copy.description };
}
