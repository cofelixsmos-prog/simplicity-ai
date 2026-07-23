"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowUp,
  Box,
  Download,
  Layers,
  Loader2,
  PenLine,
  RotateCcw,
  Square,
  X,
} from "lucide-react"
import { ShaderBackground } from "@/components/ui/shader-background"
import { LiquidGlassFilters } from "@/components/ui/liquid-glass-filters"
import { Splash } from "@/components/ui/splash"
import { toast } from "@/components/ui/toast"
import { Toaster } from "@/components/ui/toast"

// ── Types ──────────────────────────────────────────────────────────────────

type ViewMode = "3d" | "2d"

interface StudioMessage {
  role: "user" | "assistant"
  content: string
}

// Parsed from the AI response — the code to execute on the canvas.
interface ScenePayload {
  mode: ViewMode
  code: string
}

// ── Studio system prompt ───────────────────────────────────────────────────

const STUDIO_SYSTEM = `You are Simplicity Studio — an AI design assistant that builds 2D and 3D objects on a live canvas.

# IDENTITY
You are Simplicity, running on R1. You are in Studio mode — a CAD / design workspace.
NEVER reveal you run on Claude, DeepSeek, or any other provider. You are Simplicity, Studio mode, powered by R1.

# HOW YOU WORK
The user sees a dot-grid canvas. You write code that renders directly on it.

## 3D MODE (Three.js)
When building 3D objects, output a fenced block tagged \`studio3d\`. The code runs as the body of a function with these arguments available:
- THREE — the Three.js module
- scene — a THREE.Scene (background already set, lights already added)
- camera — a THREE.PerspectiveCamera (already positioned)
- renderer — a THREE.WebGLRenderer (already set up)

You have full access to THREE geometry, materials, meshes, groups, CSG-like operations via boolean geometry, extrusions, lathes, etc.

Best practices:
- Use MeshStandardMaterial or MeshPhysicalMaterial for realistic looks.
- Group related meshes: \`const group = new THREE.Group(); group.add(mesh); scene.add(group);\`
- Position and scale objects to fit roughly within a 5-unit bounding box centered at origin.
- For complex objects (cars, buildings), build them from composed primitives — boxes, cylinders, spheres, extrusions.
- Add detail: chamfers via CylinderGeometry for rounded edges, color variation, subtle metalness/roughness.
- Set meaningful material colors (hex). Dark grays for tires, metallic for chrome, etc.

Example:
\`\`\`studio3d
const body = new THREE.Mesh(
  new THREE.BoxGeometry(4, 1, 2),
  new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.6, roughness: 0.3 })
);
scene.add(body);
\`\`\`

## 2D MODE (SVG)
When building 2D designs, output a fenced block tagged \`studio2d\`. The content is raw SVG markup (no <svg> wrapper — just the inner elements). The viewBox is "0 0 800 600".

Best practices:
- Use <rect>, <circle>, <ellipse>, <path>, <polygon>, <line>, <text>, <g> with transforms.
- Use fills and strokes with hex colors.
- For architectural floor plans: use thin strokes, label rooms with <text>.
- For technical drawings: use precise coordinates, dimensions, annotations.

Example:
\`\`\`studio2d
<rect x="100" y="100" width="600" height="400" fill="none" stroke="#666" stroke-width="2"/>
<text x="400" y="320" text-anchor="middle" fill="#999" font-size="24">Room A</text>
\`\`\`

# WORKFLOW
1. If the request is clear, just BUILD IT immediately — output the code block.
2. If it's complex or ambiguous (a full building, a vehicle with many parts), ask 2–3 quick clarifying questions first, then build.
3. If the user asks for a plan, show a short numbered plan then wait for approval before building.
4. Each new code block REPLACES the previous scene (the canvas is cleared and re-rendered).
5. If the user asks to modify, output a COMPLETE new code block with the changes — don't output diffs.
6. You can also have normal conversations, answer questions, or produce documents alongside the visual work.

# PARAMETERS
When building parametric objects, define clear variables at the top of your code so the user can ask to tweak them:
\`\`\`studio3d
// Parameters
const width = 4;
const height = 2;
const depth = 2;
const color = 0x2563eb;
// Build
const box = new THREE.Mesh(
  new THREE.BoxGeometry(width, height, depth),
  new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.4 })
);
scene.add(box);
\`\`\`

# RULES
- Always output COMPLETE, runnable code — no imports, no exports, no module syntax.
- Keep code under 300 lines. For very complex scenes, build in stages across turns.
- Never output broken code. Test your geometry math.
- The user can export: 3D → STL/OBJ, 2D → SVG/PNG. Keep that in mind for precision.`

