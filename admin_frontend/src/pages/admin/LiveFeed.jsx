import React, { useState, useCallback, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import CameraTile from "../../components/CameraTile";
import PlateConfirmModal from "../../components/PlateConfirmModal";
import useWebSocket from "../../hooks/useWebSocket";
import lprService from "../../services/lprService";

export default function LiveFeed() {
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
              Real-time LPR monitoring
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

            {/* Start All Button */}
            <button
              onClick={startAllCameras}
              disabled={!isConnected}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                isConnected
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
                    <div className="bg-[#e2e600] px-3 py-1 rounded">
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
