/**
 * supabase.js - Supabase Client for OAuth
 * =========================================
 * Used exclusively for Google/Apple OAuth sign-in flows.
 * Email/password auth still goes through the Flask backend API.
 *
 * Environment Variables Required (in .env):
 *   VITE_SUPABASE_URL      - Your Supabase project URL
 *   VITE_SUPABASE_ANON_KEY - Your Supabase anon/public API key
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. " +
      "Google/Apple sign-in will not work."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
