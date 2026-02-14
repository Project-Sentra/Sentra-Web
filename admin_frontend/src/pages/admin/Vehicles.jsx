/**
 * Vehicles.jsx - Vehicle Management Page (Admin)
 * =================================================
 * Displays all registered vehicles across all users.
 * Admin can view vehicle details, owner info, and deactivate vehicles.
 *
 * Data Source: GET /api/vehicles?all=true
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import lprService from "../../services/lprService";

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) navigate("/signin");
  }, [navigate]);

  useEffect(() => {
    async function fetchVehicles() {
      try {
        const data = await lprService.getVehicles(true);
        setVehicles(data);
      } catch (err) {
        console.error("Failed to fetch vehicles:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchVehicles();
  }, []);

  async function handleDeactivate(vehicleId) {
    if (!window.confirm("Deactivate this vehicle?")) return;
    try {
      await lprService.deactivateVehicle(vehicleId);
      setVehicles(vehicles.map(v => v.id === vehicleId ? { ...v, is_active: false } : v));
    } catch (err) {
      alert("Failed: " + err.message);
    }
  }

  const filtered = vehicles.filter(v =>
    v.plate_number.toLowerCase().includes(search.toLowerCase()) ||
    (v.make || "").toLowerCase().includes(search.toLowerCase()) ||
    (v.model || "").toLowerCase().includes(search.toLowerCase()) ||
    (v.users?.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (v.users?.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const typeColors = {
    car: "bg-blue-500/20 text-blue-400",
    motorcycle: "bg-orange-500/20 text-orange-400",
    truck: "bg-red-500/20 text-red-400",
    van: "bg-purple-500/20 text-purple-400",
  };

  return (
    <div className="flex h-screen bg-sentraBlack text-white overflow-hidden">
      <Sidebar facilityName="Vehicle Registry" />

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold">Registered Vehicles</h1>
            <p className="text-gray-400 text-sm mt-1">
              {filtered.length} vehicles
            </p>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plate, owner, make..."
            className="bg-[#222] rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:ring-1 focus:ring-sentraYellow w-72"
          />
        </header>

        {loading ? (
          <p className="text-gray-500 animate-pulse">Loading vehicles...</p>
        ) : (
          <div className="bg-[#171717] rounded-2xl border border-[#232323] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#1a1a1a] text-gray-400 text-left">
                <tr>
                  <th className="px-6 py-4">Plate</th>
                  <th className="px-6 py-4">Owner</th>
                  <th className="px-6 py-4">Make / Model</th>
                  <th className="px-6 py-4">Color</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Registered</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className="border-t border-[#232323] hover:bg-[#1e1e1e]">
                    <td className="px-6 py-4">
                      <span className="bg-sentraYellow text-black font-bold px-2 py-1 rounded text-xs">
                        {v.plate_number}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{v.users?.full_name || "—"}</div>
                      <div className="text-gray-500 text-xs">{v.users?.email || "—"}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {v.make && v.model ? `${v.make} ${v.model}` : v.make || v.model || "—"}
                      {v.year && <span className="text-gray-500 text-xs ml-1">({v.year})</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-400">{v.color || "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${typeColors[v.vehicle_type] || "bg-gray-500/20 text-gray-400"}`}>
                        {v.vehicle_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${v.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {v.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {new Date(v.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {v.is_active && (
                        <button
                          onClick={() => handleDeactivate(v.id)}
                          className="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <p className="text-gray-500 text-center py-12">
                {search ? "No vehicles match your search." : "No vehicles registered yet."}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
