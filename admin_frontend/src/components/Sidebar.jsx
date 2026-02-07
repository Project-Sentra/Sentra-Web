/**
 * Sidebar.jsx - Admin Navigation Sidebar (v2.0)
 * ================================================
 * Vertical sidebar shown on all admin pages.
 * Contains:
 *   - Back arrow to return to facility list
 *   - Current admin user name (from localStorage)
 *   - Facility name (passed via prop)
 *   - Navigation links: Dashboard, In & Out, Live feed, Users, Vehicles, Reservations
 *   - Logout button at the bottom
 *
 * The sidebar builds link paths using the :facilityId route param.
 */

import React from "react";
import { Link, NavLink, useParams, useNavigate } from "react-router-dom";

export default function Sidebar({ facilityName = "Parking Facility" }) {
  const { facilityId } = useParams();
  const navigate = useNavigate();
  const fId = facilityId || 1;
  const linkBase = `/admin/${fId}`;

  const adminName = localStorage.getItem("userFullName") || localStorage.getItem("userEmail") || "Admin";
  const adminInitial = adminName.charAt(0).toUpperCase();

  const linkClass = ({ isActive }) =>
    "block px-4 py-2 rounded-md mt-2 transition " +
    (isActive
      ? "bg-sentraYellow text-black font-semibold"
      : "text-gray-400 hover:text-white hover:bg-[#1f1f1f]");

  function handleLogout() {
    localStorage.clear();
    navigate("/signin");
  }

  return (
    <aside className="w-64 shrink-0 bg-[#121212] border-r border-[#232323] flex flex-col h-screen sticky top-0 overflow-y-auto">
      <div className="p-6">
        <Link to="/admin" className="inline-flex items-center justify-center w-8 h-8 rounded bg-[#1e1e1e] text-gray-400 hover:text-white mb-6">
          ←
        </Link>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-[#1f1f1f] flex items-center justify-center text-sentraYellow font-bold">
            {adminInitial}
          </div>
          <div className="text-sm text-gray-300">{adminName}</div>
        </div>

        <h2 className="text-2xl font-bold text-white leading-tight">
          {facilityName}
        </h2>

        <nav className="mt-8 space-y-1">
          <NavLink to={linkBase} end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to={`${linkBase}/inout`} className={linkClass}>
            In & Out
          </NavLink>
          <NavLink to={`${linkBase}/live`} className={linkClass}>
            Live feed
          </NavLink>

          <div className="h-px bg-[#232323] my-4"></div>

          <NavLink to="/admin/users" className={linkClass}>
            Users
          </NavLink>
          <NavLink to="/admin/vehicles" className={linkClass}>
            Vehicles
          </NavLink>
          <NavLink to="/admin/reservations" className={linkClass}>
            Reservations
          </NavLink>
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-[#232323]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-400 transition"
        >
          <span>🚪</span> Logout
        </button>
      </div>
    </aside>
  );
}