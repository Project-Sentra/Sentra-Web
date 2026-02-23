/**
 * ParkingMap.jsx - Visual Parking Floor Plan
 * ============================================
 * Renders a grid of real parking slots from the database, showing which
 * spots are free (green), occupied (red), or reserved (orange).
 *
 * Props:
 *   @param {Array} spots - Array of spot objects from the API, each with
 *     { id, spot_name, is_occupied, is_reserved, spot_type, is_active }.
 *   @param {number} cols - Grid columns (default 4).
 */

import React from "react";

/** Individual parking slot cell. */
function Slot({ label, status }) {
  const styles = {
    occupied:  "bg-red-900/20 border-red-900/50 text-red-500",
    reserved:  "bg-orange-900/20 border-orange-900/50 text-orange-400",
    available: "bg-green-900/20 border-green-900/50 text-green-500",
  };

  return (
    <div
      className={`h-12 rounded-md flex items-center justify-center text-xs font-medium border transition-colors ${
        styles[status] || styles.available
      }`}
    >
      {label}
    </div>
  );
}

export default function ParkingMap({ spots = [], cols = 4 }) {
  return (
    <div className="bg-[#151515] border border-[#232323] rounded-2xl p-6 w-full h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-gray-300 font-medium">Live Floor Plan</h3>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> Free</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> Occupied</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-400"></span> Reserved</div>
        </div>
      </div>

      {spots.length === 0 ? (
        <p className="text-gray-500 text-center py-8 text-sm">No spots configured yet.</p>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {spots.map((spot) => {
            const status = spot.is_occupied
              ? "occupied"
              : spot.is_reserved
              ? "reserved"
              : "available";
            return (
              <Slot
                key={spot.id}
                label={spot.spot_name}
                status={status}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}