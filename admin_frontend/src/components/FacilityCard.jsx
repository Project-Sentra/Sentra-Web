/**
 * FacilityCard.jsx - Facility Summary Card (v2.0)
 * ================================================
 * Clickable card that shows a parking facility's live metrics.
 * Displayed on the Facilities page in a grid layout.
 *
 * Shows:
 *   - Facility name, city, and ID
 *   - Active/Inactive status badge
 *   - Live occupancy percentage with progress bar
 *   - Available / Total spots count
 *   - Hourly rate
 *
 * Clicking navigates to /admin/:facilityId (the Dashboard for that facility).
 *
 * Props:
 *   @param {Object} facility - From GET /api/facilities response:
 *     { id, name, city, total_spots, occupied_spots, available_spots,
 *       reserved_spots, hourly_rate, is_active }
 */

import React from "react";
import { Link } from "react-router-dom";
import ProgressBar from "./ProgressBar";

export default function FacilityCard({ facility }) {
  const {
    id,
    name,
    city,
    total_spots = 0,
    occupied_spots = 0,
    available_spots = 0,
    reserved_spots = 0,
    hourly_rate = 150,
    is_active = true,
  } = facility;

  const capacityPct = total_spots > 0 ? Math.round((occupied_spots / total_spots) * 100) : 0;
  const status = is_active ? "Active" : "Inactive";

  return (
    <Link
      to={`/admin/${id}`}
      className="group block bg-[#171717] rounded-2xl p-6 border border-[#232323] hover:border-sentraYellow/50 transition"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl text-white font-semibold">{name}</h3>
          <p className="text-xs text-gray-500 mt-1">
            {city || `ID #${String(id).padStart(3, "0")}`}
          </p>
        </div>
        <span className={`px-2 py-1 rounded text-xs ${status==='Active' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
          {status}
        </span>
      </div>

      <div className="mt-6">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>Occupancy</span>
          <span>{capacityPct}%</span>
        </div>
        <ProgressBar value={capacityPct} />
      </div>

      <div className="mt-6 pt-4 border-t border-[#232323] flex justify-between items-end">
        <div>
          <p className="text-xs text-gray-500">Available / Total</p>
          <p className="text-sentraYellow font-medium mt-1">
            {available_spots} / {total_spots}
            {reserved_spots > 0 && <span className="text-gray-500 text-xs ml-1">({reserved_spots} reserved)</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Rate</p>
          <p className="text-gray-300 text-sm">LKR {hourly_rate}/hr</p>
        </div>
      </div>
    </Link>
  );
}