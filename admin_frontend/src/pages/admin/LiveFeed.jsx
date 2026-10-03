/**
 * LiveFeed.jsx - Live Camera Feeds Page
 * ========================================
 * Displays live camera feeds from the SentraAI LPR service via WebSocket.
 *
 * Features:
 *   - Shows camera tiles with real-time video frames (base64 JPEG)
 *   - Start/Stop individual cameras or all cameras at once
 *   - Plate detection overlay when AI recognizes a license plate
 *   - Confirmation modal: operator can approve entry, exit, or ignore
 *   - Recent detections list at the bottom
 *   - LPR service status indicator
 *
 * Architecture:
 *   - useWebSocket hook maintains the WebSocket connection to SentraAI
 *   - Camera frames arrive as base64 images via WebSocket messages
 *   - Detections are logged to our backend via lprService.logDetection()
 *   - Entry/exit confirmations are sent back over WebSocket
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import Sidebar from "../../components/Sidebar";
import CameraTile from "../../components/CameraTile";
import PlateConfirmModal from "../../components/PlateConfirmModal";
import useWebSocket from "../../hooks/useWebSocket";
import lprService from "../../services/lprService";

// Confidence filter: when on, only detections above this are shown
const MIN_SHOW_CONFIDENCE = 0.55;

export default function LiveFeed() {
  const [confFilter, setConfFilter] = useState(
    () => localStorage.getItem("sentra.confFilter") !== "off"
  );
  // Ref so the WebSocket handler (bound once on connect) sees the current value
  const confFilterRef = useRef(confFilter);
  useEffect(() => {
    confFilterRef.current = confFilter;
    localStorage.setItem("sentra.confFilter", confFilter ? "on" : "off");
  }, [confFilter]);

  const [frames, setFrames] = useState({});
  const [detections, setDetections] = useState({});
  const [currentDetection, setCurrentDetection] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const [recentDetections, setRecentDetections] = useState([]);
  const [lprStatus, setLprStatus] = useState({ connected: false });

  // Frame update handler
  const handleFrame = useCallback((data) => {
    setFrames((prev) => ({
      ...prev,
      [data.camera_id]: data.frame,
    }));
  }, []);

  // Detection handler
  const handleDetection = useCallback((data) => {
    if (confFilterRef.current && !(data.confidence > MIN_SHOW_CONFIDENCE)) return;

    // Update camera detection
    setDetections((prev) => ({
      ...prev,
      [data.camera_id]: data,
    }));

    // Add to recent detections
    setRecentDetections((prev) => [data, ...prev.slice(0, 9)]);

    // Show confirmation modal
    setCurrentDetection(data);
    setActionResult(null);

    // Log detection to backend
    lprService.logDetection({
      camera_id: data.camera_id,
      plate_number: data.plate_text,
      confidence: data.confidence,
      action_taken: "pending",
      vehicle_class: data.vehicle_class,
    }).catch(console.error);
  }, []);

  // Entry result handler
  const handleEntryResult = useCallback((data) => {
    setActionResult(data);
  }, []);

  // Exit result handler
  const handleExitResult = useCallback((data) => {
    setActionResult(data);
  }, []);

  // WebSocket connection
  const {
    isConnected,
    cameras,
    mode,
    videos,
    startCamera,
    stopCamera,
    startAllCameras,
    confirmEntry,
    confirmExit,
  } = useWebSocket({
    autoConnect: true,
    onFrame: handleFrame,
    onDetection: handleDetection,
    onEntryResult: handleEntryResult,
    onExitResult: handleExitResult,
  });

  // Simulation mode: operator picks a video per camera; Start All is disabled
  const isSimulated = mode === "simulated";
  const canStartAll = isConnected && !isSimulated;

  // Check LPR status on mount
  useEffect(() => {
    lprService.checkLprHealth().then(setLprStatus);
    const interval = setInterval(() => {
      lprService.checkLprHealth().then(setLprStatus);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Clear detection after timeout
  useEffect(() => {
    if (detections) {
      const timeouts = Object.keys(detections).map((cameraId) => {
        return setTimeout(() => {
          setDetections((prev) => {
            const updated = { ...prev };
            delete updated[cameraId];
            return updated;
          });
        }, 5000);
      });
      return () => timeouts.forEach(clearTimeout);
    }
  }, [detections]);

  // Modal handlers
  const handleConfirmEntry = (plateNumber, cameraId) => {
    confirmEntry(plateNumber, cameraId);
  };

  const handleConfirmExit = (plateNumber, cameraId) => {
    confirmExit(plateNumber, cameraId);
  };

  const handleIgnore = () => {
    setCurrentDetection(null);
    setActionResult(null);
  };

  const handleCloseModal = () => {
    setCurrentDetection(null);
    setActionResult(null);
  };

  return (
    <div className="min-h-screen bg-sentraBlack text-white flex">
      <Sidebar facilityName="Downtown Parking" />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Live Camera Feeds</h1>
            <p className="text-gray-400 text-sm mt-1">
              {isSimulated
                ? "Simulation mode: pick a video on a camera, then Start"
                : "Real-time LPR monitoring"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* LPR Service Status */}
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  lprStatus.connected ? "bg-green-500 animate-pulse" : "bg-red-500"
                }`}
              ></span>
              <span className="text-sm text-gray-400">
                {lprStatus.connected ? "LPR Connected" : "LPR Disconnected"}
              </span>
            </div>

            {/* Confidence filter switch */}
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
              <button
                type="button"
                role="switch"
                aria-checked={confFilter}
                onClick={() => setConfFilter((v) => !v)}
                className={`relative w-10 h-5 rounded-full transition ${
                  confFilter ? "bg-green-600" : "bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    confFilter ? "translate-x-5" : ""
                  }`}
                ></span>
              </button>
              Only &gt;{Math.round(MIN_SHOW_CONFIDENCE * 100)}% confidence
            </label>

            {/* Start All Button */}
            <button
              onClick={startAllCameras}
              disabled={!canStartAll}
              title={isSimulated ? "Disabled in simulation mode: pick a video on each camera" : undefined}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                canStartAll
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
            >
              Start All Cameras
            </button>
          </div>
        </div>

        {/* Connection Warning - REMOVED FOR DEMO */}


        {/* Camera Grid */}
        <div className="bg-[#171717] border border-[#232323] rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Camera Feeds</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cameras.length > 0 ? (
              cameras.map((cam) => (
                <CameraTile
                  key={cam.id}
                  title={cam.name}
                  cameraId={cam.id}
                  cameraType={cam.type}
                  status={cam.status}
                  frameData={frames[cam.id]}
                  detection={detections[cam.id]}
                  onStart={startCamera}
                  onStop={stopCamera}
                  videos={isSimulated ? videos : null}
                />
              ))
            ) : (
              <>
                <CameraTile
                  title="Entry Gate 01"
                  cameraId="entry_cam_01"
                  cameraType="entry"
                  status="stopped"
                  onStart={startCamera}
                  onStop={stopCamera}
                />
                <CameraTile
                  title="Exit Gate 01"
                  cameraId="exit_cam_01"
                  cameraType="exit"
                  status="stopped"
                  onStart={startCamera}
                  onStop={stopCamera}
                />
              </>
            )}
          </div>
        </div>

        {/* Recent Detections Panel */}
        <div className="bg-[#171717] border border-[#232323] rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Detections</h2>
          {recentDetections.length > 0 ? (
            <div className="space-y-3">
              {recentDetections.map((det, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-[#1f1f1f] rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-sentraYellow px-3 py-1 rounded">
                      <span className="text-black font-bold">{det.plate_text}</span>
                    </div>
                    <span className="text-gray-400 text-sm">{det.camera_id}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        det.camera_type === "entry"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {det.camera_type?.toUpperCase()}
                    </span>
                    <span className="text-gray-500 text-sm">
                      {Math.round(det.confidence * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No detections yet. Start the cameras to begin monitoring.
            </p>
          )}
        </div>
      </main>

      {/* Confirmation Modal */}
      <PlateConfirmModal
        isOpen={!!currentDetection}
        onClose={handleCloseModal}
        detection={currentDetection}
        onConfirmEntry={handleConfirmEntry}
        onConfirmExit={handleConfirmExit}
        onIgnore={handleIgnore}
        result={actionResult}
      />
    </div>
  );
}
