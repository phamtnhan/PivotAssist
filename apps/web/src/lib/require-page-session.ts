import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export async function requirePageSession() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
