/**
 * lprService.js - Unified API Service Client (v2.0)
 * ===================================================
 * Provides methods to communicate with TWO separate backends:
 *
 * 1. PARKING_API (port 5000) - Our Flask backend
 *    Manages facilities, spots, sessions, vehicles, reservations,
 *    cameras (DB), detection logs, users, payments, subscriptions.
 *    Uses the authenticated `api` instance for protected endpoints.
 *
 * 2. LPR_API (port 5001) - External SentraAI service
 *    Runs the AI model for real-time plate detection from camera feeds.
 *    Uses raw `axios` because it has no JWT auth (separate service).
 *
 * Endpoint Groups:
 *   - SentraAI (port 5001): health, cameras, detection
 *   - Auth: login, signup, profile
 *   - Facilities: CRUD, spots
 *   - Sessions: entry, exit, history
 *   - Vehicles: CRUD, lookup
 *   - Reservations: CRUD
 *   - Users (admin): list, manage
 *   - Dashboard: stats, recent activity
 *   - Cameras & Gates: CRUD, gate control
 *   - Detections: logs, actions
 *   - Wallet & Payments
 *   - Subscriptions
 *   - Notifications
 *   - System: reset, LPR status
 */

import axios from "axios";
import api from "./api";

// Flask backend (this project)
const PARKING_API = "http://127.0.0.1:5000";

// External SentraAI LPR service (separate repo/process)
const LPR_API = "http://127.0.0.1:5001";

