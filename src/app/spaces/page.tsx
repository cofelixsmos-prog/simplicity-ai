"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"
import { ShaderBackground } from "@/components/ui/shader-background"
import { LiquidGlassFilters } from "@/components/ui/liquid-glass-filters"
import { toast } from "@/components/ui/toast"

// ── Types ───────────────────────────────────────────────────────────────────

interface MindNode {
  id: string
  label: string
  parent: string | null
  children: string[]
  x: number
  y: number
  depth: number
  expanded: boolean
  expanding: boolean
  angle: number
}

type NodeMap = Record<string, MindNode>

let nextId = 0
function uid() {
  return `n${++nextId}`
}

// ── Layout constants ────────────────────────────────────────────────────────

const RING_GAP = 180
const NODE_RX = 80
const NODE_RY = 32

// ── Color palette per depth ─────────────────────────────────────────────────

const DEPTH_COLORS = [
  { bg: "rgba(255,255,255,0.12)", border: "rgba(255,255,255,0.35)", text: "#fff" },
  { bg: "rgba(99,102,241,0.18)", border: "rgba(129,140,248,0.5)", text: "#c7d2fe" },
  { bg: "rgba(20,184,166,0.16)", border: "rgba(94,234,212,0.45)", text: "#99f6e4" },
  { bg: "rgba(244,114,182,0.15)", border: "rgba(244,114,182,0.45)", text: "#fbcfe8" },
  { bg: "rgba(251,191,36,0.14)", border: "rgba(252,211,77,0.45)", text: "#fde68a" },
  { bg: "rgba(168,85,247,0.15)", border: "rgba(192,132,252,0.45)", text: "#e9d5ff" },
]

function depthColor(d: number) {
  return DEPTH_COLORS[Math.min(d, DEPTH_COLORS.length - 1)]
}

// ── Position children around a parent ───────────────────────────────────────

function positionChildren(
  nodes: NodeMap,
  parentId: string,
  childIds: string[],
): NodeMap {
  const parent = nodes[parentId]
  if (!parent) return nodes
  const n = childIds.length
  const radius = RING_GAP * (parent.depth + 1) * 0.65 + RING_GAP * 0.5

  // Fan out from the parent's angle (or full circle for root)
  const isRoot = parent.parent === null
  const fanSpread = isRoot ? Math.PI * 2 : Math.min(Math.PI * 0.85, n * 0.42)
  const baseAngle = isRoot ? -Math.PI / 2 : parent.angle
  const startAngle = baseAngle - fanSpread / 2

  const updated = { ...nodes }
  childIds.forEach((cid, i) => {
    const angle = startAngle + (n === 1 ? fanSpread / 2 : (fanSpread / (n - 1)) * i)
    updated[cid] = {
      ...updated[cid],
      x: parent.x + Math.cos(angle) * radius,
      y: parent.y + Math.sin(angle) * radius,
      angle,
    }
  })
  return updated
}

// ── The page ────────────────────────────────────────────────────────────────