// ── Helpers ─────────────────────────────────────────────────────────────────

const RE_3D = /```(?:studio3d|threejs|javascript|js|three)\s*\n([\s\S]*?)```/
const RE_2D = /```(?:studio2d|svg|html)\s*\n([\s\S]*?)```/
const RE_ANY_BLOCK = /```(?:studio3d|threejs|javascript|js|three|studio2d|svg|html)\s*\n[\s\S]*?```/g

function parseSceneBlock(text: string): ScenePayload | null {
  const m3 = text.match(RE_3D)
  if (m3) return { mode: "3d", code: m3[1].trim() }
  const m2 = text.match(RE_2D)
  if (m2) return { mode: "2d", code: m2[1].trim() }
  return null
}

function stripCodeBlocks(text: string): string {
  return text.replace(RE_ANY_BLOCK, "").trim()
}

// ── 3D Renderer ─────────────────────────────────────────────────────────────

function render3D(
  container: HTMLElement,
  code: string,
  cleanupRef: { current: (() => void) | null }
) {
  if (cleanupRef.current) {
    cleanupRef.current()
    cleanupRef.current = null
  }
  container.innerHTML = ""

  import("three").then((THREE) => {
    const w = container.clientWidth || 800
    const h = container.clientHeight || 600

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a0b)

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000)
    camera.position.set(6, 4, 8)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.appendChild(renderer.domElement)

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(5, 8, 5)
    dirLight.castShadow = true
    scene.add(dirLight)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
    fillLight.position.set(-3, 2, -4)
    scene.add(fillLight)

    // Ground grid
    const grid = new THREE.GridHelper(20, 40, 0x333333, 0x222222)
    grid.position.y = -0.01
    scene.add(grid)

    try {
      const build = new Function("THREE", "scene", "camera", "renderer", code)
      build(THREE, scene, camera, renderer)
    } catch (e) {
      console.error("Studio 3D error:", e)
    }

    // Orbit controls (manual)
    let angle = 0
    let pitch = 0.4
    let dist = camera.position.length()
    let dragging = false
    let lastX = 0
    let lastY = 0

    const onDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      angle += (e.clientX - lastX) * 0.008
      pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - lastY) * 0.008))
      lastX = e.clientX
      lastY = e.clientY
    }
    const onUp = () => { dragging = false }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      dist = Math.max(2, Math.min(40, dist + e.deltaY * 0.01))
    }

    renderer.domElement.addEventListener("pointerdown", onDown)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false })

    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      if (!dragging) angle += 0.002
      camera.position.x = Math.sin(angle) * Math.cos(pitch) * dist
      camera.position.y = Math.sin(pitch) * dist + 2
      camera.position.z = Math.cos(angle) * Math.cos(pitch) * dist
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      const nw = container.clientWidth
      const nh = container.clientHeight
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    }
    window.addEventListener("resize", handleResize)

    cleanupRef.current = () => {
      cancelAnimationFrame(raf)
      renderer.domElement.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      renderer.domElement.removeEventListener("wheel", onWheel)
      window.removeEventListener("resize", handleResize)
      renderer.dispose()
      container.innerHTML = ""
    }
  })
}

// ── 2D Renderer ─────────────────────────────────────────────────────────────

function render2D(container: HTMLElement, code: string) {
  container.innerHTML = `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">${code}</svg>`
}

// ── Export helpers ───────────────────────────────────────────────────────────

