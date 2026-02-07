/**
 * InOut.jsx - Vehicle Entry/Exit Logs Page
 * ==========================================
 * Shows a table of all parking sessions (entries + exits) with:
 *   - License plate, assigned spot, entry/exit times
 *   - Duration and parking fee (LKR)
 *   - Active sessions show "—" for exit time, duration, and amount
 *
 * Also shows a mini parking map on the right side (desktop only)
 * and a "Reset All Parking Spots" button for demo/testing.
 *
 * Data is polled every 1 second from GET /api/logs and GET /api/spots.
 */

import React, { useEffect, useState } from "react";
import api from "../../services/api";
import Sidebar from "../../components/Sidebar";
import ParkingMap from "../../components/ParkingMap";

const formatTime = (value) =>
  value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

const formatDuration = (minutes) => {
  if (minutes == null) return "—";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
};

export default function InOut() {
  const [logs, setLogs] = useState([]);
  const [spots, setSpots] = useState([]);
  const [error, setError] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingSpots, setLoadingSpots] = useState(true);

  async function fetchLogs() {
    try {
      const { data } = await api.get("/logs");
      setLogs(data?.logs ?? []);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch logs", err);
      setError("Cannot reach backend. Is Flask running on port 5000?");
    } finally {
      setLoadingLogs(false);
    }
  }

  async function fetchSpots() {
    try {
      const { data } = await api.get("/spots");
      setSpots(data?.spots ?? []);
    } catch (err) {
      console.error("Failed to fetch spots", err);
      // Disable error spamming
      if (err.response) {
        setError("Cannot reach backend. Is Flask running on port 5000?");
      }
    } finally {
      setLoadingSpots(false);
    }
  }

  async function handleResetSystem() {
    if (!window.confirm("Are you sure you want to reset all parking spots and clear history?")) {
      return;
    }
    
    try {
      await api.post("/reset-system");
      fetchLogs();
      fetchSpots();
    } catch (err) {
      console.error("Failed to reset system", err);
      alert("Failed to reset system: " + (err.response?.data?.message || err.message));
    }
  }

  useEffect(() => {
    fetchLogs();
    fetchSpots();
    const id = setInterval(() => {
      fetchLogs();
      fetchSpots();
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const busyIndices = spots
    .filter((s) => s.is_occupied)
    .map((s) => s.id - 1);

  return (
    <div className="min-h-screen bg-sentraBlack text-white flex">
      <Sidebar facilityName="Downtown Parking" />

      <main className="flex-1 p-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-xl mb-6 text-sm">
            ⚠️ {error}
          </div>
        )}

        <div className="max-w-3xl">
          <div className="bg-[#171717] border border-[#232323] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-sentraYellow">
                <tr className="text-left">
                  <th className="px-6 py-3">License Plate Number</th>
                  <th className="px-6 py-3">Spot</th>
                  <th className="px-6 py-3">Time of Entry</th>
                  <th className="px-6 py-3">Time of Exit</th>
                  <th className="px-6 py-3">Duration</th>
                  <th className="px-6 py-3">Amount LKR</th>
                </tr>
              </thead>
              <tbody>
                {loadingLogs ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500 animate-pulse">
                      Loading vehicle activity...
                    </td>
                  </tr>
                ) : logs.length ? (
                  logs.map((log) => (
                    <tr key={log.id} className="odd:bg-[#151515] even:bg-[#181818] border-t border-[#222]">
                      <td className="px-6 py-3 text-gray-200 font-medium">{log.plate_number}</td>
                      <td className="px-6 py-3 text-gray-400">{log.spot}</td>
                      <td className="px-6 py-3 text-gray-400">{formatTime(log.entry_time)}</td>
                      <td className="px-6 py-3 text-gray-400">{formatTime(log.exit_time)}</td>
                      <td className="px-6 py-3 text-gray-400">{formatDuration(log.duration_minutes)}</td>
                      <td className="px-6 py-3 text-gray-300">
                        {log.amount_lkr ? `LKR ${log.amount_lkr.toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                      No recent vehicle activity found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <div className="hidden lg:block w-[420px] p-8">
        <ParkingMap rows={4} cols={8} busyIndices={busyIndices} />
        {loadingSpots && (
          <p className="text-center text-gray-500 text-sm mt-3">Updating map…</p>
        )}
        
        <div className="mt-8 flex justify-center">
            <button
                onClick={handleResetSystem}
                className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-red-500/10 border border-[#333] hover:border-red-500/30 transition-all duration-300 shadow-lg"
            >
                <div className="p-1.5 rounded-full bg-[#222] group-hover:bg-red-500 text-gray-400 group-hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                        <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                    </svg>
                </div>
                <span className="text-sm font-medium text-gray-400 group-hover:text-red-400">Reset All Parking Spots</span>
            </button>
        </div>
      </div>
    </div>
  );
}
