// REQ-0011 — GET /jobs SSR; not loading-only
import { getInitialPublicJobs } from "@/lib/jobs-list-server";
import JobsClient from "./jobs-client";

export default async function JobsPage() {
  const listing = await getInitialPublicJobs();
  return <JobsClient initialJobs={listing.jobs} initialTotal={listing.total} />;
}
