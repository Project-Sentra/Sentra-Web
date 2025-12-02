import React, { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../../components/Sidebar";
import ParkingMap from "../../components/ParkingMap";

export default function Dashboard() {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
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
        </div>

        <div className="h-auto bg-[#171717] p-6 rounded-2xl border border-[#232323]">
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
      </main>
    </div>
  );
}
