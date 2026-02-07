/**
 * Reservations.jsx - Reservation Management Page (Admin)
 * ========================================================
 * Displays all parking reservations across all users and facilities.
 * Admin can filter by status and cancel reservations.
 *
 * Data Source: GET /api/reservations?all=true
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import lprService from "../../services/lprService";

export default function Reservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
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

  async function handleCancel(reservationId) {
    if (!window.confirm("Cancel this reservation?")) return;
    try {
      await lprService.updateReservation(reservationId, { action: "cancel" });
      fetchReservations();
    } catch (err) {
      alert("Failed: " + err.message);
    }
  }

  const statusColors = {
    pending: "bg-yellow-500/20 text-yellow-400",
    confirmed: "bg-blue-500/20 text-blue-400",
    checked_in: "bg-green-500/20 text-green-400",
    completed: "bg-gray-500/20 text-gray-400",
    cancelled: "bg-red-500/20 text-red-400",
    no_show: "bg-orange-500/20 text-orange-400",
  };

  const statuses = ["", "pending", "confirmed", "checked_in", "completed", "cancelled", "no_show"];

  return (
    <div className="flex h-screen bg-sentraBlack text-white overflow-hidden">
      <Sidebar facilityName="Reservations" />

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold">Reservations</h1>
            <p className="text-gray-400 text-sm mt-1">
              {reservations.length} reservations
            </p>
          </div>

          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            {statuses.map((status) => (
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
          </div>
        </header>

        {loading ? (
          <p className="text-gray-500 animate-pulse">Loading reservations...</p>
        ) : (
          <div className="bg-[#171717] rounded-2xl border border-[#232323] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#1a1a1a] text-gray-400 text-left">
                <tr>
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Vehicle</th>
                  <th className="px-6 py-4">Facility</th>
                  <th className="px-6 py-4">Spot</th>
                  <th className="px-6 py-4">Start</th>
                  <th className="px-6 py-4">End</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r, i) => (
                  <tr key={r.id} className="border-t border-[#232323] hover:bg-[#1e1e1e]">
                    <td className="px-6 py-4 text-gray-500">{i + 1}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{r.users?.full_name || "—"}</div>
                      <div className="text-gray-500 text-xs">{r.users?.email || ""}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-sentraYellow text-black font-bold px-2 py-0.5 rounded text-xs">
                        {r.vehicles?.plate_number || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{r.facilities?.name || "—"}</td>
                    <td className="px-6 py-4 text-gray-400">{r.parking_spots?.spot_name || "—"}</td>
                    <td className="px-6 py-4 text-gray-300 text-xs">
                      {new Date(r.reserved_start).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-xs">
                      {new Date(r.reserved_end).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${statusColors[r.status] || "bg-gray-500/20 text-gray-400"}`}>
                        {r.status?.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {r.amount ? `LKR ${r.amount}` : "—"}
                    </td>
                    <td className="px-6 py-4">
                      {["pending", "confirmed"].includes(r.status) && (
                        <button
                          onClick={() => handleCancel(r.id)}
                          className="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {reservations.length === 0 && (
              <p className="text-gray-500 text-center py-12">No reservations found.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
