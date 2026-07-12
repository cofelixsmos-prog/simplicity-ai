"use client"

import {
  MeshGradient,
  Metaballs,
  NeuroNoise,
  SmokeRing,
  GodRays,
  Warp,
  Swirl,
  GrainGradient,
  DotOrbit,
} from "@paper-design/shaders-react"
import { useEffect, useState } from "react"
import { ambientTemperature } from "@/lib/color-temp"
import { LS_AUTO_MORNING, LS_BG_THEME, SETTINGS_EVENT, readLocalFlag, type UserSettings, type BgTheme } from "@/lib/settings"
import { loadBgVideo } from "@/lib/bg-video-store"

const MAX_PIXELS = 1280 * 720
const SIZING = { minPixelRatio: 1, maxPixelCount: MAX_PIXELS }

// ── MeshGradient palettes (6 colors each) ────────────────────────────────────
const MESH_PALETTES: Record<string, string[]> = {
  default:  ["#000000", "#141414", "#3a3a3a", "#5a5a5a", "#1f1f1f", "#454545"],
  aurora:   ["#041220", "#0a2a3f", "#1a5c6a", "#2d8a7a", "#0f3b5f", "#165e55"],
  ocean:    ["#020b18", "#071e3d", "#0c3b6e", "#1565a0", "#0a2b52", "#104a80"],
  sunset:   ["#1a0800", "#3d1200", "#7a2e10", "#b84a20", "#551a08", "#943818"],
  lavender: ["#0d0818", "#1a1035", "#2f1f5e", "#4a3080", "#1e1445", "#3a2568"],
  emerald:  ["#001a0f", "#003d22", "#006e3d", "#00a05a", "#00522c", "#008248"],
  midnight: ["#020208", "#060614", "#0c0c28", "#14143f", "#08081c", "#101032"],
  macOS:    ["#f04e7b", "#a855f7", "#3b82f6", "#06b6d4", "#f97316", "#ec4899"],
  candy:    ["#ff6b9d", "#c084fc", "#67e8f9", "#fbbf24", "#a78bfa", "#f472b6"],
  neon:     ["#00ff88", "#00ccff", "#8b5cf6", "#ff0080", "#00ff44", "#0088ff"],
  rose:     ["#4a1028", "#7a1e42", "#b83060", "#d44a78", "#5c1434", "#9a2854"],
  golden:   ["#1a1000", "#3d2800", "#7a5010", "#b88030", "#553808", "#946818"],
  arctic:   ["#e0f0ff", "#b0d4f1", "#80b8e3", "#5090c0", "#c0e0f8", "#90c8ef"],
}

const FALLBACK_GRADIENTS: Record<string, string> = {
  default:   "bg-[linear-gradient(160deg,#000,#3a3a3a,#0a0a0a)]",
  aurora:    "bg-[linear-gradient(160deg,#041220,#1a5c6a,#0a2a3f)]",
  ocean:     "bg-[linear-gradient(160deg,#020b18,#0c3b6e,#071e3d)]",
  sunset:    "bg-[linear-gradient(160deg,#1a0800,#7a2e10,#3d1200)]",
  lavender:  "bg-[linear-gradient(160deg,#0d0818,#2f1f5e,#1a1035)]",
  emerald:   "bg-[linear-gradient(160deg,#001a0f,#006e3d,#003d22)]",
  midnight:  "bg-[linear-gradient(160deg,#020208,#0c0c28,#060614)]",
  macOS:     "bg-[linear-gradient(160deg,#f04e7b,#a855f7,#3b82f6)]",
  candy:     "bg-[linear-gradient(160deg,#ff6b9d,#c084fc,#67e8f9)]",
  neon:      "bg-[linear-gradient(160deg,#00ff88,#8b5cf6,#ff0080)]",
  rose:      "bg-[linear-gradient(160deg,#4a1028,#b83060,#7a1e42)]",
  golden:    "bg-[linear-gradient(160deg,#1a1000,#7a5010,#3d2800)]",
  arctic:    "bg-[linear-gradient(160deg,#e0f0ff,#80b8e3,#b0d4f1)]",
  metaballs: "bg-[linear-gradient(160deg,#000,#6e33cc,#ff5500)]",
  neuro:     "bg-[linear-gradient(160deg,#000,#47a6ff,#000)]",
  smoke:     "bg-[linear-gradient(160deg,#000,#4540a4,#1fe8ff)]",
  godrays:   "bg-[linear-gradient(160deg,#000,#0000ff,#000)]",
  warp:      "bg-[linear-gradient(160deg,#121212,#9470ff,#121212)]",
  swirl:     "bg-[linear-gradient(160deg,#330000,#ff8a8a,#660000)]",
  grain:     "bg-[linear-gradient(160deg,#000,#7300ff,#00bfff)]",
  dots:      "bg-[linear-gradient(160deg,#000,#ffc96b,#ff2f00)]",
}

