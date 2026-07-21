import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep crawlers out of authenticated app surfaces and API routes —
        // nothing there is meant to be indexed, and letting bots hit /api/*
        // routes just wastes crawl budget and rate-limit headroom.
        disallow: ["/chat", "/studio", "/settings", "/animation", "/api/"],
      },
    ],
    sitemap: "https://simplicity-india.com/sitemap.xml",
  }
}
