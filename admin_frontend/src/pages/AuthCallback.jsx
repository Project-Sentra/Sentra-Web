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
import api, { clearSession } from "../services/api";

import LogoNoText from "../assets/logo_notext.png";

const ADMIN_ROLES = ["admin", "operator"];

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Completing sign in...");
  const [error, setError] = useState("");

  useEffect(() => {
    let finished = false; // stops the timeout from firing after a successful login
    let timeoutId;

    const fail = (message) => {
      finished = true;
      clearTimeout(timeoutId);
      clearSession();
      supabase.auth.signOut().catch(() => {});
      setError(message);
      setTimeout(() => navigate("/signin"), 3000);
    };

    const handleCallback = async () => {
      // Provider errors (cancelled consent, misconfigured provider) come back
      // as error/error_description in the query string or the hash
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const oauthError = query.get("error") || hash.get("error");
      if (oauthError) {
        fail(
          query.get("error_description") ||
            hash.get("error_description") ||
            "Google sign in was cancelled.",
        );
        return;
      }

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
          timeoutId = setTimeout(() => {
            subscription.unsubscribe();
            if (!finished) fail("Sign in timed out. Please try again.");
          }, 10000);

          return;
        }

        await completeLogin(session);
      } catch (err) {
        console.error("OAuth callback error:", err);
        fail(err.message || "Failed to complete sign in");
      }
    };

    const completeLogin = async (session) => {
      if (finished) return;
      setStatus("Setting up your account...");

      // The api.js interceptor reads the token from localStorage
      localStorage.setItem("accessToken", session.access_token);
      localStorage.setItem("refreshToken", session.refresh_token);

      let user;
      try {
        // Call backend to ensure user record exists in the database
        const response = await api.post("/auth/social-login");
        user = response.data.user;
      } catch (backendErr) {
        console.error("Backend sync error:", backendErr);
        // Never assume a role locally: without the backend we can't verify access
        fail(backendErr.response?.data?.message || "Could not reach the server. Please try again.");
        return;
      }

      if (!user || !ADMIN_ROLES.includes(user.role)) {
        fail(
          "This account does not have dashboard access. Ask an administrator to grant the admin or operator role.",
        );
        return;
      }

      finished = true;
      clearTimeout(timeoutId);
      localStorage.setItem("userEmail", user.email || "");
      localStorage.setItem("userId", user.id || "");
      localStorage.setItem("userDbId", String(user.db_id || ""));
      localStorage.setItem("userRole", user.role);
      localStorage.setItem("userFullName", user.full_name || "");
      navigate("/admin", { replace: true });
    };

    handleCallback();
    return () => clearTimeout(timeoutId);
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
