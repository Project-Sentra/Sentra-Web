/**
 * useWebSocket.js - Real-time WebSocket Hook for SentraAI
 * =========================================================
 * Custom React hook that maintains a persistent WebSocket connection
 * to the SentraAI LPR service (port 5001). The AI service pushes
 * real-time events when plates are detected, camera frames update, etc.
 *
 * Features:
 *   - Auto-connects on mount (configurable)
 *   - Exponential backoff reconnection (up to 5 attempts)
 *   - Parses incoming JSON messages and dispatches to callbacks
 *   - Provides functions to control cameras and confirm entry/exit
 *
 * Message Types Received:
 *   cameras_list     - List of available cameras
 *   frame_update     - New video frame (base64 JPEG) for a camera
 *   plate_detected   - A license plate was recognized
 *   entry_result     - Result after confirming a vehicle entry
 *   exit_result      - Result after confirming a vehicle exit
 *   camera_status    - A single camera's status changed
 *   all_cameras_started - All cameras are now running
 *
 * Actions Sent:
 *   start_camera     - Start a specific camera feed
 *   stop_camera      - Stop a specific camera feed
 *   start_all        - Start all cameras
 *   confirm_entry    - Approve a detected plate for entry
 *   confirm_exit     - Approve a detected plate for exit
 *
 * @param {Object} options
 * @param {boolean} options.autoConnect  - Connect on mount (default: true)
 * @param {function} options.onFrame     - Called with each frame_update message
 * @param {function} options.onDetection - Called when a plate is detected
 * @param {function} options.onEntryResult - Called with entry confirmation result
 * @param {function} options.onExitResult  - Called with exit confirmation result
 *
 * @returns {Object} { isConnected, cameras, lastDetection, error,
 *                     connect, disconnect, startCamera, stopCamera,
 *                     startAllCameras, confirmEntry, confirmExit, sendMessage }
 */

import { useState, useEffect, useCallback, useRef } from "react";

// WebSocket URL - can be overridden via VITE_WS_URL environment variable
const WS_URL = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:5001/api/ws";
export default function useWebSocket({
  autoConnect = true,
  onFrame,
  onDetection,
  onEntryResult,
  onExitResult,
} = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [lastDetection, setLastDetection] = useState(null);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected to SentraAI");
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onclose = (event) => {
        console.log("WebSocket disconnected", event.code);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          setError("Failed to connect to LPR service after multiple attempts");
        }
      };

      ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        setError("WebSocket connection error");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      setError("Failed to create WebSocket connection");
    }
  }, []);

  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case "cameras_list":
        setCameras(data.cameras || []);
        break;

      case "frame_update":
        onFrame?.(data);
        break;

      case "plate_detected":
        setLastDetection(data);
        onDetection?.(data);
        break;

      case "entry_result":
        onEntryResult?.(data);
        break;

      case "exit_result":
        onExitResult?.(data);
        break;

      case "camera_status":
        setCameras((prev) =>
          prev.map((cam) =>
            cam.id === data.camera_id ? { ...cam, status: data.status } : cam
          )
        );
        break;

      case "all_cameras_started":
        setCameras((prev) =>
          prev.map((cam) => ({ ...cam, status: "running" }))
        );
        break;

      default:
        console.log("Unknown WebSocket message type:", data.type);
    }
  }, [onFrame, onDetection, onEntryResult, onExitResult]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Camera control actions
  const startCamera = useCallback((cameraId) => {
    return sendMessage({ action: "start_camera", camera_id: cameraId });
  }, [sendMessage]);

  const stopCamera = useCallback((cameraId) => {
    return sendMessage({ action: "stop_camera", camera_id: cameraId });
  }, [sendMessage]);

  const startAllCameras = useCallback(() => {
    return sendMessage({ action: "start_all" });
  }, [sendMessage]);

  // Entry/Exit confirmation actions
  const confirmEntry = useCallback((plateNumber, cameraId) => {
    return sendMessage({
      action: "confirm_entry",
      plate_number: plateNumber,
      camera_id: cameraId,
    });
  }, [sendMessage]);

  const confirmExit = useCallback((plateNumber, cameraId) => {
    return sendMessage({
      action: "confirm_exit",
      plate_number: plateNumber,
      camera_id: cameraId,
    });
  }, [sendMessage]);

  // Auto connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    cameras,
    lastDetection,
    error,
    connect,
    disconnect,
    startCamera,
    stopCamera,
    startAllCameras,
    confirmEntry,
    confirmExit,
    sendMessage,
  };
}
