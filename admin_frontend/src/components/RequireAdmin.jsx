/**
 * RequireAdmin.jsx - Route guard for the admin dashboard
 * =======================================================
 * Wraps admin routes. If there is no stored login, or the stored role is
 * not admin/operator, the user is redirected to /signin and returned to
 * the requested page after logging in.
 *
 * This is a UX guard only: the backend independently enforces admin
 * access on every protected endpoint.
 */

import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAccessToken, isAdminSession } from "../services/api";

export default function RequireAdmin() {
  const location = useLocation();

  if (!isAdminSession()) {
    const reason = getAccessToken() ? "?denied=1" : "";
    return (
      <Navigate
        to={`/signin${reason}`}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <Outlet />;
}
