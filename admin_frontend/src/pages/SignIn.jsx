/**
 * SignIn.jsx - User Login Page
 * =============================
 * Allows existing users to authenticate by email + password.
 *
 * Auth Flow:
 *   1. User enters email and password
 *   2. Sends POST /api/login to Flask backend
 *   3. On success: stores JWT tokens + user info in localStorage, redirects to /
 *   4. On failure: displays error message from the backend
 *
 * Stored in localStorage:
 *   - accessToken   (JWT for Authorization header)
 *   - refreshToken  (for future token renewal)
 *   - userEmail, userId, userRole
 *
 * Note: Google/Apple sign-in buttons are placeholder UI only (not wired up).
 */

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

import LogoMain from "../assets/logo_main.png";
import LogoNoText from "../assets/logo_notext.png";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  /** Handle the sign-in form submission */
  const handleLogin = async () => {
    setError(""); // Clear previous errors

    try {
      // Call the backend login endpoint
      const response = await axios.post("http://127.0.0.1:5000/api/login", {
        email: email,
        password: password,
      });

      if (response.status === 200) {
        // Store authentication data in localStorage for the api.js interceptor
        localStorage.setItem("accessToken", response.data.access_token);
        localStorage.setItem("refreshToken", response.data.refresh_token);
        localStorage.setItem("userEmail", response.data.user.email);
        localStorage.setItem("userId", response.data.user.id);
        localStorage.setItem("userDbId", response.data.user.db_id);
        localStorage.setItem("userRole", response.data.user.role);
        localStorage.setItem("userFullName", response.data.user.full_name || "");

        // Redirect to the home page (which shows facilities)
        navigate("/");
      }
    } catch (err) {
      console.error("Login Failed:", err);
      // Display backend error message or a generic fallback
      if (err.response && err.response.data) {
        setError(err.response.data.message);
      } else {
        setError("Login failed. Please check your connection.");
      }
    }
  };

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
                <Link
                  to="/signup"
                  className="px-4 py-1 rounded-full text-sm text-gray-400 hover:text-gray-200"
                >
                  SIGN UP
                </Link>
              </div>

              {/* Error Message Display Area */}
              {error && (
                <div className="w-full bg-red-500/10 border border-red-500 text-red-400 text-sm p-2 rounded text-center">
                  {error}
                </div>
              )}

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
                  className="w-full bg-[#2a2a2a] rounded-md px-4 py-3 placeholder-gray-400 text-gray-100 outline-none focus:ring-2 focus:ring-sentraYellow"
                />
              </div>

              <button
                onClick={handleLogin}
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
                <button className="text-sentraYellow">
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