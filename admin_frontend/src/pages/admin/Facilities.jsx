/**
 * Facilities.jsx - Facility Selection Page (Admin Entry Point)
 * ==============================================================
 * Lists all parking facilities as clickable cards. This is the admin
 * landing page after /admin. Users click a facility to open its Dashboard.
 *
 * Fetches real facility data from GET /api/facilities which includes
 * live occupancy counts (total, occupied, reserved, available).
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
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
  const createDefaultForm = () => ({
    name: "",
    address: "",
    city: "",
    hourly_rate: "150",
    operating_hours_start: "06:00",
    operating_hours_end: "22:00",
  });

  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState(null);
  const [formValues, setFormValues] = useState(createDefaultForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  // Check auth
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) navigate("/signin");
  }, [navigate]);

  const fetchFacilities = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await lprService.getFacilities();
      setFacilities(data);
    } catch (err) {
      console.error("Failed to fetch facilities:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // Fetch facilities from API
  useEffect(() => {
    fetchFacilities(true);
    const interval = setInterval(fetchFacilities, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchFacilities]);

  function openCreate() {
    setEditingFacility(null);
    setFormValues(createDefaultForm());
    setFormError("");
    setIsModalOpen(true);
  }

  function openEdit(facility) {
    setEditingFacility(facility);
    setFormValues({
      name: facility.name || "",
      address: facility.address || "",
      city: facility.city || "",
      hourly_rate: facility.hourly_rate !== undefined && facility.hourly_rate !== null ? String(facility.hourly_rate) : "150",
      operating_hours_start: facility.operating_hours_start || "06:00",
      operating_hours_end: facility.operating_hours_end || "22:00",
    });
    setFormError("");
    setIsModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setIsModalOpen(false);
  }

  async function handleSave(event) {
    event.preventDefault();
    if (saving) return;
    setFormError("");

    const name = formValues.name.trim();
    if (!name) {
      setFormError("Facility name is required.");
      return;
    }

    const rateValue = formValues.hourly_rate === "" ? undefined : Number(formValues.hourly_rate);
    if (formValues.hourly_rate !== "" && Number.isNaN(rateValue)) {
      setFormError("Hourly rate must be a number.");
      return;
    }

    const payload = {
      name,
      address: formValues.address.trim(),
      city: formValues.city.trim(),
      operating_hours_start: formValues.operating_hours_start || "06:00",
      operating_hours_end: formValues.operating_hours_end || "22:00",
    };
    if (rateValue !== undefined) payload.hourly_rate = rateValue;

    try {
      setSaving(true);
      if (editingFacility) {
        await lprService.updateFacility(editingFacility.id, payload);
      } else {
        await lprService.createFacility(payload);
      }
      setIsModalOpen(false);
      setEditingFacility(null);
      await fetchFacilities();
    } catch (err) {
      const message = err?.response?.data?.message || err.message || "Failed to save facility.";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(facility) {
    if (!window.confirm(`Delete ${facility.name}? This will permanently remove the facility and related data.`)) return;
    try {
      await lprService.deleteFacility(facility.id);
      setFacilities((prev) => prev.filter((item) => item.id !== facility.id));
    } catch (err) {
      const message = err?.response?.data?.message || err.message || "Failed to delete facility.";
      alert(message);
    }
  }

  // Filter facilities by search
  const filtered = facilities.filter(f =>
    (f.name || "").toLowerCase().includes(search.toLowerCase()) ||
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
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search for a parking facility"
            className="w-full rounded-full bg-[#1a1a1a] px-6 py-4 text-gray-300 placeholder-gray-500 outline-none focus:ring-2 focus:ring-sentraYellow"
          />
          <button
            type="button"
            onClick={openCreate}
            className="shrink-0 rounded-full bg-sentraYellow text-black px-6 py-4 font-semibold hover:brightness-95 transition"
          >
            Add Facility
          </button>
        </div>
        <div className="mt-6 text-gray-400">
          {loading ? "Loading..." : `${filtered.length} facilities`}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6 pb-16">
        {filtered.map((f) => (
          <FacilityCard key={f.id} facility={f} onEdit={openEdit} onDelete={handleDelete} />
        ))}
        {!loading && filtered.length === 0 && (
          <p className="text-gray-500 col-span-2 text-center py-12">
            No facilities found. Add one to get started.
          </p>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {editingFacility ? "Edit Facility" : "Add Facility"}
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {editingFacility ? "Update facility details and operating hours." : "Create a new parking facility."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-500 hover:text-white transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 bg-red-500/10 border border-red-500 text-red-400 text-sm p-3 rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-400">Facility Name</label>
                  <input
                    value={formValues.name}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, name: e.target.value }))}
                    className="mt-2 w-full bg-[#222] rounded-lg px-4 py-3 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-sentraYellow"
                    placeholder="Facility name"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400">Address</label>
                  <input
                    value={formValues.address}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, address: e.target.value }))}
                    className="mt-2 w-full bg-[#222] rounded-lg px-4 py-3 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-sentraYellow"
                    placeholder="Street address"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400">City</label>
                  <input
                    value={formValues.city}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, city: e.target.value }))}
                    className="mt-2 w-full bg-[#222] rounded-lg px-4 py-3 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-sentraYellow"
                    placeholder="City"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400">Hourly Rate (LKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={formValues.hourly_rate}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, hourly_rate: e.target.value }))}
                    className="mt-2 w-full bg-[#222] rounded-lg px-4 py-3 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-sentraYellow"
                    placeholder="150"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400">Open</label>
                    <input
                      type="time"
                      value={formValues.operating_hours_start}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, operating_hours_start: e.target.value }))}
                      className="mt-2 w-full bg-[#222] rounded-lg px-3 py-3 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-sentraYellow"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Close</label>
                    <input
                      type="time"
                      value={formValues.operating_hours_end}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, operating_hours_end: e.target.value }))}
                      className="mt-2 w-full bg-[#222] rounded-lg px-3 py-3 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-sentraYellow"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-white/10 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold bg-sentraYellow text-black rounded-lg hover:brightness-95 transition disabled:opacity-70"
                >
                  {saving ? "Saving..." : editingFacility ? "Save Changes" : "Create Facility"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>   
  );
}
