import React from "react";

export default function ProgressBar({ value = 0 }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full h-2 rounded-full bg-[#2a2a2a] overflow-hidden">
      <div
        className="h-full bg-sentraYellow rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
