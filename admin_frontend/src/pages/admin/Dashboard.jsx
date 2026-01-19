import React, { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../../components/Sidebar";
import ParkingMap from "../../components/ParkingMap";
import lprService from "../../services/lprService";

export default function Dashboard() {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lprStatus, setLprStatus] = useState({ connected: false });
  const [recentDetections, setRecentDetections] = useState([]);

  async function fetchSpots() {
    try {
      const { data } = await axios.get("http://127.0.0.1:5000/api/spots");
      setSpots(data?.spots ?? []);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch spots", err);
      setError("Cannot reach backend. Is Flask running on port 5000?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSpots();
    const id = setInterval(fetchSpots, 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch LPR status and recent detections
  useEffect(() => {
    async function fetchLprData() {
      const status = await lprService.checkBackendLprStatus();
      setLprStatus(status);
      const logs = await lprService.getDetectionLogs(5);
      setRecentDetections(logs);
    }
    fetchLprData();
    const lprInterval = setInterval(fetchLprData, 5000);
    return () => clearInterval(lprInterval);
  }, []);

  const occupiedCount = spots.filter((s) => s.is_occupied).length;
  const totalSpots = spots.length || 32;
  const busyIndices = spots
    .filter((s) => s.is_occupied)
    .map((s) => s.id - 1);

  return (
    <div className="flex h-screen bg-sentraBlack text-white overflow-hidden">
      <Sidebar facilityName="Downtown Parking" />

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
              <span className={error ? "text-red-500 font-bold" : "text-[#e2e600] font-bold"}>
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
            <p className="text-4xl font-bold mt-2 text-[#e2e600]">LKR 87,000</p>
          </div>
          <div className="bg-[#171717] border border-[#232323] p-6 rounded-2xl">
            <p className="text-gray-400 text-sm">Free Slots</p>
            <p className="text-4xl font-bold mt-2 text-green-400">{totalSpots - occupiedCount}</p>
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
            <h3 className="text-xl font-semibold mb-4">Live Floor Plan</h3>
            {loading ? (
              <p className="text-gray-500 animate-pulse">Loading map data...</p>
            ) : spots.length ? (
              <ParkingMap rows={4} cols={8} busyIndices={busyIndices} />
            ) : (
              <div className="text-yellow-500 text-center py-10">
                No parking spots found. Please run <strong>/api/init-spots</strong> via Postman.
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
                      <div className="bg-[#e2e600] px-2 py-0.5 rounded inline-block">
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
