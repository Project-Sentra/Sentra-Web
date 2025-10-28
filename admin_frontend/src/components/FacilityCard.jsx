import React from "react";
import { Link } from "react-router-dom";
import ProgressBar from "./ProgressBar";

export default function FacilityCard({ facility }) {
  const { id, name, revenueLKR, capacityPct = 0, status = "Active" } = facility;
  return (
    <Link
      to={`/admin/${id}`}
      className="group block bg-[#171717] rounded-2xl p-5 border border-[#232323] hover:border-sentraYellow/60 transition"
    >
      <div className="text-white text-3xl leading-9 font-semibold">
        {name.split(" ").slice(0, -1).join(" ")}
        <br />
        {name.split(" ").slice(-1)}
      </div>
      <div className="text-sm text-gray-400 mt-2">Parking ID #{String(id).padStart(3, "0")}</div>

      <div className="mt-4 text-xs text-gray-400">Capacity meter</div>
      <div className="mt-2 flex items-center gap-3">
        <div className="w-24">
          <ProgressBar value={capacityPct} />
        </div>
        <div className="text-gray-500 text-xs">{capacityPct}%</div>
      </div>

      <div className="mt-4 text-gray-300">
        <div className="text-sm">Day’s revenue</div>
        <span className="inline-block mt-2 text-xs bg-[#232323] rounded-full px-3 py-1 text-sentraYellow">
          LKR {revenueLKR?.toLocaleString?.("en-LK") ?? revenueLKR}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sentraYellow inline-block" /> {status}
        </div>
        <span className="opacity-50 group-hover:opacity-100">›</span>
      </div>
    </Link>
  );
}
