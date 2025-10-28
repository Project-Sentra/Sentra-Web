import React from "react";
import { Link } from "react-router-dom";
import logoMain from "../assets/logo_main.png";
import Navbar from "../components/Navbar";

export default function Home() {
  return (
    <div className="min-h-screen bg-sentraBlack text-white">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(226,230,0,0.08),transparent_60%)]" />
        <div className="max-w-6xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-sm text-gray-400">Smart Parking Platform</p>
            <h1 className="mt-3 text-5xl sm:text-6xl font-extrabold leading-tight">
              Manage facilities with speed and clarity.
            </h1>
            <p className="mt-4 text-gray-400 max-w-prose">
              Sentra gives you realtime occupancy, live camera feeds, and revenue
              analytics across all your parking facilities.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/admin" className="px-5 py-3 rounded-md bg-sentraYellow text-black font-semibold hover:brightness-95">
                Go to Facilities
              </Link>
              <Link to="/signin" className="px-5 py-3 rounded-md border border-[#2a2a2a] hover:border-sentraYellow text-gray-200">
                Sign in
              </Link>
              <Link to="/signup" className="px-5 py-3 rounded-md border border-[#2a2a2a] hover:border-sentraYellow text-gray-200">
                Create account
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <img src={logoMain} alt="Sentra" className="w-[420px] max-w-full" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 border-t border-[#232323]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{
              title: "Live status",
              body: "Realtime occupancy with a visual parking map.",
            },{
              title: "Camera feeds",
              body: "Monitor ingress/egress with multi-cam tiles.",
            },{
              title: "Revenue insights",
              body: "Track daily totals and trends across sites.",
            }].map((f, i) => (
              <div key={i} className="bg-[#161616] border border-[#232323] rounded-2xl p-6">
                <div className="text-sentraYellow text-2xl mb-2">●</div>
                <h3 className="text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-gray-400">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-[#232323] text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Sentra. All rights reserved.
      </footer>
    </div>
  );
}
