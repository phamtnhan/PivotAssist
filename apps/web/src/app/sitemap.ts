import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const paths = ["/", "/jobs", "/services", "/login", "/register", "/legal"];
  return paths.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/jobs" ? "hourly" : "weekly",
    priority: path === "/" || path === "/jobs" ? 0.9 : 0.6,
  }));
}
