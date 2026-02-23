/**
 * SlotManagement.jsx - Full CRUD Slot Management Page
 * =====================================================
 * Provides admins with complete control over parking slots for a facility:
 *   - View all slots with real-time status (available / occupied / reserved)
 *   - Create individual spots
 *   - Bulk-initialise spots
 *   - Edit spot details (name, type, active status)
 *   - Delete individual spots (only unoccupied/unreserved)
 *   - Adjust total slot count (inventory control)
 *
 * Inherits facility context from the :facilityId route parameter.
 * Polls every 5 seconds so changes from LPR / mobile sync instantly.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import lprService from "../../services/lprService";

const SPOT_TYPES = ["regular", "handicapped", "ev", "vip"];

export default function SlotManagement() {
  const { facilityId } = useParams();
  const navigate = useNavigate();
  const fid = parseInt(facilityId) || 1;

  const [facilityName, setFacilityName] = useState("Parking Facility");
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showInit, setShowInit] = useState(false);
  const [showEdit, setShowEdit] = useState(null); // spot object or null
  const [showAdjust, setShowAdjust] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState({ spot_name: "", spot_type: "regular" });
  const [initForm, setInitForm] = useState({ count: 32, prefix: "A", spot_type: "regular" });
  const [editForm, setEditForm] = useState({});
  const [adjustForm, setAdjustForm] = useState({ total: 0, prefix: "A" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Filter / search
  const [filter, setFilter] = useState("all"); // all | available | occupied | reserved
  const [search, setSearch] = useState("");

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) navigate("/signin");
  }, [navigate]);

  // Fetch facility info
  useEffect(() => {
    (async () => {
      try {
        const data = await lprService.getFacility(fid);
        if (data.facility) setFacilityName(data.facility.name);
      } catch {}
    })();
  }, [fid]);

  // Fetch spots
  const fetchSpots = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const data = await lprService.getSpots(fid, true);
      setSpots(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch spots:", err);
      setError("Failed to load spots. Is the backend running?");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [fid]);

  useEffect(() => {
    fetchSpots(true);
    const id = setInterval(() => fetchSpots(false), 5000);
    return () => clearInterval(id);
  }, [fetchSpots]);

  // Derived stats
  const activeSpots = spots.filter(s => s.is_active !== false);
  const occupiedCount = activeSpots.filter(s => s.is_occupied).length;
  const reservedCount = activeSpots.filter(s => s.is_reserved && !s.is_occupied).length;
  const availableCount = activeSpots.length - occupiedCount - reservedCount;

  // Filtered list
  const displayed = spots.filter(s => {
    if (filter === "available") return !s.is_occupied && !s.is_reserved && s.is_active !== false;
    if (filter === "occupied") return s.is_occupied;
    if (filter === "reserved") return s.is_reserved && !s.is_occupied;
    return true;
  }).filter(s =>
    search ? (s.spot_name || "").toLowerCase().includes(search.toLowerCase()) : true
  );

  // Create single spot
  async function handleCreate(e) {
    e.preventDefault();
    if (!createForm.spot_name.trim()) { setFormError("Spot name is required"); return; }
    setSaving(true);
    setFormError("");
    try {
      await lprService.createSpot(fid, createForm);
      setShowCreate(false);
      setCreateForm({ spot_name: "", spot_type: "regular" });
      await fetchSpots();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Failed to create spot");
    } finally {
      setSaving(false);
    }
  }

  // Bulk init
  async function handleInit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await lprService.initSpots(fid, initForm.count, initForm.prefix, initForm.spot_type);
      setShowInit(false);
      await fetchSpots();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Failed to initialise spots");
    } finally {
      setSaving(false);
    }
  }

  // Edit
  function openEdit(spot) {
    setShowEdit(spot);
    setEditForm({
      spot_name: spot.spot_name,
      spot_type: spot.spot_type || "regular",
      is_active: spot.is_active !== false,
    });
    setFormError("");
  }
  async function handleEdit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await lprService.updateSpot(showEdit.id, editForm);
      setShowEdit(null);
      await fetchSpots();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Failed to update spot");
    } finally {
      setSaving(false);
    }
  }

  // Delete
  async function handleDelete(spot) {
    if (!window.confirm(`Delete spot ${spot.spot_name}? This action is permanent.`)) return;
    try {
      await lprService.deleteSpot(spot.id);
      await fetchSpots();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete spot");
    }
  }

  // Adjust count
  async function handleAdjust(e) {
    e.preventDefault();
    const total = parseInt(adjustForm.total);
    if (isNaN(total) || total < 0) { setFormError("Enter a valid number >= 0"); return; }
    setSaving(true);
    setFormError("");
    try {
      await lprService.adjustSpotCount(fid, total, adjustForm.prefix);
      setShowAdjust(false);
      await fetchSpots();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Failed to adjust count");
    } finally {
      setSaving(false);
    }
  }

  // Toggle active status quickly
  async function toggleActive(spot) {
    try {
      await lprService.updateSpot(spot.id, { is_active: spot.is_active === false });
      await fetchSpots();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to toggle spot status");
    }
  }

  return (
    <div className="flex h-screen bg-sentraBlack text-white overflow-hidden">
      <Sidebar facilityName={facilityName} />
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <header className="flex justify-between items-end mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Slot Management</h1>
            <p className="text-gray-400 text-sm mt-1">Full CRUD control over parking slots</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setShowCreate(true); setFormError(""); }} className="px-4 py-2 text-sm font-semibold bg-sentraYellow text-black rounded-lg hover:brightness-95 transition">
              + Add Spot
            </button>
            <button onClick={() => { setShowInit(true); setFormError(""); }} className="px-4 py-2 text-sm font-semibold bg-[#222] text-gray-300 rounded-lg border border-[#333] hover:bg-[#2a2a2a] transition">
              Bulk Init
            </button>
            <button onClick={() => { setShowAdjust(true); setAdjustForm({ total: activeSpots.length, prefix: "A" }); setFormError(""); }} className="px-4 py-2 text-sm font-semibold bg-[#222] text-gray-300 rounded-lg border border-[#333] hover:bg-[#2a2a2a] transition">
              Adjust Count
            </button>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total (Active)" value={activeSpots.length} />
          <StatCard label="Available" value={availableCount} color="text-green-400" />
          <StatCard label="Occupied" value={occupiedCount} color="text-red-400" />
          <StatCard label="Reserved" value={reservedCount} color="text-orange-400" />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by spot name…"
            className="flex-1 rounded-lg bg-[#1a1a1a] px-4 py-3 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-sentraYellow"
          />
          <div className="flex gap-2">
            {["all", "available", "occupied", "reserved"].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition ${
                  filter === f
                    ? "bg-sentraYellow text-black border-sentraYellow"
                    : "bg-[#222] text-gray-400 border-[#333] hover:text-white"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Spot Grid */}
        {loading ? (
          <p className="text-gray-500 animate-pulse text-center py-10">Loading slots…</p>
        ) : displayed.length === 0 ? (
          <p className="text-gray-500 text-center py-10">No spots found. Use "Add Spot" or "Bulk Init" to create some.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {displayed.map(spot => (
              <SpotTile
                key={spot.id}
                spot={spot}
                onEdit={() => openEdit(spot)}
                onDelete={() => handleDelete(spot)}
                onToggle={() => toggleActive(spot)}
              />
            ))}
          </div>
        )}

        {/* ──────── Modals ──────── */}

        {/* Create Spot */}
        {showCreate && (
          <Modal title="Add Parking Spot" onClose={() => !saving && setShowCreate(false)}>
            {formError && <FormError msg={formError} />}
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label="Spot Name" value={createForm.spot_name} onChange={v => setCreateForm(p => ({ ...p, spot_name: v }))} placeholder="e.g. B-05" />
              <SelectField label="Spot Type" value={createForm.spot_type} onChange={v => setCreateForm(p => ({ ...p, spot_type: v }))} options={SPOT_TYPES} />
              <ModalActions saving={saving} onCancel={() => setShowCreate(false)} />
            </form>
          </Modal>
        )}

        {/* Bulk Init */}
        {showInit && (
          <Modal title="Bulk Initialise Spots" onClose={() => !saving && setShowInit(false)}>
            {formError && <FormError msg={formError} />}
            <form onSubmit={handleInit} className="space-y-4">
              <Field label="Count" type="number" value={initForm.count} onChange={v => setInitForm(p => ({ ...p, count: parseInt(v) || 0 }))} />
              <Field label="Prefix" value={initForm.prefix} onChange={v => setInitForm(p => ({ ...p, prefix: v }))} placeholder="A" />
              <SelectField label="Spot Type" value={initForm.spot_type} onChange={v => setInitForm(p => ({ ...p, spot_type: v }))} options={SPOT_TYPES} />
              <ModalActions saving={saving} saveLabel="Initialise" onCancel={() => setShowInit(false)} />
            </form>
          </Modal>
        )}

        {/* Edit Spot */}
        {showEdit && (
          <Modal title={`Edit ${showEdit.spot_name}`} onClose={() => !saving && setShowEdit(null)}>
            {formError && <FormError msg={formError} />}
            <form onSubmit={handleEdit} className="space-y-4">
              <Field label="Spot Name" value={editForm.spot_name} onChange={v => setEditForm(p => ({ ...p, spot_name: v }))} />
              <SelectField label="Spot Type" value={editForm.spot_type} onChange={v => setEditForm(p => ({ ...p, spot_type: v }))} options={SPOT_TYPES} />
              <div>
                <label className="text-xs text-gray-400 block mb-2">Active</label>
                <button
                  type="button"
                  onClick={() => setEditForm(p => ({ ...p, is_active: !p.is_active }))}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    editForm.is_active
                      ? "bg-green-500/20 text-green-400 border border-green-500/50"
                      : "bg-red-500/20 text-red-400 border border-red-500/50"
                  }`}
                >
                  {editForm.is_active ? "Active" : "Inactive"}
                </button>
              </div>
              <ModalActions saving={saving} onCancel={() => setShowEdit(null)} />
            </form>
          </Modal>
        )}

        {/* Adjust Count */}
        {showAdjust && (
          <Modal title="Adjust Total Slot Count" onClose={() => !saving && setShowAdjust(false)}>
            <p className="text-gray-400 text-sm mb-4">
              Current active spots: <strong className="text-white">{activeSpots.length}</strong>.
              Set a new total — spots will be added or deactivated automatically.
            </p>
            {formError && <FormError msg={formError} />}
            <form onSubmit={handleAdjust} className="space-y-4">
              <Field label="New Total" type="number" value={adjustForm.total} onChange={v => setAdjustForm(p => ({ ...p, total: v }))} />
              <Field label="Prefix (for new spots)" value={adjustForm.prefix} onChange={v => setAdjustForm(p => ({ ...p, prefix: v }))} placeholder="A" />
              <ModalActions saving={saving} saveLabel="Apply" onCancel={() => setShowAdjust(false)} />
            </form>
          </Modal>
        )}
      </main>
    </div>
  );
}

// ──────────────────────────── Sub-components ────────────────────────────

function StatCard({ label, value, color = "text-white" }) {
  return (
    <div className="bg-[#171717] border border-[#232323] p-5 rounded-2xl">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function SpotTile({ spot, onEdit, onDelete, onToggle }) {
  const inactive = spot.is_active === false;
  let bg, border, textColor, statusLabel;

  if (inactive) {
    bg = "bg-gray-800/30"; border = "border-gray-700/50"; textColor = "text-gray-600"; statusLabel = "Inactive";
  } else if (spot.is_occupied) {
    bg = "bg-red-900/20"; border = "border-red-900/50"; textColor = "text-red-500"; statusLabel = "Occupied";
  } else if (spot.is_reserved) {
    bg = "bg-orange-900/20"; border = "border-orange-900/50"; textColor = "text-orange-400"; statusLabel = "Reserved";
  } else {
    bg = "bg-green-900/20"; border = "border-green-900/50"; textColor = "text-green-500"; statusLabel = "Available";
  }

  return (
    <div className={`${bg} ${border} border rounded-xl p-4 flex flex-col items-center gap-2 group relative`}>
      <span className={`text-lg font-bold ${textColor}`}>{spot.spot_name}</span>
      <span className={`text-[10px] uppercase font-semibold ${textColor}`}>{statusLabel}</span>
      {spot.spot_type && spot.spot_type !== "regular" && (
        <span className="text-[9px] text-gray-500 uppercase">{spot.spot_type}</span>
      )}

      {/* Actions on hover */}
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button onClick={onEdit} title="Edit" className="w-6 h-6 rounded bg-[#222] text-gray-400 hover:text-white flex items-center justify-center text-xs">✏</button>
        <button onClick={onToggle} title={inactive ? "Activate" : "Deactivate"} className="w-6 h-6 rounded bg-[#222] text-gray-400 hover:text-yellow-400 flex items-center justify-center text-xs">
          {inactive ? "✓" : "⊘"}
        </button>
        {!spot.is_occupied && (
          <button onClick={onDelete} title="Delete" className="w-6 h-6 rounded bg-[#222] text-gray-400 hover:text-red-400 flex items-center justify-center text-xs">✕</button>
        )}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#222] rounded-lg px-4 py-3 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-sentraYellow"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-2">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-[#222] rounded-lg px-4 py-3 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-sentraYellow"
      >
        {options.map(o => (
          <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
        ))}
      </select>
    </div>
  );
}

function FormError({ msg }) {
  return (
    <div className="mb-4 bg-red-500/10 border border-red-500 text-red-400 text-sm p-3 rounded-lg">{msg}</div>
  );
}

function ModalActions({ saving, saveLabel = "Save", onCancel }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button type="button" onClick={onCancel} disabled={saving} className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-white/10 transition disabled:opacity-50">
        Cancel
      </button>
      <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold bg-sentraYellow text-black rounded-lg hover:brightness-95 transition disabled:opacity-70">
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}
