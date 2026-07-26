// components/ui/StudioUI.jsx
// Elementos UI inspirados en la consola de audio profesional
// — LED indicator, VU Meter, Digital Readout, Knob decorativo, Fader decorativo

import { useEffect, useRef, useState } from "react"

// ─────────────────────────────────────────────────────────────────
// LED indicator — punto luminoso pulsante estilo consola REC
// ─────────────────────────────────────────────────────────────────
export function LED({ color = "green", label, blinking = true, size = 8 }) {
  const colors = {
    green:  { base: "#1aff6e", glow: "rgba(26,255,110,0.6)" },
    red:    { base: "#ff4d4d", glow: "rgba(255,77,77,0.6)" },
    amber:  { base: "#ffb340", glow: "rgba(255,179,64,0.6)" },
    dim:    { base: "#3a3a3a", glow: "rgba(120,120,120,0.3)" },
  }
  const c = colors[color]
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px",
      fontFamily: "var(--font-sans)", fontSize: "10px", fontWeight: 700,
      color: color === "dim" ? "var(--text-3)" : c.base,
      textTransform: "uppercase", letterSpacing: "0.1em" }}>
      <span style={{
        width: `${size}px`, height: `${size}px`, borderRadius: "50%",
        background: c.base,
        boxShadow: color === "dim" ? "none" : `0 0 ${size}px ${c.glow}, 0 0 ${size * 2}px ${c.glow}`,
        animation: blinking && color !== "dim" ? "led-pulse 1.8s ease-in-out infinite" : "none",
      }} />
      {label}
      <style>{`
        @keyframes led-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.92); }
        }
      `}</style>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────
