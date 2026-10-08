import { getFeaturedHomeJobs } from "@/lib/home-featured-server";
import HomeClient from "./home-client";

export default async function HomePage() {
  const featured = await getFeaturedHomeJobs();
  return <HomeClient initialJobs={featured.jobs} initialTotal={featured.total} />;
}
