/**
 * GateBarrier.jsx - Animated boom barrier
 * ========================================
 * Draws a parking barrier whose arm swings up when `open` is true.
 * `highlight` adds a glow, used when the AI has just opened the gate.
 */

import React from "react";

export default function GateBarrier({ open, highlight = false }) {
  return (
    <svg
      viewBox="0 0 220 120"
      className="w-full h-28"
      role="img"
      aria-label={open ? "Barrier open" : "Barrier closed"}
    >
      {/* road */}
      <rect x="0" y="104" width="220" height="16" fill="#1c1c1c" />
      <line x1="0" y1="112" x2="220" y2="112" stroke="#333" strokeDasharray="10 8" strokeWidth="2" />

      {/* post */}
      <rect x="18" y="58" width="22" height="46" rx="3" fill="#2a2a2a" stroke="#3a3a3a" />
      <circle
        cx="29"
        cy="70"
        r="5"
        fill={open ? "#22c55e" : "#ef4444"}
        className="transition-colors duration-500"
      >
        {highlight && (
          <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />
        )}
      </circle>

      {/* arm: pivots at the top of the post */}
      <g
        style={{
          transformOrigin: "34px 62px",
          transform: open ? "rotate(-78deg)" : "rotate(0deg)",
          transition: "transform 700ms cubic-bezier(.34,1.56,.64,1)",
          filter: highlight ? "drop-shadow(0 0 6px #e2e600)" : "none",
        }}
      >
        <rect x="34" y="58" width="176" height="9" rx="4.5" fill="#f5f5f5" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={50 + i * 27} y="58" width="13" height="9" fill="#ef4444" />
        ))}
      </g>
    </svg>
  );
}
