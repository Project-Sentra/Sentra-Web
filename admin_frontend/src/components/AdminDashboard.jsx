import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import ParkingMap from "../../components/ParkingMap";
import axios from "axios";

export default function Dashboard() {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);

  // Backend එකෙන් Parking Spots දත්ත ලබාගැනීම
  const fetchParkingData = async () => {
    try {
      // අපි හදපු GET API එකට කතා කරනවා
      const response = await axios.get("http://127.0.0.1:5000/api/spots");
      
      // දත්ත ලැබුනා නම් State එක update කරනවා
      if (response.data && response.data.spots) {
        setSpots(response.data.spots);
      }
    } catch (error) {
      console.error("Error fetching parking data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Page එක load වෙනකොට මුලින්ම data ගන්නවා
    fetchParkingData();

    // සෑම තත්පර 2කට වරක් දත්ත refresh කරනවා (Real-time වගේ පෙනෙන්න)
    const interval = setInterval(fetchParkingData, 2000);

    // Page එකෙන් ඉවත් වෙනකොට interval එක නවත්වනවා
    return () => clearInterval(interval);
  }, []);

  // දත්ත ගණනය කිරීම්
  const occupiedCount = spots.filter((s) => s.is_occupied).length; // වාහන ඇති තැන් ගණන
  const totalSpots = spots.length || 32; // මුළු තැන් ගණන

  // Occupied spots වල ID ටික ParkingMap එකට යවන්න සකසා ගැනීම
  // Database ID (1, 2, 3...) --> Array Index (0, 1, 2...) බවට පත් කිරීම
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
            <p className="text-xl font-bold text-[#e2e600] animate-pulse">● LIVE</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Occupied Slots Card */}
          <div className="bg-[#171717] border border-[#232323] p-6 rounded-2xl">
            <p className="text-gray-400 text-sm">Slots Occupied</p>
            <p className="text-4xl font-bold mt-2">
              {occupiedCount}<span className="text-gray-600 text-xl">/{totalSpots}</span>
            </p>
          </div>

          {/* Revenue Card (දැනට මෙය ස්ථාවර අගයක්, පසුව අපි මෙයත් backend එකට සම්බන්ධ කරමු) */}
          <div className="bg-[#171717] border border-[#232323] p-6 rounded-2xl">
            <p className="text-gray-400 text-sm">Today's Revenue</p>
            <p className="text-4xl font-bold mt-2 text-[#e2e600]">LKR 87,000</p>
          </div>

          {/* Free Slots Card */}
          <div className="bg-[#171717] border border-[#232323] p-6 rounded-2xl">
            <p className="text-gray-400 text-sm">Free Slots</p>
            <p className="text-4xl font-bold mt-2 text-green-400">
              {totalSpots - occupiedCount}
            </p>
          </div>
        </div>

        {/* Parking Map Section */}
        <div className="h-auto">
          {loading ? (
            <p className="text-gray-500">Loading map data...</p>
          ) : (
            <ParkingMap rows={4} cols={8} busyIndices={busyIndices} />
          )}
        </div>
      </main>
    </div>
  );
}