// VU Meter — barra segmentada horizontal estilo consola de mezcla
// value: 0-100
// ─────────────────────────────────────────────────────────────────
export function VUMeter({ value = 0, segments = 16, showLabel = false, label }) {
  const filled = Math.round((value / 100) * segments)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {showLabel && label && (
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "9px",
          color: "var(--text-3)", textTransform: "uppercase",
          letterSpacing: "0.1em", fontWeight: 700 }}>
          {label}
        </p>
      )}
      <div style={{ display: "flex", gap: "2px", height: "8px" }}>
        {[...Array(segments)].map((_, i) => {
          const isFilled = i < filled
          // green → amber → red gradient across meter
          let color
          if (i < segments * 0.7)      color = "var(--accent)"
          else if (i < segments * 0.9) color = "#ffb340"
          else                          color = "#ff4d4d"
          return (
            <div key={i} style={{
              flex: 1,
              background: isFilled ? color : "rgba(255,255,255,0.08)",
              borderRadius: "1px",
              boxShadow: isFilled ? `0 0 4px ${color}` : "none",
              transition: `background 200ms var(--ease) ${i * 20}ms`,
            }} />
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Digital Readout — número estilo pantalla 7-segmentos de rack
// ─────────────────────────────────────────────────────────────────
export function DigitalReadout({ value, unit = "", size = "md", tone = "green" }) {
  const sizes = {
    sm: { font: "14px", pad: "6px 10px" },
    md: { font: "18px", pad: "8px 14px" },
    lg: { font: "26px", pad: "12px 18px" },
  }
  const tones = {
    green: { color: "var(--accent)", glow: "rgba(26,255,110,0.35)" },
    white: { color: "var(--text)",   glow: "rgba(255,255,255,0.15)" },
    amber: { color: "#ffb340",       glow: "rgba(255,179,64,0.3)" },
  }
  const s = sizes[size]
  const t = tones[tone]
  return (
    <span style={{
      display: "inline-flex", alignItems: "baseline", gap: "6px",
      padding: s.pad,
      background: "linear-gradient(180deg, #050505 0%, #0a0a0a 100%)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "var(--r-sm)",
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      fontWeight: 700,
      fontSize: s.font,
      color: t.color,
      textShadow: `0 0 8px ${t.glow}, 0 0 16px ${t.glow}`,
      letterSpacing: "0.03em",
      lineHeight: 1,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5)",
    }}>
      {value}
      {unit && (
        <span style={{ fontSize: "0.55em", opacity: 0.6, fontWeight: 500 }}>
          {unit}
        </span>
      )}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────
// Knob decorativo — perilla giratoria con línea indicadora
// value: 0-100
// ─────────────────────────────────────────────────────────────────
export function Knob({ value = 50, label, size = 64 }) {
  // Mapear 0-100 → -135° a +135° (rango típico de una perilla)
  const angle = -135 + (value / 100) * 270
  return (
    <div style={{ display: "flex", flexDirection: "column",
      alignItems: "center", gap: "8px" }}>
      <div style={{
        width: `${size}px`, height: `${size}px`,
        borderRadius: "50%",
        background: "radial-gradient(circle at 30% 30%, #2a2a2a 0%, #0f0f0f 70%, #050505 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: `
          inset 0 2px 4px rgba(255,255,255,0.08),
          inset 0 -2px 4px rgba(0,0,0,0.7),
          0 4px 12px rgba(0,0,0,0.5)
        `,
        position: "relative",
        transition: "transform 400ms var(--ease)",
      }}>
        {/* Marca indicadora */}
        <div style={{
          position: "absolute", top: "6px", left: "50%",
          transform: `translateX(-50%) rotate(${angle}deg)`,
          transformOrigin: `50% ${size / 2 - 6}px`,
          width: "2px", height: "12px",
          background: "var(--accent)",
          borderRadius: "1px",
          boxShadow: "0 0 6px rgba(26,255,110,0.7)",
          transition: "transform 400ms var(--ease)",
        }} />
        {/* Dots de referencia (min y max) */}
        {[-135, 135].map((a, i) => (
          <div key={i} style={{
            position: "absolute", top: "50%", left: "50%",
            width: "2px", height: "2px",
            background: "rgba(255,255,255,0.2)",
            borderRadius: "50%",
            transform: `translate(-50%,-50%) rotate(${a}deg) translateY(${-size/2 + 4}px)`,
          }} />
        ))}
      </div>
      {label && (
        <p style={{
          fontFamily: "var(--font-sans)", fontSize: "9px",
          color: "var(--text-3)", textTransform: "uppercase",
          letterSpacing: "0.15em", fontWeight: 700,
        }}>{label}</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Fader decorativo — slider vertical con marca central
// value: 0-100
// ─────────────────────────────────────────────────────────────────
export function Fader({ value = 60, label, height = 100 }) {
  const posY = height - (value / 100) * height // 0 = bottom, 100 = top
  return (
    <div style={{ display: "flex", flexDirection: "column",
      alignItems: "center", gap: "8px" }}>
      <div style={{
        position: "relative", width: "28px", height: `${height}px`,
        background: "linear-gradient(180deg, #050505 0%, #0f0f0f 50%, #050505 100%)",
        borderRadius: "3px",
        border: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.6)",
      }}>
        {/* Track dbs (marcas horizontales) */}
        {[0, 25, 50, 75, 100].map((t, i) => (
          <div key={i} style={{
            position: "absolute", left: "-4px", right: "-4px",
            top: `${t}%`, height: "1px",
            background: "rgba(255,255,255,0.06)",
          }} />
        ))}
        {/* Track center */}
        <div style={{
          position: "absolute", left: "50%", top: 0, bottom: 0,
          width: "2px", transform: "translateX(-50%)",
          background: "rgba(255,255,255,0.08)",
        }} />
        {/* Thumb (perilla del fader) */}
        <div style={{
          position: "absolute", left: "50%", top: `${posY}px`,
          transform: "translate(-50%, -50%)",
          width: "40px", height: "18px",
          background: "linear-gradient(180deg, #3a3a3a 0%, #1a1a1a 60%, #0a0a0a 100%)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "3px",
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,0.15),
            0 3px 8px rgba(0,0,0,0.6),
            0 0 16px rgba(26,255,110,0.15)
          `,
          transition: "top 400ms var(--ease)",
        }}>
          {/* Línea del thumb */}
          <div style={{
            position: "absolute", left: "50%", top: "50%",
            transform: "translate(-50%,-50%)",
            width: "60%", height: "2px",
            background: "var(--accent)",
            borderRadius: "1px",
            boxShadow: "0 0 4px rgba(26,255,110,0.6)",
          }} />
        </div>
      </div>
      {label && (
        <p style={{
          fontFamily: "var(--font-sans)", fontSize: "9px",
          color: "var(--text-3)", textTransform: "uppercase",
          letterSpacing: "0.15em", fontWeight: 700,
        }}>{label}</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Waveform animado (para el hero y como decoración)
// bars: cantidad de barras — se anima loop
// ─────────────────────────────────────────────────────────────────
export function AnimatedWaveform({ bars = 24, color = "var(--accent)", playing = true }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setTick(t => t + 1), 100)
    return () => clearInterval(id)
  }, [playing])

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2px",
      height: "40px", width: "100%" }}>
      {[...Array(bars)].map((_, i) => {
        // Pseudo-random pero determinístico según tick y índice
        const seed = Math.sin(tick * 0.5 + i * 0.6) * 0.5 + 0.5
        const seed2 = Math.sin(tick * 0.3 + i * 1.1) * 0.5 + 0.5
        const h = 15 + seed * seed2 * 85
        return (
          <div key={i} style={{
            flex: 1, height: `${h}%`,
            background: color,
            borderRadius: "1px",
            transition: "height 100ms linear",
            opacity: 0.6 + seed * 0.4,
          }} />
        )
      })}
    </div>
  )
}
