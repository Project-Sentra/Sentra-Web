/**
 * Reservations.jsx - Full Reservation Management Page (Admin)
 * =============================================================
 * Displays all parking reservations with full detail, admin actions
 * (cancel, confirm, check-in, complete, no-show), editable notes,
 * and a slide-out detail panel.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import lprService from "../../services/lprService";

const fmt = (v) => (v ? new Date(v).toLocaleString() : "—");
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : "—");
const fmtTime = (v) => (v ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");

const STATUS_COLORS = {
  pending:    "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  confirmed:  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  checked_in: "bg-green-500/20 text-green-400 border-green-500/30",
  completed:  "bg-gray-500/20 text-gray-400 border-gray-500/30",
  cancelled:  "bg-red-500/20 text-red-400 border-red-500/30",
  no_show:    "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const PAYMENT_COLORS = {
  pending:  "text-yellow-400",
  paid:     "text-green-400",
  refunded: "text-blue-400",
};

const STATUSES = ["", "pending", "confirmed", "checked_in", "completed", "cancelled", "no_show"];

function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[status] || "bg-gray-500/20 text-gray-400"}`}>
      {status?.replace("_", " ").toUpperCase()}
    </span>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-[#232323] last:border-0">
      <span className="text-gray-500 text-sm shrink-0 w-32">{label}</span>
      <span className="text-gray-200 text-sm text-right">{children}</span>
    </div>
  );
}

export default function Reservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState(null);   // detail panel
  const [actionLoading, setActionLoading] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) navigate("/signin");
  }, [navigate]);

  async function fetchReservations() {
    try {
      const data = await lprService.getReservations({
        all: true,
        status: statusFilter || undefined,
      });
      setReservations(data);
    } catch (err) {
      console.error("Failed to fetch reservations:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchReservations();
  }, [statusFilter]);

  function openDetail(r) {
    setSelected(r);
    setEditNotes(r.notes || "");
  }

  async function handleAction(action) {
    if (!selected) return;
    const labels = { cancel: "Cancel", confirm: "Confirm", check_in: "Check In", complete: "Complete", no_show: "No-Show" };
    if (!window.confirm(`${labels[action] || action} this reservation?`)) return;

    setActionLoading(true);
    try {
      await lprService.updateReservation(selected.id, { action });
      await fetchReservations();
      // Refresh selected with updated data
      const updated = await lprService.getReservation(selected.id);
      setSelected({ ...selected, ...updated });
    } catch (err) {
      alert("Failed: " + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveNotes() {
    if (!selected) return;
    setActionLoading(true);
    try {
      await lprService.updateReservation(selected.id, { notes: editNotes });
      await fetchReservations();
      setSelected({ ...selected, notes: editNotes });
    } catch (err) {
      alert("Failed to save notes");
    } finally {
      setActionLoading(false);
    }
  }

  function openEdit(r) {
    setEditData({
      reserved_start: r.reserved_start?.slice(0, 16) || "",
      reserved_end: r.reserved_end?.slice(0, 16) || "",
      amount: r.amount || "",
      payment_status: r.payment_status || "pending",
    });
    setShowEditModal(true);
  }

  async function handleSaveEdit() {
    if (!selected) return;
    setActionLoading(true);
    try {
      const updates = {};
      if (editData.reserved_start) updates.reserved_start = new Date(editData.reserved_start).toISOString();
      if (editData.reserved_end) updates.reserved_end = new Date(editData.reserved_end).toISOString();
      if (editData.amount !== "") updates.amount = parseInt(editData.amount);
      if (editData.payment_status) updates.payment_status = editData.payment_status;
      await lprService.updateReservation(selected.id, updates);
      await fetchReservations();
      const updated = await lprService.getReservation(selected.id);
      setSelected({ ...selected, ...updated });
      setShowEditModal(false);
    } catch (err) {
      alert("Failed to update reservation");
    } finally {
      setActionLoading(false);
    }
  }

  // Stats
  const counts = {};
  reservations.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });

  // Available actions per status
  function getActions(status) {
    switch (status) {
      case "pending":   return ["confirm", "cancel", "no_show"];
      case "confirmed": return ["check_in", "cancel", "no_show"];
      case "checked_in": return ["complete"];
      default:          return [];
    }
  }

  const actionStyles = {
    cancel:   "bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/30",
    confirm:  "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/30",
    check_in: "bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/30",
    complete: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30",
    no_show:  "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border-orange-500/30",
  };

  const actionLabels = {
    cancel: "Cancel", confirm: "Confirm", check_in: "Check In", complete: "Complete", no_show: "No-Show",
  };

  // Time remaining / elapsed helpers
  function getTimeInfo(r) {
    if (["cancelled", "no_show"].includes(r.status)) return null;
    const now = new Date();
    const start = new Date(r.reserved_start);
    const end = new Date(r.reserved_end);
    if (r.status === "completed") {
      const dur = Math.round((end - start) / 60000);
      return { label: "Duration", value: `${Math.floor(dur / 60)}h ${dur % 60}m`, color: "text-gray-400" };
    }
    if (now < start) {
      const diff = Math.round((start - now) / 60000);
      if (diff < 60) return { label: "Starts in", value: `${diff}m`, color: "text-blue-400" };
      return { label: "Starts in", value: `${Math.floor(diff / 60)}h ${diff % 60}m`, color: "text-blue-400" };
    }
    if (now > end) return { label: "Overdue by", value: `${Math.round((now - end) / 60000)}m`, color: "text-red-400" };
    const remaining = Math.round((end - now) / 60000);
    return { label: "Time left", value: `${Math.floor(remaining / 60)}h ${remaining % 60}m`, color: "text-green-400" };
  }

  return (
    <div className="flex h-screen bg-sentraBlack text-white overflow-hidden">
      <Sidebar facilityName="All Facilities" />

      <main className={`flex-1 p-8 overflow-y-auto transition-all ${selected ? "mr-[440px]" : ""}`}>
        {/* Header */}
        <header className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">Reservations</h1>
            <p className="text-gray-400 text-sm mt-1">
              Manage all parking reservations across facilities
            </p>
          </div>
        </header>

        {/* Stats row */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {["pending", "confirmed", "checked_in", "completed", "cancelled", "no_show"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              className={`p-3 rounded-xl border transition-all text-left ${
                statusFilter === s
                  ? "border-sentraYellow bg-sentraYellow/10"
                  : "border-[#232323] bg-[#171717] hover:border-[#333]"
              }`}
            >
              <p className="text-2xl font-bold">{counts[s] || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</p>
            </button>
          ))}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap mb-6">
          {STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === status
                  ? "bg-sentraYellow text-black"
                  : "bg-[#222] text-gray-400 hover:text-white"
              }`}
            >
              {status === "" ? "All" : status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
          <span className="text-gray-600 text-xs self-center ml-2">
            {reservations.length} result{reservations.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-gray-500 animate-pulse">Loading reservations...</p>
        ) : (
          <div className="bg-[#171717] rounded-2xl border border-[#232323] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#1a1a1a] text-gray-400 text-left">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Facility</th>
                  <th className="px-4 py-3">Spot</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r, i) => {
                  const timeInfo = getTimeInfo(r);
                  const actions = getActions(r.status);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => openDetail(r)}
                      className={`border-t border-[#232323] cursor-pointer transition-colors ${
                        selected?.id === r.id ? "bg-sentraYellow/5" : "hover:bg-[#1e1e1e]"
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm">{r.users?.full_name || "—"}</div>
                        <div className="text-gray-500 text-xs">{r.users?.email || ""}</div>
                        {r.users?.phone && <div className="text-gray-600 text-xs">{r.users.phone}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-sentraYellow text-black font-bold px-2 py-0.5 rounded text-xs">
                          {r.vehicles?.plate_number || "—"}
                        </span>
                        {r.vehicles?.make && (
                          <div className="text-gray-600 text-xs mt-0.5">{r.vehicles.make} {r.vehicles.model}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{r.facilities?.name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-gray-300">{r.parking_spots?.spot_name || "—"}</span>
                        {r.parking_spots?.spot_type && r.parking_spots.spot_type !== "regular" && (
                          <span className="ml-1 text-xs text-gray-600 bg-[#232323] px-1.5 py-0.5 rounded">
                            {r.parking_spots.spot_type}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-gray-300">{fmtDate(r.reserved_start)}</div>
                        <div className="text-gray-500">
                          {fmtTime(r.reserved_start)} – {fmtTime(r.reserved_end)}
                        </div>
                        {timeInfo && (
                          <div className={`text-xs mt-0.5 ${timeInfo.color}`}>
                            {timeInfo.label}: {timeInfo.value}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3">
                        <div className="text-sm">{r.amount ? `LKR ${r.amount.toLocaleString()}` : "—"}</div>
                        <div className={`text-xs ${PAYMENT_COLORS[r.payment_status] || "text-gray-500"}`}>
                          {r.payment_status || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 flex-wrap">
                          {actions.map((action) => (
                            <button
                              key={action}
                              onClick={() => { openDetail(r); setTimeout(() => handleAction(action), 0); }}
                              className={`text-xs px-2 py-1 rounded border transition ${actionStyles[action]}`}
                            >
                              {actionLabels[action]}
                            </button>
                          ))}
                          {actions.length === 0 && <span className="text-gray-600 text-xs">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {reservations.length === 0 && (
              <p className="text-gray-500 text-center py-12">No reservations found.</p>
            )}
          </div>
        )}
      </main>

      {/* ========== Detail Side Panel ========== */}
      {selected && (
        <aside className="fixed right-0 top-0 h-full w-[440px] bg-[#141414] border-l border-[#232323] overflow-y-auto z-40 shadow-2xl">
          {/* Panel header */}
          <div className="sticky top-0 bg-[#141414] border-b border-[#232323] px-6 py-4 flex justify-between items-center z-10">
            <div>
              <h2 className="text-lg font-bold">Reservation #{selected.id}</h2>
              <StatusBadge status={selected.status} />
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-gray-500 hover:text-white p-1 rounded hover:bg-[#232323] transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
              </svg>
            </button>
          </div>

          <div className="px-6 py-4 space-y-6">
            {/* User section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Customer</h3>
              <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#232323]">
                <p className="text-white font-medium">{selected.users?.full_name || "—"}</p>
                <p className="text-gray-400 text-sm">{selected.users?.email || "—"}</p>
                {selected.users?.phone && <p className="text-gray-500 text-sm mt-1">{selected.users.phone}</p>}
              </div>
            </div>

            {/* Vehicle section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Vehicle</h3>
              <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#232323]">
                <span className="bg-sentraYellow text-black font-bold px-3 py-1 rounded text-sm">
                  {selected.vehicles?.plate_number || "—"}
                </span>
                {selected.vehicles?.make && (
                  <p className="text-gray-400 text-sm mt-2">{selected.vehicles.make} {selected.vehicles.model}</p>
                )}
              </div>
            </div>

            {/* Booking details */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Booking Details</h3>
              <div className="bg-[#1a1a1a] rounded-xl px-4 border border-[#232323]">
                <DetailRow label="Facility">{selected.facilities?.name || "—"}</DetailRow>
                <DetailRow label="Spot">
                  {selected.parking_spots?.spot_name || "—"}
                  {selected.parking_spots?.spot_type && selected.parking_spots.spot_type !== "regular" && (
                    <span className="ml-2 text-xs bg-[#232323] px-1.5 py-0.5 rounded text-gray-500">
                      {selected.parking_spots.spot_type}
                    </span>
                  )}
                </DetailRow>
                <DetailRow label="Start">{fmt(selected.reserved_start)}</DetailRow>
                <DetailRow label="End">{fmt(selected.reserved_end)}</DetailRow>
                {(() => {
                  const info = getTimeInfo(selected);
                  return info ? (
                    <DetailRow label={info.label}><span className={info.color}>{info.value}</span></DetailRow>
                  ) : null;
                })()}
                <DetailRow label="QR Code">
                  {selected.qr_code ? (
                    <span className="text-xs font-mono text-gray-500 break-all">{selected.qr_code}</span>
                  ) : "—"}
                </DetailRow>
              </div>
            </div>

            {/* Payment */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payment</h3>
              <div className="bg-[#1a1a1a] rounded-xl px-4 border border-[#232323]">
                <DetailRow label="Amount">
                  {selected.amount ? `LKR ${selected.amount.toLocaleString()}` : "—"}
                </DetailRow>
                <DetailRow label="Status">
                  <span className={PAYMENT_COLORS[selected.payment_status] || "text-gray-500"}>
                    {selected.payment_status?.toUpperCase() || "—"}
                  </span>
                </DetailRow>
              </div>
            </div>

            {/* Timestamps */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Timestamps</h3>
              <div className="bg-[#1a1a1a] rounded-xl px-4 border border-[#232323]">
                <DetailRow label="Created">{fmt(selected.created_at)}</DetailRow>
                <DetailRow label="Updated">{fmt(selected.updated_at)}</DetailRow>
              </div>
            </div>

            {/* Notes */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Admin Notes</h3>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes about this reservation..."
                rows={3}
                className="w-full bg-[#1a1a1a] border border-[#232323] rounded-xl p-3 text-sm text-gray-300 placeholder-gray-600 focus:border-sentraYellow/50 focus:outline-none resize-none"
              />
              {editNotes !== (selected.notes || "") && (
                <button
                  onClick={handleSaveNotes}
                  disabled={actionLoading}
                  className="mt-2 px-4 py-1.5 bg-sentraYellow text-black text-xs font-medium rounded-lg hover:bg-yellow-400 transition disabled:opacity-50"
                >
                  Save Notes
                </button>
              )}
            </div>

            {/* Edit button */}
            {!["cancelled", "completed", "no_show"].includes(selected.status) && (
              <button
                onClick={() => openEdit(selected)}
                className="w-full py-2 bg-[#1a1a1a] border border-[#232323] rounded-xl text-sm text-gray-400 hover:text-white hover:border-[#333] transition"
              >
                Edit Times & Amount
              </button>
            )}

            {/* Action buttons */}
            {getActions(selected.status).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Actions</h3>
                <div className="flex gap-2 flex-wrap">
                  {getActions(selected.status).map((action) => (
                    <button
                      key={action}
                      onClick={() => handleAction(action)}
                      disabled={actionLoading}
                      className={`flex-1 min-w-[100px] py-2 rounded-xl text-sm font-medium border transition disabled:opacity-50 ${actionStyles[action]}`}
                    >
                      {actionLoading ? "..." : actionLabels[action]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ========== Edit Modal ========== */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setShowEditModal(false)}>
          <div className="bg-[#1a1a1a] rounded-2xl border border-[#232323] p-6 w-[420px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Edit Reservation #{selected?.id}</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={editData.reserved_start}
                  onChange={(e) => setEditData({ ...editData, reserved_start: e.target.value })}
                  className="w-full bg-[#151515] border border-[#303030] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sentraYellow/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">End Time</label>
                <input
                  type="datetime-local"
                  value={editData.reserved_end}
                  onChange={(e) => setEditData({ ...editData, reserved_end: e.target.value })}
                  className="w-full bg-[#151515] border border-[#303030] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sentraYellow/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Amount (LKR)</label>
                <input
                  type="number"
                  value={editData.amount}
                  onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
                  className="w-full bg-[#151515] border border-[#303030] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sentraYellow/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Payment Status</label>
                <select
                  value={editData.payment_status}
                  onChange={(e) => setEditData({ ...editData, payment_status: e.target.value })}
                  className="w-full bg-[#151515] border border-[#303030] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sentraYellow/50"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2 bg-[#232323] text-gray-400 rounded-lg text-sm hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={actionLoading}
                className="flex-1 py-2 bg-sentraYellow text-black font-medium rounded-lg text-sm hover:bg-yellow-400 transition disabled:opacity-50"
              >
                {actionLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
