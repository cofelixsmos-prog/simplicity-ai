"use client"

import { memo, useEffect, useRef, useState } from "react"

// Memoized so a parent re-render (e.g. another streaming chunk landing on the
// same message) doesn't tear down and rebuild the whole WebGL context — that
// teardown was what caused the canvas to flash black and the chat to flicker.
export const ThreeDiagram = memo(function ThreeDiagram({
  code,
  streaming = false,
}: {
  code: string
  streaming?: boolean
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  // Always run the latest code without making it an effect dependency, so the
  // scene builds once (when streaming ends) rather than on every keystroke.
  const codeRef = useRef(code)
  codeRef.current = code

  useEffect(() => {
    if (streaming) return
    const mount = mountRef.current
    if (!mount) return

    let cleanup = () => {}
    let cancelled = false

    ;(async () => {
      try {
        const THREE = await import("three")

        const width = mount.clientWidth || 600
        const height = 380

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0b0b0c)

        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
        camera.position.set(4, 3, 6)
        camera.lookAt(0, 0, 0)

        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(width, height)
        if (cancelled) {
          renderer.dispose()
          return
        }
        mount.innerHTML = ""
        mount.appendChild(renderer.domElement)

        // Run model-authored scene builder in a sandbox.
        const build = new Function(
          "THREE",
          "scene",
          "camera",
          "renderer",
          codeRef.current
        )
        build(THREE, scene, camera, renderer)

        // Auto-rotate; allow drag to spin.
        let angle = 0
        let dragging = false
        let lastX = 0
        let manualAngle = 0
        const radius = camera.position.length()

        const onDown = (e: PointerEvent) => {
          dragging = true
          lastX = e.clientX
        }
        const onMove = (e: PointerEvent) => {
          if (!dragging) return
          manualAngle += (e.clientX - lastX) * 0.01
          lastX = e.clientX
        }
        const onUp = () => {
          dragging = false
        }
        renderer.domElement.addEventListener("pointerdown", onDown)
        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)

        let raf = 0
        const animate = () => {
          raf = requestAnimationFrame(animate)
          if (!dragging) angle += 0.004
          const a = angle + manualAngle
          camera.position.x = Math.sin(a) * radius
          camera.position.z = Math.cos(a) * radius
          camera.lookAt(0, 0, 0)
          renderer.render(scene, camera)
        }
        animate()

        cleanup = () => {
          cancelAnimationFrame(raf)
          renderer.domElement.removeEventListener("pointerdown", onDown)
          window.removeEventListener("pointermove", onMove)
          window.removeEventListener("pointerup", onUp)
          renderer.dispose()
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to render 3D scene")
      }
    })()

    return () => {
      cancelled = true
      cleanup()
    }
  }, [streaming])

  if (streaming) {
    return (
      <div className="my-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        Building 3D model…
      </div>
    )
  }

  if (error) {
    return (
      <div className="my-4 rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-xs text-muted-foreground">3D source</p>
        <pre className="overflow-x-auto text-xs text-foreground/70">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border bg-[#0b0b0c]">
      <div ref={mountRef} className="w-full cursor-grab active:cursor-grabbing" />
      <p className="border-t border-border px-3 py-1.5 text-center text-[11px] text-muted-foreground">
        Drag to rotate · auto-rotating
      </p>
    </div>
  )
})
