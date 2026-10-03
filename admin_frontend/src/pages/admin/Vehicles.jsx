/**
 * Vehicles.jsx - Vehicle Management Page (Admin)
 * =================================================
 * Displays all registered vehicles across all users (= the entry whitelist:
 * only active vehicles here are let in by the LPR gate).
 * Admin can register a vehicle for a user, deactivate and reactivate vehicles.
 * Admin-registered vehicles show up in the owner's mobile app.
 *
 * Data Source: GET /api/vehicles?all=true, POST /api/vehicles { user_id, ... }
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import lprService from "../../services/lprService";

const EMPTY_FORM = { user_id: "", plate_number: "", make: "", model: "", color: "", year: "", vehicle_type: "car" };
const inputClass = "bg-[#222] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:ring-1 focus:ring-sentraYellow";

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
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
    lprService.getUsers().then(setUsers).catch((err) => console.error("Failed to fetch users:", err));
  }, []);

  async function handleDeactivate(vehicleId) {
    if (!window.confirm("Deactivate this vehicle? It will no longer be let in.")) return;
    try {
      await lprService.deactivateVehicle(vehicleId);
      setVehicles(vehicles.map(v => v.id === vehicleId ? { ...v, is_active: false } : v));
    } catch (err) {
      alert("Failed: " + (err.response?.data?.message || err.message));
    }
  }

  async function handleReactivate(vehicleId) {
    try {
      await lprService.updateVehicle(vehicleId, { is_active: true });
      setVehicles(vehicles.map(v => v.id === vehicleId ? { ...v, is_active: true } : v));
    } catch (err) {
      alert("Failed: " + (err.response?.data?.message || err.message));
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const { vehicle } = await lprService.registerVehicle({
        ...form,
        user_id: Number(form.user_id),
        year: form.year ? Number(form.year) : null,
      });
      const owner = users.find(u => u.id === vehicle.user_id);
      setVehicles([{ ...vehicle, users: owner && { email: owner.email, full_name: owner.full_name } }, ...vehicles]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setFormError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }

  const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });

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
          <div className="flex gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plate, owner, make..."
              className="bg-[#222] rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:ring-1 focus:ring-sentraYellow w-72"
            />
            <button
              onClick={() => { setShowForm(!showForm); setFormError(""); }}
              className="bg-sentraYellow text-black font-medium text-sm px-4 py-2 rounded-lg hover:opacity-90"
            >
              {showForm ? "Cancel" : "+ Register Vehicle"}
            </button>
          </div>
        </header>

        {showForm && (
          <form
            onSubmit={handleRegister}
            className="bg-[#171717] rounded-2xl border border-[#232323] p-6 mb-8"
          >
            <h2 className="text-lg font-semibold mb-1">Register Vehicle</h2>
            <p className="text-gray-500 text-xs mb-4">
              Adds the plate to the entry whitelist. It also appears in the owner's Sentra app.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select required value={form.user_id} onChange={setField("user_id")} aria-label="Owner" className={inputClass}>
                <option value="">Owner *</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || "—"} ({u.email})
                  </option>
                ))}
              </select>
              <input required maxLength={20} value={form.plate_number} onChange={setField("plate_number")} placeholder="Plate * e.g. CAG 5124" aria-label="Plate number" className={inputClass} />
              <input value={form.make} onChange={setField("make")} placeholder="Make" aria-label="Make" className={inputClass} />
              <input value={form.model} onChange={setField("model")} placeholder="Model" aria-label="Model" className={inputClass} />
              <input value={form.color} onChange={setField("color")} placeholder="Color" aria-label="Color" className={inputClass} />
              <input type="number" min="1950" max="2100" value={form.year} onChange={setField("year")} placeholder="Year" aria-label="Year" className={inputClass} />
              <select value={form.vehicle_type} onChange={setField("vehicle_type")} aria-label="Vehicle type" className={inputClass}>
                <option value="car">Car</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="truck">Truck</option>
                <option value="van">Van</option>
              </select>
              <button
                type="submit"
                disabled={saving}
                className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg px-4 py-2"
              >
                {saving ? "Saving..." : "Register"}
              </button>
            </div>
            {formError && <p className="text-red-400 text-sm mt-3">{formError}</p>}
          </form>
        )}

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
                      {v.is_active ? (
                        <button
                          onClick={() => handleDeactivate(v.id)}
                          className="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(v.id)}
                          className="text-xs text-green-400 hover:bg-green-500/10 px-2 py-1 rounded"
                        >
                          Reactivate
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
