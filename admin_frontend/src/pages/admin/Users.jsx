/**
 * Users.jsx - User Management Page (Admin)
 * ==========================================
 * Displays all registered users (both admin and mobile app users)
 * with filtering by role and the ability to change user roles.
 *
 * Data Source: GET /api/admin/users
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import lprService from "../../services/lprService";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const navigate = useNavigate();

  // Check auth
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) navigate("/signin");
  }, [navigate]);

  // Fetch users
  useEffect(() => {
    async function fetchUsers() {
      try {
        const data = await lprService.getUsers(roleFilter || undefined);
        setUsers(data);
      } catch (err) {
        console.error("Failed to fetch users:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, [roleFilter]);

  /** Toggle user role between admin and user */
  async function handleRoleChange(userId, newRole) {
    try {
      await lprService.updateUser(userId, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      alert("Failed to update role: " + err.message);
    }
  }

  /** Toggle user active status */
  async function handleToggleActive(userId, isActive) {
    try {
      await lprService.updateUser(userId, { is_active: !isActive });
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !isActive } : u));
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  }

  return (
    <div className="flex h-screen bg-sentraBlack text-white overflow-hidden">
      <Sidebar facilityName="User Management" />

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold">Users</h1>
            <p className="text-gray-400 text-sm mt-1">
              {users.length} registered users
            </p>
          </div>

          {/* Role filter */}
          <div className="flex gap-2">
            {["", "admin", "user", "operator"].map((role) => (
              <button
                key={role}
                onClick={() => { setRoleFilter(role); setLoading(true); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  roleFilter === role
                    ? "bg-sentraYellow text-black"
                    : "bg-[#222] text-gray-400 hover:text-white"
                }`}
              >
                {role === "" ? "All" : role.charAt(0).toUpperCase() + role.slice(1)}
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <p className="text-gray-500 animate-pulse">Loading users...</p>
        ) : (
          <div className="bg-[#171717] rounded-2xl border border-[#232323] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#1a1a1a] text-gray-400 text-left">
                <tr>
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => (
                  <tr key={user.id} className="border-t border-[#232323] hover:bg-[#1e1e1e]">
                    <td className="px-6 py-4 text-gray-500">{i + 1}</td>
                    <td className="px-6 py-4 font-medium">{user.full_name || "—"}</td>
                    <td className="px-6 py-4 text-gray-300">{user.email}</td>
                    <td className="px-6 py-4 text-gray-400">{user.phone || "—"}</td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="bg-transparent border border-[#333] rounded px-2 py-1 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-sentraYellow"
                      >
                        <option value="user" className="bg-[#222]">User</option>
                        <option value="admin" className="bg-[#222]">Admin</option>
                        <option value="operator" className="bg-[#222]">Operator</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${user.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        className={`text-xs px-2 py-1 rounded ${
                          user.is_active
                            ? "text-red-400 hover:bg-red-500/10"
                            : "text-green-400 hover:bg-green-500/10"
                        }`}
                      >
                        {user.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && (
              <p className="text-gray-500 text-center py-12">No users found.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
