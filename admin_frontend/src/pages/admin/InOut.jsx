import React from "react";
import Sidebar from "../../components/Sidebar";
import ParkingMap from "../../components/ParkingMap";

const rows = Array.from({ length: 18 }, () => ({
  plate: "CBH 5124",
  entry: "00.23",
  exit: "06.11",
  duration: "06.11",
  amount: "1090.00",
}));

export default function InOut() {
  return (
    <div className="min-h-screen bg-sentraBlack text-white flex">
      <Sidebar facilityName="Downtown Parking" />

      <main className="flex-1 p-8">
        <div className="max-w-3xl">
          <div className="bg-[#171717] border border-[#232323] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-sentraYellow">
                <tr className="text-left">
                  <th className="px-6 py-3">License Plate Number</th>
                  <th className="px-6 py-3">Time of Entry</th>
                  <th className="px-6 py-3">Time of Exit</th>
                  <th className="px-6 py-3">Duration</th>
                  <th className="px-6 py-3">Amount LKR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="odd:bg-[#151515] even:bg-[#181818] border-t border-[#222]">
                    <td className="px-6 py-3 text-gray-200">{r.plate}</td>
                    <td className="px-6 py-3 text-gray-400">{r.entry}</td>
                    <td className="px-6 py-3 text-gray-400">{r.exit}</td>
                    <td className="px-6 py-3 text-gray-400">{r.duration}</td>
                    <td className="px-6 py-3 text-gray-400">{r.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <div className="hidden lg:block w-[420px] p-8">
        <ParkingMap rows={8} cols={4} busyIndices={[13,14,28,29]} />
      </div>
    </div>
  );
}