export default function SpacesPage() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [topic, setTopic] = useState("")
  const [started, setStarted] = useState(false)
  const [nodes, setNodes] = useState<NodeMap>({})
  const [rootId, setRootId] = useState<string | null>(null)

  // Canvas pan & zoom
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const panStart = useRef({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)

  // Auth check
  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch("/api/auth/me")
        const d = await r.json()
        if (!d.user) { router.replace("/login"); return }
        setAuthed(true)
      } catch { router.replace("/login") }
    })()
  }, [router])

  // ── Expand a node ─────────────────────────────────────────────────────────

  const expand = useCallback(async (nodeId: string, currentNodes: NodeMap, currentTopic: string) => {
    const node = currentNodes[nodeId]
    if (!node || node.expanded || node.expanding) return

    setNodes((prev) => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], expanding: true },
    }))

    const siblings = node.parent
      ? (currentNodes[node.parent]?.children ?? [])
          .filter((c) => c !== nodeId)
          .map((c) => currentNodes[c]?.label)
          .filter(Boolean)
      : []

    try {
      const r = await fetch("/api/spaces/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: currentTopic,
          parent: node.label,
          siblings,
        }),
      })

      if (!r.ok) {
        toast("Couldn't expand that node.", "error")
        setNodes((prev) => ({
          ...prev,
          [nodeId]: { ...prev[nodeId], expanding: false },
        }))
        return
      }

      const { branches } = (await r.json()) as { branches: string[] }

      setNodes((prev) => {
        const childIds = branches.map(() => uid())
        let updated = { ...prev }

        childIds.forEach((cid, i) => {
          updated[cid] = {
            id: cid,
            label: branches[i],
            parent: nodeId,
            children: [],
            x: prev[nodeId].x,
            y: prev[nodeId].y,
            depth: prev[nodeId].depth + 1,
            expanded: false,
            expanding: false,
            angle: 0,
          }
        })

        updated[nodeId] = {
          ...updated[nodeId],
          expanded: true,
          expanding: false,
          children: childIds,
        }

        updated = positionChildren(updated, nodeId, childIds)
        return updated
      })
    } catch {
      toast("Network error — try again.", "error")
      setNodes((prev) => ({
        ...prev,
        [nodeId]: { ...prev[nodeId], expanding: false },
      }))
    }
  }, [])

  // ── Start a new map ───────────────────────────────────────────────────────

  const startMap = useCallback(async (t: string) => {
    const trimmed = t.trim()
    if (!trimmed) return

    setStarted(true)
    setZoom(1)
    setPan({ x: 0, y: 0 })

    const rid = uid()
    const rootNode: MindNode = {
      id: rid,
      label: trimmed,
      parent: null,
      children: [],
      x: 0,
      y: 0,
      depth: 0,
      expanded: false,
      expanding: false,
      angle: 0,
    }

    const initialNodes: NodeMap = { [rid]: rootNode }
    setNodes(initialNodes)
    setRootId(rid)

    await expand(rid, initialNodes, trimmed)
  }, [expand])

  // ── Reset ─────────────────────────────────────────────────────────────────

  const reset = () => {
    setStarted(false)
    setNodes({})
    setRootId(null)
    setTopic("")
    nextId = 0
  }

  // ── Pan handlers ──────────────────────────────────────────────────────────

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    dragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    panStart.current = { ...pan }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    setPan({
      x: panStart.current.x + (e.clientX - dragStart.current.x),
      y: panStart.current.y + (e.clientY - dragStart.current.y),
    })
  }

  const onPointerUp = () => {
    dragging.current = false
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => Math.min(3, Math.max(0.15, z - e.deltaY * 0.001)))
  }

  const zoomIn = () => setZoom((z) => Math.min(3, z + 0.2))
  const zoomOut = () => setZoom((z) => Math.max(0.15, z - 0.2))

  // ── Render ────────────────────────────────────────────────────────────────

  if (!authed) return <div className="h-dvh bg-[#08080a]" />

  const nodeList = Object.values(nodes)

  // Build edges
  const edges: { x1: number; y1: number; x2: number; y2: number; depth: number }[] = []
  for (const n of nodeList) {
    if (n.parent && nodes[n.parent]) {
      edges.push({
        x1: nodes[n.parent].x,
        y1: nodes[n.parent].y,
        x2: n.x,
        y2: n.y,
        depth: n.depth,
      })
    }
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-[#08080a]">
      <ShaderBackground fixed calm />
      <LiquidGlassFilters />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => router.push("/menu")}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            Menu
          </button>
          {started && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="size-3.5" />
              New
            </button>
          )}
        </div>
        {started && (
          <div className="pointer-events-auto flex items-center gap-1">
            <button onClick={zoomOut} className="inline-flex size-8 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white" aria-label="Zoom out">
              <ZoomOut className="size-4" />
            </button>
            <span className="min-w-[3ch] text-center font-mono text-[11px] text-white/40">{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn} className="inline-flex size-8 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white" aria-label="Zoom in">
              <ZoomIn className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Hero / input — before a map starts */}
      {!started && (
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-4">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="anim-rise text-[10px] tracking-[0.6em] text-white/25" style={{ ["--delay" as string]: "0ms" }}>
              ✦ ✦ ✦
            </div>
            <h1 className="anim-rise mt-6 text-4xl font-semibold tracking-tight text-white sm:text-[44px]" style={{ ["--delay" as string]: "100ms" }}>
              Spaces
            </h1>
            <p className="anim-rise mt-3 max-w-md text-[15px] text-white/50" style={{ ["--delay" as string]: "220ms" }}>
              Type any topic. Watch it unfold into a living mind map you can explore endlessly.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              startMap(topic)
            }}
            className="anim-rise w-full max-w-lg"
            style={{ ["--delay" as string]: "340ms" }}
          >
            <div className="liquid-glass flex items-center gap-3 rounded-2xl px-5 py-4 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6)] focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_24px_64px_-16px_rgba(0,0,0,0.75)]">
              <input
                autoFocus
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Quantum computing, Renaissance art, startup fundraising…"
                className="min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-white/35 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!topic.trim()}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition-all hover:scale-105 disabled:scale-100 disabled:opacity-30"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* The canvas — pan + zoom + nodes */}
      {started && (
        <div
          ref={canvasRef}
          className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          style={{ touchAction: "none" }}
        >
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            {/* Edges */}
            <svg
              className="pointer-events-none absolute"
              style={{
                left: "-4000px",
                top: "-4000px",
                width: "8000px",
                height: "8000px",
                overflow: "visible",
              }}
            >
              <defs>
                <filter id="edge-glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {edges.map((e, i) => {
                const c = depthColor(e.depth)
                return (
                  <line
                    key={i}
                    x1={e.x1 + 4000}
                    y1={e.y1 + 4000}
                    x2={e.x2 + 4000}
                    y2={e.y2 + 4000}
                    stroke={c.border}
                    strokeWidth={1.5}
                    strokeOpacity={0.5}
                    filter="url(#edge-glow)"
                    className="animate-in fade-in duration-700"
                  />
                )
              })}
            </svg>

            {/* Nodes */}
            {nodeList.map((n) => {
              const c = depthColor(n.depth)
              const isRoot = n.parent === null
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.expanded && !n.expanding) {
                      expand(n.id, nodes, nodeList.find((nd) => nd.parent === null)?.label ?? topic)
                    }
                  }}
                  disabled={n.expanded && n.children.length > 0}
                  className="absolute animate-in fade-in zoom-in-50 duration-500"
                  style={{
                    left: `${n.x - (isRoot ? 100 : NODE_RX)}px`,
                    top: `${n.y - (isRoot ? 40 : NODE_RY)}px`,
                    width: isRoot ? 200 : NODE_RX * 2,
                    height: isRoot ? 80 : NODE_RY * 2,
                    animationDelay: `${n.depth * 80}ms`,
                    animationFillMode: "backwards",
                  }}
                >
                  <div
                    className={`flex h-full items-center justify-center rounded-2xl border px-4 text-center backdrop-blur-md transition-all duration-300 ${
                      n.expanding
                        ? "scale-105 shadow-[0_0_30px_-5px_rgba(255,255,255,0.2)]"
                        : n.expanded
                          ? "opacity-80"
                          : "hover:scale-105 hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.15)]"
                    }`}
                    style={{
                      background: c.bg,
                      borderColor: c.border,
                    }}
                  >
                    {n.expanding ? (
                      <Loader2 className="size-4 animate-spin" style={{ color: c.text }} />
                    ) : (
                      <span
                        className={`leading-tight ${isRoot ? "text-base font-semibold" : "text-[13px] font-medium"}`}
                        style={{ color: c.text }}
                      >
                        {n.label}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Instructions hint */}
      {started && nodeList.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center">
          <p className="rounded-full border border-white/8 bg-black/40 px-4 py-2 text-[12px] text-white/35 backdrop-blur-sm">
            Click any node to expand · Scroll to zoom · Drag to pan
          </p>
        </div>
      )}
    </main>
  )
}
