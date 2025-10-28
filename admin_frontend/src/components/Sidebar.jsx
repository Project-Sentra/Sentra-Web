import React from "react";
import { Link, NavLink, useParams } from "react-router-dom";

export default function Sidebar({ facilityName = "Downtown Parking" }) {
  const { facilityId } = useParams();
  const linkBase = `/admin/${facilityId ?? 1}`;
  const linkClass = ({ isActive }) =>
    "block px-4 py-2 rounded-md mt-3 " +
    (isActive
      ? "bg-sentraYellow text-black font-semibold"
      : "text-gray-200 hover:text-white");

  return (
    <aside className="w-72 shrink-0 p-6 bg-[#121212] border-r border-[#232323] flex flex-col">
      <Link to="/admin" className="w-9 h-9 rounded-md bg-[#1e1e1e] grid place-items-center text-gray-300 mb-6">
        ←
      </Link>
      <div className="text-sentraYellow flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-[#1f1f1f] grid place-items-center">⦿</div>
        <div className="text-gray-300">Admin One</div>
      </div>
      <h2 className="text-white text-3xl leading-8 font-bold">{facilityName.split(" ").slice(0, -1).join(" ")}</h2>
      <h2 className="text-white text-3xl leading-8 font-bold">{facilityName.split(" ").slice(-1)}</h2>

      <nav className="mt-8">
        <NavLink to={linkBase} end className={linkClass}>
          Dashboard
        </NavLink>
        <NavLink to={`${linkBase}/inout`} className={linkClass}>
          In & Out
        </NavLink>
        <NavLink to={`${linkBase}/live`} className={linkClass}>
          Live feed
        </NavLink>
      </nav>

      <div className="mt-auto text-gray-500 text-sm flex items-center gap-2">
        <span>⚙️</span> Settings
      </div>
    </aside>
  );
}