async function exportSTL(code: string) {
  const THREE = await import("three")
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera()
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas") })
  try {
    const build = new Function("THREE", "scene", "camera", "renderer", code)
    build(THREE, scene, camera, renderer)
  } catch { return }

  const geometries: { geometry: import("three").BufferGeometry; matrix: import("three").Matrix4 }[] = []
  scene.traverse((obj) => {
    if ((obj as import("three").Mesh).isMesh) {
      const mesh = obj as import("three").Mesh
      const g = mesh.geometry.clone()
      g.applyMatrix4(mesh.matrixWorld)
      geometries.push({ geometry: g, matrix: new THREE.Matrix4() })
    }
  })
  if (!geometries.length) return

  const merged = new THREE.BufferGeometry()
  const allPos: number[] = []
  for (const { geometry } of geometries) {
    const idx = geometry.index
    const pos = geometry.getAttribute("position") as import("three").BufferAttribute
    if (idx) {
      for (let i = 0; i < idx.count; i++) allPos.push(pos.getX(idx.getX(i)), pos.getY(idx.getX(i)), pos.getZ(idx.getX(i)))
    } else {
      for (let i = 0; i < pos.count; i++) allPos.push(pos.getX(i), pos.getY(i), pos.getZ(i))
    }
  }
  merged.setAttribute("position", new THREE.Float32BufferAttribute(allPos, 3))
  merged.computeVertexNormals()

  const normals = merged.getAttribute("normal") as import("three").BufferAttribute
  const positions = merged.getAttribute("position") as import("three").BufferAttribute
  const triangles = positions.count / 3
  const bufLen = 80 + 4 + triangles * 50
  const buf = new ArrayBuffer(bufLen)
  const dv = new DataView(buf)
  dv.setUint32(80, triangles, true)
  let offset = 84
  for (let i = 0; i < triangles; i++) {
    const i3 = i * 3
    dv.setFloat32(offset, normals.getX(i3), true); offset += 4
    dv.setFloat32(offset, normals.getY(i3), true); offset += 4
    dv.setFloat32(offset, normals.getZ(i3), true); offset += 4
    for (let v = 0; v < 3; v++) {
      dv.setFloat32(offset, positions.getX(i3 + v), true); offset += 4
      dv.setFloat32(offset, positions.getY(i3 + v), true); offset += 4
      dv.setFloat32(offset, positions.getZ(i3 + v), true); offset += 4
    }
    dv.setUint16(offset, 0, true); offset += 2
  }

  const blob = new Blob([buf], { type: "application/octet-stream" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "studio-model.stl"
  a.click()
  URL.revokeObjectURL(url)
  renderer.dispose()
}

async function exportOBJ(code: string) {
  const THREE = await import("three")
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera()
  const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas") })
  try {
    const build = new Function("THREE", "scene", "camera", "renderer", code)
    build(THREE, scene, camera, renderer)
  } catch { return }

  const lines: string[] = ["# Simplicity Studio OBJ Export"]
  let vertexOffset = 0
  scene.traverse((obj) => {
    if ((obj as import("three").Mesh).isMesh) {
      const mesh = obj as import("three").Mesh
      const g = mesh.geometry.clone()
      g.applyMatrix4(mesh.matrixWorld)
      const pos = g.getAttribute("position") as import("three").BufferAttribute
      const idx = g.index
      for (let i = 0; i < pos.count; i++) {
        lines.push(`v ${pos.getX(i).toFixed(6)} ${pos.getY(i).toFixed(6)} ${pos.getZ(i).toFixed(6)}`)
      }
      if (idx) {
        for (let i = 0; i < idx.count; i += 3) {
          lines.push(`f ${idx.getX(i) + 1 + vertexOffset} ${idx.getX(i + 1) + 1 + vertexOffset} ${idx.getX(i + 2) + 1 + vertexOffset}`)
        }
      } else {
        for (let i = 0; i < pos.count; i += 3) {
          lines.push(`f ${i + 1 + vertexOffset} ${i + 2 + vertexOffset} ${i + 3 + vertexOffset}`)
        }
      }
      vertexOffset += pos.count
    }
  })
  const blob = new Blob([lines.join("\n")], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "studio-model.obj"
  a.click()
  URL.revokeObjectURL(url)
  renderer.dispose()
}

function exportSVG(code: string) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">\n${code}\n</svg>`
  const blob = new Blob([svg], { type: "image/svg+xml" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "studio-design.svg"
  a.click()
  URL.revokeObjectURL(url)
}

function exportPNG(container: HTMLElement) {
  const svg = container.querySelector("svg")
  if (!svg) return
  const svgData = new XMLSerializer().serializeToString(svg)
  const canvas = document.createElement("canvas")
  canvas.width = 1600
  canvas.height = 1200
  const ctx = canvas.getContext("2d")!
  const img = new Image()
  img.onload = () => {
    ctx.fillStyle = "#0b0b0c"
    ctx.fillRect(0, 0, 1600, 1200)
    ctx.drawImage(img, 0, 0, 1600, 1200)
    const url = canvas.toDataURL("image/png")
    const a = document.createElement("a")
    a.href = url
    a.download = "studio-design.png"
    a.click()
  }
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
}

// ── Main component ──────────────────────────────────────────────────────────

export default function StudioPage() {
  const [user, setUser] = useState<{ email: string; name: string | null } | null | undefined>(undefined)
  const [splashHold, setSplashHold] = useState(true)

  // Canvas state
  const [viewMode, setViewMode] = useState<ViewMode>("3d")
  const [currentCode, setCurrentCode] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Chat state
  const [messages, setMessages] = useState<StudioMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(true)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Export menu
  const [exportOpen, setExportOpen] = useState(false)

  // Auth
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/auth/me")
        const d = await res.json()
        if (!d.user) { window.location.href = "/login"; return }
        setUser({ email: d.user.email, name: d.user.name })
      } catch { window.location.href = "/login" }
    })()
  }, [])

  useEffect(() => {
    if (user !== undefined && splashHold) {
      const t = setTimeout(() => setSplashHold(false), 800)
      return () => clearTimeout(t)
    }
  }, [user, splashHold])

  // Render scene whenever code or mode changes
  useEffect(() => {
    const el = canvasRef.current
    if (!el || !currentCode) return
    if (viewMode === "3d") {
      render3D(el, currentCode, cleanupRef)
    } else {
      render2D(el, currentCode)
    }
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [currentCode, viewMode])

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Send message
  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput("")
    const userMsg: StudioMessage = { role: "user", content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "r1",
          studioMode: true,
          studioViewMode: viewMode,
          messages: [
            { role: "system", content: STUDIO_SYSTEM },
            ...updated.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      })

      if (!res.ok) {
        setMessages([...updated, { role: "assistant", content: "Something went wrong — please try again." }])
        setLoading(false)
        return
      }

      // Stream the response — the API emits NDJSON (one JSON object per line).
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let full = ""
      let buffer = ""

      if (reader) {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            try {
              const ev = JSON.parse(trimmed) as { t: string; v?: string }
              if (ev.t === "text" && ev.v) {
                full += ev.v
                setMessages([...updated, { role: "assistant", content: full }])
              }
            } catch {}
          }
        }
      }

      // Parse scene block from the completed response
      const scene = parseSceneBlock(full)
      if (scene) {
        if (scene.mode !== viewMode) setViewMode(scene.mode)
        setCurrentCode(scene.code)
      } else {
        console.warn("[studio] no scene block found in response:", full.slice(0, 300))
      }

      setMessages([...updated, { role: "assistant", content: full }])
    } catch {
      setMessages([...updated, { role: "assistant", content: "Network error — please try again." }])
    } finally {
      setLoading(false)
    }
  }, [input, messages, loading, viewMode])

  const handleExport = (format: string) => {
    setExportOpen(false)
    if (!currentCode) {
      toast("Nothing to export yet — build something first.")
      return
    }
    if (format === "stl") exportSTL(currentCode)
    else if (format === "obj") exportOBJ(currentCode)
    else if (format === "svg") exportSVG(currentCode)
    else if (format === "png" && canvasRef.current) exportPNG(canvasRef.current)
    toast(`Exporting as .${format}…`)
  }

  const resetCanvas = () => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null }
    if (canvasRef.current) canvasRef.current.innerHTML = ""
    setCurrentCode(null)
  }

  // Splash / auth loading
  if (user === undefined) {
    return (
      <>
        {splashHold && <Splash />}
        <div className="h-dvh bg-background" />
      </>
    )
  }

  return (
    <>
      {splashHold && <Splash />}
      <div className="relative flex h-dvh overflow-hidden">
        <ShaderBackground fixed calm />
        <LiquidGlassFilters />

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div className="absolute inset-x-0 top-0 z-30 flex h-12 items-center justify-between border-b border-white/[0.06] bg-black/40 px-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <a
              href="/menu"
              className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="size-3" />
              Menu
            </a>
            <div className="h-4 w-px bg-white/10" />
            <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/35">
              <Box className="size-3" />
              Studio
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* 2D / 3D toggle */}
            <div className="flex rounded-full border border-white/10 p-0.5">
              <button
                onClick={() => setViewMode("3d")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  viewMode === "3d" ? "bg-white text-black" : "text-white/50 hover:text-white"
                }`}
              >
                <Box className="size-3" />
                3D
              </button>
              <button
                onClick={() => setViewMode("2d")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  viewMode === "2d" ? "bg-white text-black" : "text-white/50 hover:text-white"
                }`}
              >
                <Layers className="size-3" />
                2D
              </button>
            </div>

            {/* Reset */}
            <button
              onClick={resetCanvas}
              className="flex size-8 items-center justify-center rounded-full border border-white/10 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
              title="Clear canvas"
            >
              <RotateCcw className="size-3.5" />
            </button>

            {/* Export */}
            <div className="relative">
              <button
                onClick={() => setExportOpen(!exportOpen)}
                className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
              >
                <Download className="size-3" />
                Export
              </button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-36 overflow-hidden rounded-xl border border-white/10 bg-black/80 p-1 backdrop-blur-xl">
                    {viewMode === "3d" ? (
                      <>
                        <button onClick={() => handleExport("stl")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10 hover:text-white">
                          Export .STL
                        </button>
                        <button onClick={() => handleExport("obj")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10 hover:text-white">
                          Export .OBJ
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleExport("svg")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10 hover:text-white">
                          Export .SVG
                        </button>
                        <button onClick={() => handleExport("png")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10 hover:text-white">
                          Export .PNG
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Canvas ──────────────────────────────────────────────────── */}
        <div className="relative flex-1">
          {/* Dot grid background */}
          <div
            className="absolute inset-0 top-12"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Three.js / SVG mount */}
          <div
            ref={canvasRef}
            className="absolute inset-0 top-12 z-20"
          />

          {/* Empty state */}
          {!currentCode && (
            <div className="absolute inset-0 top-12 z-30 flex flex-col items-center justify-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                {viewMode === "3d" ? (
                  <Box className="size-7 text-white/20" strokeWidth={1.2} />
                ) : (
                  <PenLine className="size-7 text-white/20" strokeWidth={1.2} />
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/30">
                  {viewMode === "3d" ? "3D Canvas" : "2D Canvas"}
                </p>
                <p className="mt-1 text-xs text-white/20">
                  Describe what you want to build in the chat panel
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Chat side panel ─────────────────────────────────────────── */}
        <div
          className={`relative z-20 flex flex-col border-l border-white/[0.06] bg-black/40 backdrop-blur-xl transition-all duration-300 ${
            chatOpen ? "w-[380px]" : "w-0"
          }`}
        >
          {!chatOpen && (
            <button
              onClick={() => setChatOpen(true)}
              className="absolute -left-10 top-14 z-30 flex size-8 items-center justify-center rounded-l-lg border border-r-0 border-white/10 bg-black/60 text-white/50 backdrop-blur-xl hover:text-white"
            >
              <ArrowLeft className="size-3.5 rotate-180" />
            </button>
          )}

          {chatOpen && (
            <>
              {/* Chat header */}
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
                <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
                  Studio Chat
                </span>
                <button
                  onClick={() => setChatOpen(false)}
                  className="flex size-6 items-center justify-center rounded-full text-white/30 hover:bg-white/10 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {messages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <Box className="mb-3 size-8 text-white/15" strokeWidth={1.2} />
                    <p className="text-sm font-medium text-white/30">
                      What do you want to build?
                    </p>
                    <p className="mt-1.5 text-xs text-white/20">
                      &ldquo;A red sports car&rdquo; · &ldquo;A modern house&rdquo; · &ldquo;A floor plan&rdquo;
                    </p>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`mb-3 ${msg.role === "user" ? "flex justify-end" : ""}`}>
                    {msg.role === "user" ? (
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-white/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-white/90">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="max-w-[95%]">
                        <div className="text-[13px] leading-relaxed text-white/70 whitespace-pre-wrap">
                          {stripCodeBlocks(msg.content) || (
                            <span className="text-white/40 italic">Building on canvas…</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center gap-2 text-xs text-white/30">
                    <Loader2 className="size-3 animate-spin" />
                    Thinking…
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-white/[0.06] p-3">
                <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        send()
                      }
                    }}
                    placeholder="Describe what to build…"
                    rows={1}
                    className="max-h-24 flex-1 resize-none bg-transparent text-[13px] text-white outline-none placeholder:text-white/25"
                  />
                  <button
                    onClick={send}
                    disabled={loading || !input.trim()}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-black transition-all hover:opacity-90 disabled:opacity-30"
                  >
                    {loading ? <Square className="size-3" /> : <ArrowUp className="size-3.5" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Toaster />
    </>
  )
}
