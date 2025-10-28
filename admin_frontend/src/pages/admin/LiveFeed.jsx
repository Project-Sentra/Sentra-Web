import React from "react";
import Sidebar from "../../components/Sidebar";
import ParkingMap from "../../components/ParkingMap";
import CameraTile from "../../components/CameraTile";

export default function LiveFeed() {
  return (
    <div className="min-h-screen bg-sentraBlack text-white flex">
      <Sidebar facilityName="Downtown Parking" />

      <main className="flex-1 p-8">
        <div className="bg-[#171717] border border-[#232323] rounded-2xl p-6 max-w-4xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <CameraTile key={i} title={`Cam ${String(i + 1).padStart(2, "0")}`} />
            ))}
          </div>
        </div>
      </main>

      <div className="hidden lg:block w-[420px] p-8">
        <ParkingMap rows={8} cols={4} busyIndices={[13,14,28,29]} />
      </div>
    </div>
  );
}
