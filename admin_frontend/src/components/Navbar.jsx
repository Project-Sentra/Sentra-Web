import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import LogoMain from "../assets/logo_notext.png";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const linkCls = ({ isActive }) =>
    "px-3 py-2 rounded-md text-sm font-medium " +
    (isActive ? "text-black bg-sentraYellow" : "text-gray-300 hover:text-white hover:bg-[#1b1b1b]");

  return (
  <header className="sticky top-0 z-40 border-b border-[#232323] bg-[#121212]/80 backdrop-blur supports-backdrop-filter:bg-[#121212]/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 text-white font-semibold">
            <img src={LogoMain} alt="Sentra" className="w-8 h-8" />
            <span className="text-xl">Sentra</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/admin" className={linkCls}>Facilities</NavLink>
            <NavLink to="/signin" className={linkCls}>Sign in</NavLink>
            <NavLink to="/signup" className={linkCls}>Sign up</NavLink>
          </nav>

          <button
            className="md:hidden w-10 h-10 grid place-items-center rounded-md text-gray-300 hover:text-white hover:bg-[#1b1b1b]"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-[#232323] bg-[#121212]">
          <div className="px-4 py-3 flex flex-col">
            <NavLink to="/admin" className={({isActive}) => "py-2 " + (isActive?"text-sentraYellow":"text-gray-300")} onClick={() => setOpen(false)}>Facilities</NavLink>
            <NavLink to="/signin" className={({isActive}) => "py-2 " + (isActive?"text-sentraYellow":"text-gray-300")} onClick={() => setOpen(false)}>Sign in</NavLink>
            <NavLink to="/signup" className={({isActive}) => "py-2 " + (isActive?"text-sentraYellow":"text-gray-300")} onClick={() => setOpen(false)}>Sign up</NavLink>
          </div>
        </div>
      )}
    </header>
  );
}
