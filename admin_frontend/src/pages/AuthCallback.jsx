/**
 * AuthCallback.jsx - OAuth Redirect Handler
 * ============================================
 * Handles the redirect back from Google/Apple OAuth.
 *
 * Flow:
 *   1. Google/Apple redirects to /auth/callback with tokens in the URL hash
 *   2. Supabase JS client automatically parses the hash and sets the session
 *   3. We extract the access/refresh tokens from the Supabase session
 *   4. Call the backend /api/auth/social-login to ensure a user record exists
 *   5. Store auth data in localStorage (same format as email/password login)
 *   6. Redirect to the admin dashboard
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import api from "../services/api";

import LogoNoText from "../assets/logo_notext.png";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Completing sign in...");
  const [error, setError] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase JS automatically picks up the tokens from the URL hash
        const {
          data: { session },
          error: authError,
        } = await supabase.auth.getSession();

        if (authError) {
          throw new Error(authError.message);
        }

        if (!session) {
          // Session may not be available yet; listen for auth state change
          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === "SIGNED_IN" && session) {
              subscription.unsubscribe();
              await completeLogin(session);
            }
          });

          // Timeout after 10 seconds
          setTimeout(() => {
            subscription.unsubscribe();
            setError("Sign in timed out. Please try again.");
            setTimeout(() => navigate("/signin"), 3000);
          }, 10000);

          return;
        }

        await completeLogin(session);
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(err.message || "Failed to complete sign in");
        setTimeout(() => navigate("/signin"), 3000);
      }
    };

    const completeLogin = async (session) => {
      setStatus("Setting up your account...");

      // Store tokens in localStorage
      localStorage.setItem("accessToken", session.access_token);
      localStorage.setItem("refreshToken", session.refresh_token);

      try {
        // Call backend to ensure user record exists in the database
        const response = await api.post("/auth/social-login");

        if (response.data.user) {
          localStorage.setItem("userEmail", response.data.user.email || "");
          localStorage.setItem("userId", response.data.user.id || "");
          localStorage.setItem("userDbId", String(response.data.user.db_id || ""));
          localStorage.setItem("userRole", response.data.user.role || "user");
          localStorage.setItem("userFullName", response.data.user.full_name || "");
        }

        navigate("/");
      } catch (backendErr) {
        console.error("Backend sync error:", backendErr);
        // Even if backend sync fails, the user is authenticated with Supabase
        // Store basic info from the session
        localStorage.setItem("userEmail", session.user?.email || "");
        localStorage.setItem("userId", session.user?.id || "");
        localStorage.setItem("userRole", "admin");
        localStorage.setItem(
          "userFullName",
          session.user?.user_metadata?.full_name ||
            session.user?.user_metadata?.name ||
            ""
        );
        navigate("/");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-sentraBlack flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-6">
        <img src={LogoNoText} alt="Sentra" className="w-16 h-16 animate-pulse" />
        {error ? (
          <div className="text-center">
            <p className="text-red-400 text-lg">{error}</p>
            <p className="text-gray-500 text-sm mt-2">Redirecting to sign in...</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-200 text-lg">{status}</p>
            <div className="mt-4 w-8 h-8 border-2 border-sentraYellow border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
}
