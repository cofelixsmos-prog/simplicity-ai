import { Navbar } from "@/components/ui/navbar"
import { Footer } from "@/components/ui/footer"
import { Terminal, Zap, Code2, Boxes, Gauge, Lock } from "lucide-react"

export const metadata = {
  title: "Developers — Simplicity",
  description:
    "Build with Simplicity. A clean, OpenAI-compatible API for R1 — streaming, fast, and simple.",
}

const features = [
  { icon: Zap, title: "Streaming first", desc: "Token-by-token responses over a standard stream. Low latency, no polling." },
  { icon: Code2, title: "OpenAI-compatible", desc: "Drop-in chat completions shape. Reuse the clients and tooling you already have." },
  { icon: Boxes, title: "Multi-format output", desc: "Ask for flowcharts, 2D SVG illustrations, or 3D models — rendered client-side." },
  { icon: Gauge, title: "One capable model", desc: "R1 — fast, agentic, and always on. No model-picker decisions." },
  { icon: Lock, title: "Keys stay server-side", desc: "Calls run through your backend. Your API key is never exposed to the browser." },
  { icon: Terminal, title: "Tiny surface area", desc: "One endpoint, a messages array, and a model id. That's the whole API." },
]

const codeSample = `// app/api/chat/route.ts
import OpenAI from "openai"

const simplicity = new OpenAI({
  apiKey: process.env.SIMPLICITY_API_KEY,
  baseURL: "https://api.simplicity.ai/v1",
})

export async function POST(req: Request) {
  const { messages } = await req.json()

  const stream = await simplicity.chat.completions.create({
    model: "r1",           // the one Simplicity model
    messages,
    stream: true,
  })

  // pipe the stream straight back to the client
  return new Response(toReadable(stream))
}`

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-40">
        {/* Hero */}
        <div className="max-w-2xl">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Developers
          </p>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-[56px]">
            Build with Simplicity.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            One endpoint. Two models. Streaming by default. The whole API is a
            messages array and a model id — intelligence without the integration
            overhead.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="/chat"
              className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-all hover:shadow-[0_0_30px_-6px_rgba(255,255,255,0.5)]"
            >
              Try it live
            </a>
            <a
              href="/resources"
              className="rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Read the docs
            </a>
          </div>
        </div>

        {/* Code sample */}
        <div className="mt-20 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="size-3 rounded-full bg-white/15" />
            <span className="size-3 rounded-full bg-white/15" />
            <span className="size-3 rounded-full bg-white/15" />
            <span className="ml-3 font-mono text-xs text-muted-foreground">
              route.ts
            </span>
          </div>
          <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed">
            <code className="font-mono text-foreground/90">{codeSample}</code>
          </pre>
        </div>

        {/* Features */}
        <div className="mt-24">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Everything you need, nothing you don&apos;t.
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group bg-card p-7 transition-colors hover:bg-secondary/40"
              >
                <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-background text-foreground/80 transition-colors group-hover:text-foreground">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-base font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
