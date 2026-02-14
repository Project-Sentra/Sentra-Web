/**
 * Dashboard.jsx - Main Facility Overview Page (v2.0)
 * ====================================================
 * Displays real-time parking facility status including:
 *   - Stat cards: occupied slots, today's revenue, free slots, LPR status
 *   - Interactive parking floor plan (ParkingMap component)
 *   - System reset button (clears all sessions for demo purposes)
 *   - Recent plate detections from the LPR AI service
 *
 * Data Sources:
 *   - Dashboard stats: polled every 5s from GET /api/dashboard/stats
 *   - Parking spots: polled every 3s from GET /api/facilities/:id/spots
 *   - LPR status + detections: polled every 5s from backend
 */

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import ParkingMap from "../../components/ParkingMap";
import lprService from "../../services/lprService";

export default function Dashboard() {
  const { facilityId } = useParams();
  const fid = parseInt(facilityId) || 1;

  const [spots, setSpots] = useState([]);
  const [stats, setStats] = useState(null);
  const [facilityName, setFacilityName] = useState("Parking Facility");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lprStatus, setLprStatus] = useState({ connected: false });
  const [recentDetections, setRecentDetections] = useState([]);

  /** Fetch spots for the parking map */
  async function fetchSpots() {
    try {
      const data = await lprService.getSpots(fid);
      setSpots(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch spots", err);
      if (err.response) {
        setError("Cannot reach backend. Is Flask running on port 5000?");
      }
    } finally {
      setLoading(false);
    }
  }

  /** Fetch dashboard stats (real revenue, counts) */
  async function fetchStats() {
    try {
      const data = await lprService.getDashboardStats(fid);
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  }

  /** Fetch facility name */
  async function fetchFacility() {
    try {
      const data = await lprService.getFacility(fid);
      if (data.facility) setFacilityName(data.facility.name);
    } catch (err) {
      console.error("Failed to fetch facility", err);
    }
  }

  async function handleResetSystem() {
    if (!window.confirm("Are you sure you want to reset all parking spots and clear history?")) {
      return;
    }
    try {
      await lprService.resetSystem(fid);
      fetchSpots();
      fetchStats();
    } catch (err) {
      console.error("Failed to reset system", err);
      alert("Failed to reset system: " + (err.response?.data?.message || err.message));
    }
  }

  // Fetch facility name once
  useEffect(() => { fetchFacility(); }, [fid]);

  // Poll spots every 3 seconds
  useEffect(() => {
    fetchSpots();
    const id = setInterval(fetchSpots, 3000);
    return () => clearInterval(id);
  }, [fid]);

  // Poll stats every 5 seconds
  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 5000);
    return () => clearInterval(id);
  }, [fid]);

  // Fetch LPR status and recent detections
  useEffect(() => {
    async function fetchLprData() {
      const status = await lprService.checkBackendLprStatus();
      setLprStatus(status);
      const logs = await lprService.getDetectionLogs(5, fid);
      setRecentDetections(logs);
    }
    fetchLprData();
    const lprInterval = setInterval(fetchLprData, 5000);
    return () => clearInterval(lprInterval);
  }, [fid]);

  // Derive occupancy from either stats or raw spots
  const occupiedCount = stats?.spots?.occupied ?? spots.filter((s) => s.is_occupied).length;
  const totalSpots = stats?.spots?.total ?? (spots.length || 32);
  const freeSlots = stats?.spots?.available ?? (totalSpots - occupiedCount);
  const todayRevenue = stats?.today?.revenue ?? 0;
  const todayEntries = stats?.today?.entries ?? 0;

  const busyIndices = spots
    .filter((s) => s.is_occupied)
    .map((_, i) => spots.indexOf(spots.filter(s => s.is_occupied)[i]));

  return (
    <div className="flex h-screen bg-sentraBlack text-white overflow-hidden">
      <Sidebar facilityName={facilityName} />

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold">Overview</h1>
            <p className="text-gray-400 text-sm mt-1">Real-time facility status</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Live Status</p>
            <div className="flex items-center gap-2 justify-end">
              <span className={`w-3 h-3 rounded-full animate-pulse ${error ? "bg-red-500" : "bg-green-500"}`}></span>
              <span className={error ? "text-red-500 font-bold" : "text-sentraYellow font-bold"}>
                {error ? "DISCONNECTED" : "CONNECTED"}
              </span>
            </div>
          </div>
        </header>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-xl mb-6 text-sm">
            ⚠️ {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#171717] border border-[#232323] p-6 rounded-2xl">
            <p className="text-gray-400 text-sm">Slots Occupied</p>
            <p className="text-4xl font-bold mt-2">
              {occupiedCount}
              <span className="text-gray-600 text-xl">/{totalSpots}</span>
            </p>
          </div>
          <div className="bg-[#171717] border border-[#232323] p-6 rounded-2xl">
            <p className="text-gray-400 text-sm">Today's Revenue</p>
            <p className="text-4xl font-bold mt-2 text-sentraYellow">
              LKR {todayRevenue.toLocaleString()}
            </p>
            <p className="text-gray-600 text-xs mt-1">{todayEntries} entries today</p>
          </div>
          <div className="bg-[#171717] border border-[#232323] p-6 rounded-2xl">
            <p className="text-gray-400 text-sm">Free Slots</p>
            <p className="text-4xl font-bold mt-2 text-green-400">{freeSlots}</p>
          </div>
          <div className="bg-[#171717] border border-[#232323] p-6 rounded-2xl">
            <p className="text-gray-400 text-sm">LPR System</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`w-3 h-3 rounded-full ${lprStatus.connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></span>
              <p className={`text-xl font-bold ${lprStatus.connected ? "text-green-400" : "text-red-400"}`}>
                {lprStatus.connected ? "ONLINE" : "OFFLINE"}
              </p>
            </div>
            {lprStatus.cameras_active > 0 && (
              <p className="text-gray-500 text-sm mt-1">{lprStatus.cameras_active} cameras active</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Floor Plan */}
          <div className="lg:col-span-2 h-auto bg-[#171717] p-6 rounded-2xl border border-[#232323]">
            <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-semibold">Live Floor Plan</h3>
                <button
                    onClick={handleResetSystem}
                    title="Reset all spots"
                    className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#222] hover:bg-red-500/10 border border-[#333] hover:border-red-500/50 transition-all duration-200"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="text-gray-400 group-hover:text-red-500 transition-colors" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                        <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                    </svg>
                    <span className="text-xs font-medium text-gray-400 group-hover:text-red-500">Reset</span>
                </button>
            </div>
            
            {loading ? (
              <p className="text-gray-500 animate-pulse">Loading map data...</p>
            ) : spots.length ? (
              <ParkingMap rows={4} cols={8} busyIndices={busyIndices} />
            ) : (
              <div className="text-gray-500 text-center py-10">
                No parking floor plan data available.
              </div>
            )}
          </div>

          {/* Recent Detections Panel */}
          <div className="bg-[#171717] p-6 rounded-2xl border border-[#232323]">
            <h3 className="text-xl font-semibold mb-4">Recent Detections</h3>
            {recentDetections.length > 0 ? (
              <div className="space-y-3">
                {recentDetections.map((det) => (
                  <div
                    key={det.id}
                    className="flex items-center justify-between p-3 bg-[#1f1f1f] rounded-xl"
                  >
                    <div>
                      <div className="bg-sentraYellow px-2 py-0.5 rounded inline-block">
                        <span className="text-black font-bold text-sm">{det.plate_number}</span>
                      </div>
                      <p className="text-gray-500 text-xs mt-1">{det.camera_id}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          det.action_taken === "entry"
                            ? "bg-green-500/20 text-green-400"
                            : det.action_taken === "exit"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {det.action_taken?.toUpperCase() || "PENDING"}
                      </span>
                      <p className="text-gray-600 text-xs mt-1">
                        {Math.round(det.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8 text-sm">
                No recent detections
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
