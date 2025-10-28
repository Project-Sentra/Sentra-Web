import React, { useMemo, useState, useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";

function MenuButton() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-9 h-9 grid place-items-center bg-sentraGray rounded-md text-sentraYellow"
        aria-label="Open navigation"
      >
        ≡
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-56 bg-[#121212] border border-[#232323] rounded-md p-2 z-50">
          <NavLink to="/admin/dashboard" className={({ isActive }) => (isActive ? "text-sentraYellow block px-3 py-2 rounded" : "text-gray-300 block px-3 py-2 rounded hover:text-white")} onClick={() => setOpen(false)}>
            Dashboard
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => (isActive ? "text-sentraYellow block px-3 py-2 rounded" : "text-gray-300 block px-3 py-2 rounded hover:text-white")} onClick={() => setOpen(false)}>
            Facilities
          </NavLink>
          <NavLink to="/admin/inout" className={({ isActive }) => (isActive ? "text-sentraYellow block px-3 py-2 rounded" : "text-gray-300 block px-3 py-2 rounded hover:text-white")} onClick={() => setOpen(false)}>
            In / Out
          </NavLink>
          <NavLink to="/admin/live" className={({ isActive }) => (isActive ? "text-sentraYellow block px-3 py-2 rounded" : "text-gray-300 block px-3 py-2 rounded hover:text-white")} onClick={() => setOpen(false)}>
            Live feed
          </NavLink>
        </div>
      )}
    </div>
  );
}
import FacilityCard from "../../components/FacilityCard";

export default function Facilities() {
  const facilities = useMemo(
    () => [
      { id: 1, name: "Monte Carlo", capacityPct: 42, revenueLKR: 53000, status: "Active" },
      { id: 2, name: "Downtown parking", capacityPct: 65, revenueLKR: 53000, status: "Active" },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-sentraBlack text-white">
      <header className="max-w-6xl mx-auto pt-8 px-6">
        <div className="relative inline-block">
          <MenuButton />
        </div>
        <h1 className="mt-8 text-6xl font-bold text-sentraYellow">Parking Facilities</h1>
        <div className="h-px bg-sentraYellow mt-6" />
        <div className="mt-6">
          <input
            placeholder="search for a parking facility"
            className="w-full rounded-full bg-[#1a1a1a] px-6 py-4 text-gray-300 placeholder-gray-500 outline-none focus:ring-2 focus:ring-sentraYellow"
          />
        </div>
        <div className="mt-6 text-gray-400">Recent</div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6 pb-16">
        {facilities.map((f) => (
          <FacilityCard key={f.id} facility={f} />
        ))}
      </main>
    </div>   
  );
}
