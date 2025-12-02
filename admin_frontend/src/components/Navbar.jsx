import React, { useState, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
// ඔබ VS Code හිදී පහත පේළිය uncomment කරන්න
import LogoMain from "../assets/logo_notext.png";
//const LogoMain = ""; // VS Code හිදී මෙය මකා දමන්න

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  // 1. Component එක load වන විට පරිශීලකයා ලොග් වී ඇත්දැයි බලන්න
  useEffect(() => {
    const userEmail = localStorage.getItem("userEmail");
    if (userEmail) {
      setIsLoggedIn(true);
    }
  }, []);

  // 2. Logout බොත්තම ක්‍රියාත්මක වූ විට දත්ත මකා දමා Signin වෙත යවන්න
  const handleLogout = () => {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
    setIsLoggedIn(false);
    navigate("/signin");
  };

  const linkCls = ({ isActive }) =>
    "px-3 py-2 rounded-md text-sm font-medium transition " +
    (isActive ? "text-black bg-[#e2e600]" : "text-gray-300 hover:text-white hover:bg-[#1b1b1b]");

  return (
    <header className="sticky top-0 z-40 border-b border-[#232323] bg-[#121212]/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 text-white font-semibold">
            <img src={LogoMain || "https://placehold.co/32x32/eab308/000?text=S"} alt="Sentra" className="w-8 h-8 rounded-full" />
            <span className="text-xl tracking-tight">Sentra</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/admin" className={linkCls}>Facilities</NavLink>
            
            {/* 3. ලොග් වී ඇත්නම් Logout පෙන්වන්න, නැත්නම් Sign In පෙන්වන්න */}
            {!isLoggedIn ? (
              <>
                <NavLink to="/signin" className={linkCls}>Sign in</NavLink>
                <NavLink to="/signup" className={linkCls}>Sign up</NavLink>
              </>
            ) : (
              <button 
                onClick={handleLogout} 
                className="px-3 py-2 rounded-md text-sm font-medium text-red-400 hover:bg-[#1b1b1b] transition"
              >
                Logout
              </button>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-300 hover:text-white"
            onClick={() => setOpen(!open)}
          >
            ☰
          </button>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden border-t border-[#232323] bg-[#121212]">
          <div className="px-4 py-3 flex flex-col space-y-2">
            <NavLink to="/admin" className="text-gray-300 hover:text-[#e2e600]" onClick={() => setOpen(false)}>Facilities</NavLink>
            
            {!isLoggedIn ? (
              <>
                <NavLink to="/signin" className="text-gray-300 hover:text-[#e2e600]" onClick={() => setOpen(false)}>Sign in</NavLink>
                <NavLink to="/signup" className="text-gray-300 hover:text-[#e2e600]" onClick={() => setOpen(false)}>Sign up</NavLink>
              </>
            ) : (
              <button 
                onClick={() => { handleLogout(); setOpen(false); }} 
                className="text-left text-red-400 hover:text-red-300 py-2"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}