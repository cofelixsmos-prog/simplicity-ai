// Live web search for Harness research agents. Prefers Tavily (clean content +
// synthesized answer, one free key), falls back to Google Programmable Search.
// Returns structured results the agents extract findings + citations from.

export interface SearchHit {
  title: string
  url: string
  content: string
  domain: string
}

export interface SearchResponse {
  answer: string
  hits: SearchHit[]
  configured: boolean
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "source"
  }
}

export async function search(query: string, maxResults = 6): Promise<SearchResponse> {
  if (process.env.TAVILY_API_KEY) {
    const r = await tavily(query, maxResults).catch(() => null)
    if (r) return r
  }
  if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX) {
    const r = await google(query, maxResults).catch(() => null)
    if (r) return r
  }
  return { answer: "", hits: [], configured: false }
}

async function tavily(query: string, maxResults: number): Promise<SearchResponse | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 18_000)
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: maxResults,
        search_depth: "advanced",
        include_answer: true,
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      answer?: string
      results?: { title?: string; url?: string; content?: string }[]
    }
    const hits: SearchHit[] = (data.results ?? []).slice(0, maxResults).map((r) => ({
      title: r.title ?? "(untitled)",
      url: r.url ?? "",
      content: (r.content ?? "").slice(0, 600),
      domain: domainOf(r.url ?? ""),
    }))
    if (!hits.length && !data.answer) return null
    return { answer: data.answer ?? "", hits, configured: true }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function google(query: string, maxResults: number): Promise<SearchResponse | null> {
  const key = process.env.GOOGLE_SEARCH_API_KEY as string
  const cx = process.env.GOOGLE_SEARCH_CX as string
  const url =
    `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}` +
    `&cx=${encodeURIComponent(cx)}&num=${Math.min(10, maxResults)}&q=${encodeURIComponent(query)}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    const data = (await res.json()) as {
      items?: { title?: string; link?: string; snippet?: string }[]
    }
    const hits: SearchHit[] = (data.items ?? []).slice(0, maxResults).map((r) => ({
      title: r.title ?? "(untitled)",
      url: r.link ?? "",
      content: (r.snippet ?? "").slice(0, 600),
      domain: domainOf(r.link ?? ""),
    }))
    if (!hits.length) return null
    return { answer: "", hits, configured: true }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
