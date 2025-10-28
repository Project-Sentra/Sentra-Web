import React from "react";

function Slot({ busy = false }) {
  return (
    <div
      className={
        "h-8 rounded-md " + (busy ? "bg-[#1b1b1b]" : "bg-[#2a2a2a]")
      }
    />
  );
}

export default function ParkingMap({ rows = 8, cols = 4, busyIndices = [] }) {
  const total = rows * cols;
  const set = new Set(busyIndices);
  const items = Array.from({ length: total }).map((_, i) => set.has(i));

  return (
    <aside className="bg-[#151515] border border-[#232323] rounded-2xl p-6 w-full">
      <div className="text-gray-400 text-lg font-medium mb-6">Parking Map</div>
      <div className="grid grid-cols-4 gap-3">
        {items.map((busy, i) => (
          <Slot key={i} busy={busy} />
        ))}
      </div>
    </aside>
  );
}
