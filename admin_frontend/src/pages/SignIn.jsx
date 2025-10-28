import React, { useState } from "react";
import LogoMain from "../assets/logo_main.png";
import LogoNoText from "../assets/logo_notext.png";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen bg-sentraBlack flex items-center justify-center px-6">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left: Big brand panel */}
        <div className="hidden md:flex flex-col items-start justify-center space-y-6 pl-8">
          <img src={LogoMain} alt="Sentra" className="w-80 h-auto" />
          <p className="text-gray-400 text-2xl ml-25">Park it smart</p>
        </div>

        {/* Right: Auth card */}
        <div className="flex items-center justify-center">
          <div className="w-full max-w-md bg-[#171717] rounded-2xl p-8 shadow-lg">
            <div className="flex flex-col items-center gap-4">
              <img src={LogoNoText} alt="logo" className="w-14 h-14" />

              <div className="bg-[#222] rounded-full px-1 py-1 inline-flex items-center">
                <button className="px-4 py-1 rounded-full text-sm text-gray-200 bg-[#333]">
                  SIGN IN
                </button>
                <button className="px-4 py-1 rounded-full text-sm text-gray-400">
                  SIGN UP
                </button>
              </div>

              <div className="w-full mt-3">
                <label className="sr-only">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="email"
                  className="w-full bg-[#2a2a2a] rounded-md px-4 py-3 placeholder-gray-400 text-gray-100 outline-none focus:ring-2 focus:ring-sentraYellow"
                />
              </div>

              <div className="w-full mt-2">
                <label className="sr-only">Password</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="password"
                  className="w-full bg-[#2a2a2a] rounded-md px-4 py-3 placeholder-gray-400 text-gray-100 outline-none focus:ring-2 focus:ring-[var(--color-sentraYellow)]"
                />
              </div>

              <button
                className="w-full mt-4 bg-sentraYellow text-black font-semibold rounded-md py-3 hover:brightness-95 transition"
                aria-label="Sign in"
              >
                SIGN IN
              </button>

              <div className="w-full flex items-center gap-3 mt-4">
                <div className="flex-1 h-px bg-[#333]" />
                <div className="text-sm text-gray-400">or</div>
                <div className="flex-1 h-px bg-[#333]" />
              </div>

              <div className="w-full mt-4 space-y-3">
                <button className="w-full bg-[#2b2b2b] rounded-md py-3 text-gray-100 flex items-center justify-center gap-3">
                  <span className="bg-white text-black rounded-full w-6 h-6 flex items-center justify-center font-bold">
                    G
                  </span>
                  <span className="text-sm">SIGN IN WITH GOOGLE</span>
                </button>

                <button className="w-full bg-[#2b2b2b] rounded-md py-3 text-gray-100 flex items-center justify-center gap-3">
                  <span className="bg-black text-white rounded-full w-6 h-6 flex items-center justify-center">
                    
                  </span>
                  <span className="text-sm">SIGN IN WITH APPLE</span>
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                Forgot your password?{" "}
                <button className="text-[var(--color-sentraYellow)]">
                  Reset
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
