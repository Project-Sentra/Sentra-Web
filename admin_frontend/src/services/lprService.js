import axios from "axios";

const PARKING_API = "http://127.0.0.1:5000";
const LPR_API = "http://127.0.0.1:5001";

/**
 * LPR Service API Client
 * Handles communication with both Parking Backend and SentraAI service
 */
const lprService = {
  // ==========================================
  // SentraAI Service APIs
  // ==========================================

  /**
   * Check SentraAI service health
   */
  async checkLprHealth() {
    try {
      const response = await axios.get(`${LPR_API}/api/health`, { timeout: 5000 });
      return {
        connected: true,
        ...response.data,
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
      };
    }
  },

  /**
   * Get camera list from SentraAI
   */
  async getLprCameras() {
    try {
      const response = await axios.get(`${LPR_API}/api/cameras`);
      return response.data;
    } catch (error) {
      console.error("Failed to fetch LPR cameras:", error);
      return [];
    }
  },

  /**
   * Start a camera stream
   */
  async startCamera(cameraId) {
    try {
      const response = await axios.post(`${LPR_API}/api/cameras/${cameraId}/start`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || "Failed to start camera");
    }
  },

  /**
   * Stop a camera stream
   */
  async stopCamera(cameraId) {
    try {
      const response = await axios.post(`${LPR_API}/api/cameras/${cameraId}/stop`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || "Failed to stop camera");
    }
  },

  /**
   * Start all cameras
   */
  async startAllCameras() {
    try {
      const response = await axios.post(`${LPR_API}/api/cameras/start-all`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || "Failed to start cameras");
    }
  },

  /**
   * Detect plate from uploaded image
   */
  async detectFromImage(file, returnImage = false) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("return_image", returnImage);

    try {
      const response = await axios.post(`${LPR_API}/api/detect/image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || "Detection failed");
    }
  },

  // ==========================================
  // Parking Backend APIs
  // ==========================================

  /**
   * Check parking backend LPR status
   */
  async checkBackendLprStatus() {
    try {
      const response = await axios.get(`${PARKING_API}/api/lpr/status`);
      return response.data;
    } catch (error) {
      return {
        connected: false,
        error: error.message,
      };
    }
  },

  /**
   * Get cameras from backend database
   */
  async getBackendCameras() {
    try {
      const response = await axios.get(`${PARKING_API}/api/cameras`);
      return response.data.cameras || [];
    } catch (error) {
      console.error("Failed to fetch backend cameras:", error);
      return [];
    }
  },

  /**
   * Initialize default cameras
   */
  async initCameras() {
    try {
      const response = await axios.post(`${PARKING_API}/api/cameras/init`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || "Failed to initialize cameras");
    }
  },

  /**
   * Get recent detection logs
   */
  async getDetectionLogs(limit = 50) {
    try {
      const response = await axios.get(`${PARKING_API}/api/detection-logs`, {
        params: { limit },
      });
      return response.data.logs || [];
    } catch (error) {
      console.error("Failed to fetch detection logs:", error);
      return [];
    }
  },

  /**
   * Log a new detection
   */
  async logDetection(detection) {
    try {
      const response = await axios.post(`${PARKING_API}/api/detection-logs`, detection);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || "Failed to log detection");
    }
  },

  /**
   * Update detection action
   */
  async updateDetectionAction(logId, action) {
    try {
      const response = await axios.patch(
        `${PARKING_API}/api/detection-logs/${logId}/action`,
        { action }
      );
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || "Failed to update action");
    }
  },

  /**
   * Register vehicle entry via LPR
   */
  async confirmEntry(plateNumber, cameraId) {
    try {
      const response = await axios.post(`${LPR_API}/api/entry`, {
        plate_number: plateNumber,
        camera_id: cameraId,
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || "Entry failed");
    }
  },

  /**
   * Register vehicle exit via LPR
   */
  async confirmExit(plateNumber, cameraId) {
    try {
      const response = await axios.post(`${LPR_API}/api/exit`, {
        plate_number: plateNumber,
        camera_id: cameraId,
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || "Exit failed");
    }
  },
};

export default lprService;
