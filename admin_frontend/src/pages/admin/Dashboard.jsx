import React from "react";
// import { useParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import ParkingMap from "../../components/ParkingMap";

function Metric({ big, sub, emphasis = false }) {
  return (
    <div className="bg-[#171717] border border-[#232323] rounded-2xl p-6">
      <div className={"text-5xl font-bold " + (emphasis ? "text-sentraYellow" : "text-white")}>
        {big}
      </div>
      <div className="text-gray-400 mt-1">{sub}</div>
    </div>
  );
}

export default function Dashboard() {

  return (
    <div className="min-h-screen bg-sentraBlack text-white flex">
      <Sidebar facilityName="Downtown Parking" />

      <main className="flex-1 p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          <Metric big={<span><span className="text-sentraYellow">17</span>/<span className="text-gray-500">26</span></span>} sub="slots occupied" />
          <Metric big={<span className="text-sentraYellow">324</span>} sub="Total vehicles today" />
          <Metric big={<span className="text-sentraYellow">LKR 87,000/-</span>} sub="Revenue today" />
        </div>
      </main>

      <div className="hidden lg:block w-[420px] p-8">
        <ParkingMap rows={8} cols={4} busyIndices={[13,14,28,29]} />
      </div>
    </div>
  );
}