const RED = ["#0a0000", "#2a0606", "#6b1212", "#9e1b1b", "#1a0303", "#4a0d0d"]
const GREEN = ["#00100a", "#0a2e1e", "#12613f", "#1c8a58", "#061f14", "#0f4d31"]
const WARM = ["#0a0806", "#1a1512", "#3d352c", "#5d4f3f", "#221c15", "#453a2c"]
const COOL = ["#05070a", "#0d1620", "#293f52", "#3f5972", "#111a22", "#2c4054"]

const ALTERNATE_STYLES = new Set<BgTheme>(["metaballs", "neuro", "smoke", "godrays", "warp", "swirl", "grain", "dots"])

export type BgStatus = "idle" | "error" | "success"

export function ShaderBackground({
  fixed = false,
  status = "idle",
  calm = false,
  focus = false,
}: {
  fixed?: boolean
  status?: BgStatus
  calm?: boolean
  focus?: boolean
}) {
  const [mounted, setMounted] = useState(false)
  const [webgl, setWebgl] = useState(true)
  const [animate, setAnimate] = useState(true)
  const [nightManual, setNightManual] = useState<"on" | "off" | "auto">("auto")
  const [autoMorning, setAutoMorning] = useState(true)
  const [temp, setTemp] = useState(0)
  const [bgTheme, setBgTheme] = useState<BgTheme>("default")
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem("sx-night")
      setNightManual(stored === "1" ? "on" : stored === "0" ? "off" : "auto")
      setAutoMorning(readLocalFlag(LS_AUTO_MORNING))
      const theme = (localStorage.getItem(LS_BG_THEME) || "default") as BgTheme
      setBgTheme(theme)
      if (theme === "video") loadBgVideo().then(setVideoUrl)
    } catch {}
    const onNight = (e: Event) => setNightManual((e as CustomEvent<boolean>).detail ? "on" : "off")
    window.addEventListener("night-changed", onNight)
    const onSettings = (e: Event) => {
      const s = (e as CustomEvent<UserSettings>).detail
      if (s) {
        setAutoMorning(!!s.autoMorning)
        setBgTheme(s.bgTheme)
        if (s.bgTheme === "video") loadBgVideo().then(setVideoUrl)
      }
    }
    window.addEventListener(SETTINGS_EVENT, onSettings)
    try {
      const c = document.createElement("canvas")
      const gl =
        c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl")
      setWebgl(!!gl)
    } catch {
      setWebgl(false)
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setAnimate(!reduced.matches && document.visibilityState !== "hidden")
    sync()
    reduced.addEventListener("change", sync)
    document.addEventListener("visibilitychange", sync)

    const syncTemp = () => setTemp(ambientTemperature())
    syncTemp()
    const interval = setInterval(syncTemp, 60_000)
    document.addEventListener("visibilitychange", syncTemp)

    return () => {
      reduced.removeEventListener("change", sync)
      document.removeEventListener("visibilitychange", sync)
      document.removeEventListener("visibilitychange", syncTemp)
      window.removeEventListener("night-changed", onNight)
      window.removeEventListener(SETTINGS_EVENT, onSettings)
      clearInterval(interval)
    }
  }, [])

  const warmWeight = nightManual === "on" ? 1 : nightManual === "off" ? 0 : Math.max(0, temp)
  const coolWeight = nightManual === "on" ? 0 : autoMorning ? Math.max(0, -temp) : 0
  const idle = status === "idle"
  const speedMul = focus ? 0.2 : 1
  const baseSpeed = (calm ? 0.28 : 0.6) * speedMul

  const isPlainBlack = bgTheme === "plain-black"
  const isVideo = bgTheme === "video"
  const isAlternate = ALTERNATE_STYLES.has(bgTheme)
  const isMesh = !isPlainBlack && !isVideo && !isAlternate

  const full = { style: { width: "100%", height: "100%" } as const }

  const renderAlternateShader = () => {
    const spd = animate ? baseSpeed : 0
    switch (bgTheme) {
      case "metaballs":
        return (
          <Metaballs
            {...full}
            {...SIZING}
            colorBack="#000000"
            colors={["#6e33cc", "#ff5500", "#ffc105", "#ffc800", "#f585ff"]}
            count={10}
            size={0.83}
            scale={4}
            offsetX={-0.3}
            speed={spd * 0.8}
          />
        )
      case "neuro":
        return (
          <NeuroNoise
            {...full}
            {...SIZING}
            colorBack="#000000"
            colorMid="#47a6ff"
            colorFront="#ffffff"
            brightness={0.05}
            contrast={0.3}
            speed={spd}
          />
        )
      case "smoke":
        return (
          <SmokeRing
            {...full}
            {...SIZING}
            colorBack="#000000"
            colors={["#4540a4", "#1fe8ff"]}
            noiseScale={1.1}
            noiseIterations={2}
            radius={0.38}
            thickness={0.01}
            innerShape={0.88}
            speed={spd * 4}
          />
        )
      case "godrays":
        return (
          <GodRays
            {...full}
            {...SIZING}
            colorBack="#000000"
            colorBloom="#0000ff"
            colors={["#a600ff6e", "#6200fff0", "#ffffff", "#33fff5"]}
            density={0.3}
            spotty={0.3}
            midIntensity={0.4}
            midSize={0.2}
            intensity={0.8}
            bloom={0.4}
            offsetY={-0.55}
            speed={spd * 0.75}
          />
        )
      case "warp":
        return (
          <Warp
            {...full}
            {...SIZING}
            colors={["#121212", "#9470ff", "#121212", "#8838ff"]}
            proportion={0.45}
            softness={1}
            shape="checks"
            shapeScale={0.1}
            distortion={0.25}
            swirl={0.8}
            swirlIterations={10}
            speed={spd}
          />
        )
      case "swirl":
        return (
          <Swirl
            {...full}
            {...SIZING}
            colorBack="#330000"
            colors={["#ffd1d1", "#ff8a8a", "#660000"]}
            bandCount={4}
            twist={0.1}
            center={0.2}
            proportion={0.5}
            softness={0}
            noiseFrequency={0.4}
            noise={0.2}
            speed={spd * 0.5}
          />
        )
      case "grain":
        return (
          <GrainGradient
            {...full}
            {...SIZING}
            colorBack="#000000"
            colors={["#7300ff", "#eba8ff", "#00bfff", "#2a00ff"]}
            softness={0.5}
            intensity={0.5}
            noise={0.25}
            shape="corners"
            speed={spd}
          />
        )
      case "dots":
        return (
          <DotOrbit
            {...full}
            {...SIZING}
            colorBack="#000000"
            colors={["#ffc96b", "#ff6200", "#ff2f00", "#421100", "#1a0000"]}
            size={1}
            sizeRange={0}
            spreading={1}
            stepsPerColor={4}
            speed={spd * 1.5}
          />
        )
      default:
        return null
    }
  }

  return (
    <div
      className={`${fixed ? "fixed" : "absolute"} inset-0 -z-0 overflow-hidden bg-background transition-[filter] duration-[900ms] ease-out`}
      style={focus ? { filter: "saturate(0.7) brightness(0.55)" } : undefined}
    >
      {mounted && isPlainBlack && <div className="absolute inset-0 bg-black" />}

      {mounted && isVideo && videoUrl && (
        <video
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {mounted && isAlternate && webgl && renderAlternateShader()}

      {mounted && isMesh &&
        (webgl ? (
          <>
            <MeshGradient
              {...full}
              {...SIZING}
              colors={MESH_PALETTES[bgTheme] || MESH_PALETTES.default}
              distortion={1.3}
              swirl={0.9}
              grainMixer={0}
              grainOverlay={0}
              offsetX={0}
              speed={animate ? baseSpeed : 0}
            />
            <div
              className="absolute inset-0 transition-opacity duration-[2400ms] ease-out"
              style={{ opacity: idle ? warmWeight * 0.85 : 0 }}
            >
              <MeshGradient
                {...full}
                {...SIZING}
                colors={WARM}
                distortion={1.3}
                swirl={0.9}
                grainMixer={0}
                grainOverlay={0}
                offsetX={0}
                speed={animate && idle && warmWeight > 0.02 ? (calm ? 0.22 : 0.45) : 0}
              />
            </div>
            <div
              className="absolute inset-0 transition-opacity duration-[2400ms] ease-out"
              style={{ opacity: idle ? coolWeight * 0.8 : 0 }}
            >
              <MeshGradient
                {...full}
                {...SIZING}
                colors={COOL}
                distortion={1.3}
                swirl={0.9}
                grainMixer={0}
                grainOverlay={0}
                offsetX={0}
                speed={animate && idle && coolWeight > 0.02 ? (calm ? 0.22 : 0.45) : 0}
              />
            </div>
            <div
              className={`absolute inset-0 transition-opacity duration-[1800ms] ease-out ${
                status === "error" ? "opacity-100" : "opacity-0"
              }`}
            >
              <MeshGradient
                {...full}
                {...SIZING}
                colors={RED}
                distortion={1.3}
                swirl={0.9}
                grainMixer={0}
                grainOverlay={0}
                offsetX={0}
                speed={animate && status === "error" ? 0.95 : 0}
              />
            </div>
            <div
              className={`absolute inset-0 transition-opacity duration-[1800ms] ease-out ${
                status === "success" ? "opacity-100" : "opacity-0"
              }`}
            >
              <MeshGradient
                {...full}
                {...SIZING}
                colors={GREEN}
                distortion={1.3}
                swirl={0.9}
                grainMixer={0}
                grainOverlay={0}
                offsetX={0}
                speed={animate && status === "success" ? 0.6 : 0}
              />
            </div>
          </>
        ) : (
          <div
            className={`absolute inset-0 transition-colors duration-[1200ms] ${
              status === "error"
                ? "bg-[linear-gradient(160deg,#2a0606,#9e1b1b,#1a0303)]"
                : status === "success"
                  ? "bg-[linear-gradient(160deg,#0a2e1e,#1c8a58,#061f14)]"
                  : warmWeight > 0.15
                    ? "bg-[linear-gradient(160deg,#0a0806,#453a2c,#140f0a)]"
                    : coolWeight > 0.15
                      ? "bg-[linear-gradient(160deg,#05070a,#3f5972,#0d1620)]"
                      : (FALLBACK_GRADIENTS[bgTheme] || FALLBACK_GRADIENTS.default)
            }`}
          />
        ))}

      {mounted && isAlternate && !webgl && (
        <div className={`absolute inset-0 ${FALLBACK_GRADIENTS[bgTheme] || FALLBACK_GRADIENTS.default}`} />
      )}

      <div
        className={`pointer-events-none absolute inset-0 bg-black transition-opacity duration-[1800ms] ease-out ${
          focus ? "opacity-[0.62]" : calm ? "opacity-40" : "opacity-0"
        }`}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_45%,transparent_40%,rgba(0,0,0,0.6)_100%)]" />
    </div>
  )
}
