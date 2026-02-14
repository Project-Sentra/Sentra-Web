/**
 * Facilities.jsx - Facility Selection Page (Admin Entry Point)
 * ==============================================================
 * Lists all parking facilities as clickable cards. This is the admin
 * landing page after /admin. Users click a facility to open its Dashboard.
 *
 * Fetches real facility data from GET /api/facilities which includes
 * live occupancy counts (total, occupied, reserved, available).
 */

import React, { useState, useEffect, useRef } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import lprService from "../../services/lprService";

function MenuButton() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
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
          <NavLink to="/admin" end className={({ isActive }) => (isActive ? "text-sentraYellow block px-3 py-2 rounded" : "text-gray-300 block px-3 py-2 rounded hover:text-white")} onClick={() => setOpen(false)}>
            Facilities
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => (isActive ? "text-sentraYellow block px-3 py-2 rounded" : "text-gray-300 block px-3 py-2 rounded hover:text-white")} onClick={() => setOpen(false)}>
            Users
          </NavLink>
          <NavLink to="/admin/vehicles" className={({ isActive }) => (isActive ? "text-sentraYellow block px-3 py-2 rounded" : "text-gray-300 block px-3 py-2 rounded hover:text-white")} onClick={() => setOpen(false)}>
            Vehicles
          </NavLink>
          <NavLink to="/admin/reservations" className={({ isActive }) => (isActive ? "text-sentraYellow block px-3 py-2 rounded" : "text-gray-300 block px-3 py-2 rounded hover:text-white")} onClick={() => setOpen(false)}>
            Reservations
          </NavLink>
        </div>
      )}
    </div>
  );
}
import FacilityCard from "../../components/FacilityCard";

export default function Facilities() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  // Check auth
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) navigate("/signin");
  }, [navigate]);

  // Fetch facilities from API
  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const data = await lprService.getFacilities();
        setFacilities(data);
      } catch (err) {
        console.error("Failed to fetch facilities:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFacilities();
    const interval = setInterval(fetchFacilities, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  // Filter facilities by search
  const filtered = facilities.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.city || "").toLowerCase().includes(search.toLowerCase())
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search for a parking facility"
            className="w-full rounded-full bg-[#1a1a1a] px-6 py-4 text-gray-300 placeholder-gray-500 outline-none focus:ring-2 focus:ring-sentraYellow"
          />
        </div>
        <div className="mt-6 text-gray-400">
          {loading ? "Loading..." : `${filtered.length} facilities`}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6 pb-16">
        {filtered.map((f) => (
          <FacilityCard key={f.id} facility={f} />
        ))}
        {!loading && filtered.length === 0 && (
          <p className="text-gray-500 col-span-2 text-center py-12">
            No facilities found. Create one from the backend.
          </p>
        )}
      </main>
    </div>   
  );
}
