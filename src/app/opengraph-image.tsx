import { ImageResponse } from "next/og"

export const runtime = "nodejs"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Simplicity — Intelligence, simplified."

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#060607",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.08), transparent 55%), radial-gradient(circle at 75% 80%, rgba(255,255,255,0.05), transparent 55%)",
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 64,
              height: 64,
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.04)",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            S
          </div>
        </div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "#fff",
            display: "flex",
          }}
        >
          Simplicity
        </div>
        <div
          style={{
            fontSize: 30,
            color: "rgba(255,255,255,0.55)",
            marginTop: 18,
            display: "flex",
          }}
        >
          Fast. Focused. Frontier reasoning.
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 44,
            fontSize: 22,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.04em",
          }}
        >
          <span style={{ display: "flex" }}>MADE IN INDIA</span>
          <span style={{ display: "flex" }}>·</span>
          <span style={{ display: "flex" }}>MADE FOR INDIA</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
