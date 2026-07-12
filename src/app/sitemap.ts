import type { MetadataRoute } from "next"

const BASE_URL = "https://simplicity-india.com"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${BASE_URL}/`, lastModified: now, priority: 1 },
    { url: `${BASE_URL}/features`, lastModified: now, priority: 0.9 },
    { url: `${BASE_URL}/features/focus-mode`, lastModified: now, priority: 0.8 },
    { url: `${BASE_URL}/features/agent-swarm`, lastModified: now, priority: 0.8 },
    { url: `${BASE_URL}/features/gmail-integration`, lastModified: now, priority: 0.8 },
    { url: `${BASE_URL}/features/document-generation`, lastModified: now, priority: 0.8 },
    { url: `${BASE_URL}/for/students`, lastModified: now, priority: 0.8 },
    { url: `${BASE_URL}/for/writers`, lastModified: now, priority: 0.8 },
    { url: `${BASE_URL}/for/researchers`, lastModified: now, priority: 0.8 },
    { url: `${BASE_URL}/partners`, lastModified: now, priority: 0.8 },
    { url: `${BASE_URL}/developers`, lastModified: now, priority: 0.7 },
    { url: `${BASE_URL}/resources`, lastModified: now, priority: 0.7 },
    { url: `${BASE_URL}/register`, lastModified: now, priority: 0.5 },
    { url: `${BASE_URL}/login`, lastModified: now, priority: 0.3 },
  ]
}
