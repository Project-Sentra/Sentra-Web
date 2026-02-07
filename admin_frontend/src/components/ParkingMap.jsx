/**
 * ParkingMap.jsx - Visual Parking Floor Plan
 * ============================================
 * Renders a grid of parking slots showing which spots are free (green)
 * and which are occupied (red). Used on the Dashboard and InOut pages.
 *
 * Props:
 *   @param {number} rows - Grid rows (default 8).
 *   @param {number} cols - Grid columns (default 4). CSS grid uses cols.
 *   @param {number[]} busyIndices - Array of 0-based indices for occupied spots.
 *
 * The grid always renders rows * cols = total slots, labeled A-01, A-02, etc.
 * The busyIndices come from the backend spot IDs (adjusted to 0-based).
 */

import React from "react";

/** Individual parking slot cell. Green = free, Red = occupied. */
function Slot({ busy = false, label }) {
  return (
    <div
      className={`h-12 rounded-md flex items-center justify-center text-xs font-medium border transition-colors ${
        busy 
          ? "bg-red-900/20 border-red-900/50 text-red-500" 
          : "bg-green-900/20 border-green-900/50 text-green-500"
      }`}
    >
      {label}
    </div>
  );
}

export default function ParkingMap({ rows = 8, cols = 4, busyIndices = [] }) {
  const total = rows * cols;
  const busySet = new Set(busyIndices);
  
  return (
    <div className="bg-[#151515] border border-[#232323] rounded-2xl p-6 w-full h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-gray-300 font-medium">Live Floor Plan</h3>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> Free</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> Occupied</div>
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: total }).map((_, i) => (
          <Slot 
            key={i} 
            busy={busySet.has(i)} 
            label={`A-${String(i+1).padStart(2,'0')}`} 
          />
        ))}
      </div>
    </div>
  );
}