const lprService = {
  // ==========================================
  // SentraAI Service APIs (port 5001)
  // These call the external AI service directly
  // ==========================================

  /** Check if the SentraAI service is running and healthy. */
  async checkLprHealth() {
    try {
      const response = await axios.get(`${LPR_API}/api/health`, { timeout: 5000 });
      return { connected: true, ...response.data };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  },

  /** Get cameras configured in the SentraAI service. */
  async getLprCameras() {
    try {
      const response = await axios.get(`${LPR_API}/api/cameras`);
      return response.data;
    } catch (error) {
      console.error("Failed to fetch LPR cameras:", error);
      return [];
    }
  },

  /** Start / stop individual or all cameras on the AI service. */
  async startCamera(cameraId) {
    const r = await axios.post(`${LPR_API}/api/cameras/${cameraId}/start`);
    return r.data;
  },
  async stopCamera(cameraId) {
    const r = await axios.post(`${LPR_API}/api/cameras/${cameraId}/stop`);
    return r.data;
  },
  async startAllCameras() {
    const r = await axios.post(`${LPR_API}/api/cameras/start-all`);
    return r.data;
  },

  /** Upload an image for one-shot plate detection (testing). */
  async detectFromImage(file, returnImage = false) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("return_image", returnImage);
    const r = await axios.post(`${LPR_API}/api/detect/image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data;
  },

  /** Confirm entry/exit via the AI service. */
  async confirmEntry(plateNumber, cameraId) {
    const r = await axios.post(`${LPR_API}/api/entry`, { plate_number: plateNumber, camera_id: cameraId });
    return r.data;
  },
  async confirmExit(plateNumber, cameraId) {
    const r = await axios.post(`${LPR_API}/api/exit`, { plate_number: plateNumber, camera_id: cameraId });
    return r.data;
  },

  // ==========================================
  // Auth (port 5000)
  // ==========================================

  /** Check LPR connection via backend proxy. */
  async checkBackendLprStatus() {
    try {
      const r = await api.get("/lpr/status");
      return r.data;
    } catch (error) {
      return { connected: false, error: error.message };
    }
  },

  /** Get current user's profile. */
  async getProfile() {
    const r = await api.get("/auth/me");
    return r.data.user;
  },

  /** Update current user's profile. */
  async updateProfile(data) {
    const r = await api.put("/auth/me", data);
    return r.data;
  },

  // ==========================================
  // Facilities
  // ==========================================

  /** Get all active facilities with live occupancy. */
  async getFacilities() {
    const r = await api.get("/facilities");
    return r.data.facilities || [];
  },

  /** Get single facility details with floors and summary. */
  async getFacility(facilityId) {
    const r = await api.get(`/facilities/${facilityId}`);
    return r.data;
  },

  /** Create a new facility. */
  async createFacility(data) {
    const r = await api.post("/facilities", data);
    return r.data;
  },

  /** Update a facility. */
  async updateFacility(facilityId, data) {
    const r = await api.put(`/facilities/${facilityId}`, data);
    return r.data;
  },

  /** Delete a facility. */
  async deleteFacility(facilityId) {
    const r = await api.delete(`/facilities/${facilityId}`);
    return r.data;
  },

  // ==========================================
  // Parking Spots
  // ==========================================

  /** Get all spots for a facility. */
  async getSpots(facilityId) {
    const r = await api.get(`/facilities/${facilityId}/spots`);
    return r.data.spots || [];
  },

  /** Initialize spots for a facility. */
  async initSpots(facilityId, count = 32, prefix = "A") {
    const r = await api.post(`/facilities/${facilityId}/spots/init`, { count, prefix });
    return r.data;
  },

  /** Legacy /api/spots endpoint (backward compat). */
  async getSpotsLegacy() {
    const r = await api.get("/spots");
    return r.data.spots || [];
  },

  // ==========================================
  // Parking Sessions (Entry / Exit)
  // ==========================================

  /** Register vehicle entry. */
  async vehicleEntry(plateNumber, facilityId, entryMethod = "lpr") {
    const r = await api.post("/sessions/entry", {
      plate_number: plateNumber,
      facility_id: facilityId,
      entry_method: entryMethod,
    });
    return r.data;
  },

  /** Register vehicle exit. */
  async vehicleExit(plateNumber, paymentMethod = "wallet") {
    const r = await api.post("/sessions/exit", {
      plate_number: plateNumber,
      payment_method: paymentMethod,
    });
    return r.data;
  },

  /** Get sessions (active or history). */
  async getSessions({ facilityId, active, all, limit } = {}) {
    const params = {};
    if (facilityId) params.facility_id = facilityId;
    if (active) params.active = "true";
    if (all) params.all = "true";
    if (limit) params.limit = limit;
    const r = await api.get("/sessions", { params });
    return r.data.sessions || [];
  },

  /** Legacy /api/logs endpoint (backward compat). */
  async getLogs() {
    const r = await api.get("/logs");
    return r.data.logs || [];
  },

  // ==========================================
  // Vehicles
  // ==========================================

  /** Register a new vehicle. */
  async registerVehicle(data) {
    const r = await api.post("/vehicles", data);
    return r.data;
  },

  /** Get vehicles (user's own or all for admin). */
  async getVehicles(all = false) {
    const params = all ? { all: "true" } : {};
    const r = await api.get("/vehicles", { params });
    return r.data.vehicles || [];
  },

  /** Update a vehicle. */
  async updateVehicle(vehicleId, data) {
    const r = await api.put(`/vehicles/${vehicleId}`, data);
    return r.data;
  },

  /** Deactivate a vehicle. */
  async deactivateVehicle(vehicleId) {
    const r = await api.delete(`/vehicles/${vehicleId}`);
    return r.data;
  },

  /** Look up a vehicle by plate number (public). */
  async lookupVehicle(plateNumber) {
    const r = await axios.get(`${PARKING_API}/api/vehicles/lookup/${plateNumber}`);
    return r.data;
  },

  // ==========================================
  // Reservations
  // ==========================================

  /** Create a new reservation. */
  async createReservation(data) {
    const r = await api.post("/reservations", data);
    return r.data;
  },

  /** Get reservations (user's or all for admin). */
  async getReservations({ all, status } = {}) {
    const params = {};
    if (all) params.all = "true";
    if (status) params.status = status;
    const r = await api.get("/reservations", { params });
    return r.data.reservations || [];
  },

  /** Cancel or update a reservation. */
  async updateReservation(reservationId, data) {
    const r = await api.put(`/reservations/${reservationId}`, data);
    return r.data;
  },

  // ==========================================
  // Users (Admin)
  // ==========================================

  /** List all users (admin only). */
  async getUsers(role) {
    const params = role ? { role } : {};
    const r = await api.get("/admin/users", { params });
    return r.data.users || [];
  },

  /** Get single user details with vehicles. */
  async getUser(userId) {
    const r = await api.get(`/admin/users/${userId}`);
    return r.data;
  },

  /** Update user role or active status. */
  async updateUser(userId, data) {
    const r = await api.put(`/admin/users/${userId}`, data);
    return r.data;
  },

  // ==========================================
  // Dashboard / Analytics (Admin)
  // ==========================================

  /** Get dashboard stats for a facility. */
  async getDashboardStats(facilityId) {
    const r = await api.get("/dashboard/stats", { params: { facility_id: facilityId } });
    return r.data;
  },

  /** Get recent activity (sessions, detections). */
  async getRecentActivity(facilityId, limit = 20) {
    const params = { limit };
    if (facilityId) params.facility_id = facilityId;
    const r = await api.get("/dashboard/recent-activity", { params });
    return r.data;
  },

  // ==========================================
  // Cameras (Admin - DB records)
  // ==========================================

  /** Get cameras from our database. */
  async getBackendCameras(facilityId) {
    const params = facilityId ? { facility_id: facilityId } : {};
    const r = await api.get("/cameras", { params });
    return r.data.cameras || [];
  },

  /** Add a camera to our database. */
  async addCamera(data) {
    const r = await api.post("/cameras", data);
    return r.data;
  },

  /** Delete a camera from our database. */
  async deleteCamera(cameraId) {
    const r = await api.delete(`/cameras/${cameraId}`);
    return r.data;
  },

  // ==========================================
  // Gates (Admin)
  // ==========================================

  /** Get all gates. */
  async getGates(facilityId) {
    const params = facilityId ? { facility_id: facilityId } : {};
    const r = await api.get("/gates", { params });
    return r.data.gates || [];
  },

  /** Add a gate. */
  async addGate(data) {
    const r = await api.post("/gates", data);
    return r.data;
  },

  /** Open / close a gate. */
  async openGate(gateId, plateNumber) {
    const r = await api.post(`/gates/${gateId}/open`, { plate_number: plateNumber });
    return r.data;
  },
  async closeGate(gateId) {
    const r = await api.post(`/gates/${gateId}/close`);
    return r.data;
  },

  // ==========================================
  // Detection Logs
  // ==========================================

  /** Get detection logs. */
  async getDetectionLogs(limit = 50, facilityId) {
    const params = { limit };
    if (facilityId) params.facility_id = facilityId;
    const r = await api.get("/detections", { params });
    return r.data.detections || [];
  },

  /** Log a new detection event. */
  async logDetection(detection) {
    const r = await api.post("/detections", detection);
    return r.data;
  },

  /** Update detection action (entry/exit/ignored). */
  async updateDetectionAction(logId, action) {
    const r = await api.patch(`/detections/${logId}/action`, { action });
    return r.data;
  },

  // ==========================================
  // Wallet & Payments
  // ==========================================

  /** Get user's wallet balance. */
  async getWallet() {
    const r = await api.get("/wallet");
    return r.data;
  },

  /** Top up wallet. */
  async topupWallet(amount, paymentMethod = "card") {
    const r = await api.post("/wallet/topup", { amount, payment_method: paymentMethod });
    return r.data;
  },

  /** Get payment history. */
  async getPayments(all = false) {
    const params = all ? { all: "true" } : {};
    const r = await api.get("/payments", { params });
    return r.data.payments || [];
  },

  // ==========================================
  // Subscriptions
  // ==========================================

  /** Create a subscription. */
  async createSubscription(data) {
    const r = await api.post("/subscriptions", data);
    return r.data;
  },

  /** Get subscriptions. */
  async getSubscriptions(all = false) {
    const params = all ? { all: "true" } : {};
    const r = await api.get("/subscriptions", { params });
    return r.data.subscriptions || [];
  },

  /** Update/cancel subscription. */
  async updateSubscription(subId, data) {
    const r = await api.put(`/subscriptions/${subId}`, data);
    return r.data;
  },

  // ==========================================
  // Notifications
  // ==========================================

  /** Get user's notifications. */
  async getNotifications(limit = 50) {
    const r = await api.get("/notifications", { params: { limit } });
    return r.data.notifications || [];
  },

  /** Mark one notification as read. */
  async markNotificationRead(notifId) {
    const r = await api.put(`/notifications/${notifId}/read`);
    return r.data;
  },

  /** Mark all notifications as read. */
  async markAllNotificationsRead() {
    const r = await api.put("/notifications/read-all");
    return r.data;
  },

  // ==========================================
  // System
  // ==========================================

  /** Reset system (clear sessions, free spots). */
  async resetSystem(facilityId) {
    const data = facilityId ? { facility_id: facilityId } : {};
    const r = await api.post("/system/reset", data);
    return r.data;
  },
};

export default lprService;
