import React from "react";

/**
 * Camera tile component with live frame display
 * @param {Object} props
 * @param {string} props.title - Camera name/title
 * @param {string} props.cameraId - Camera identifier
 * @param {string} props.cameraType - 'entry' or 'exit'
 * @param {string} props.status - 'stopped', 'running', 'error'
 * @param {string} props.frameData - Base64 encoded frame image
 * @param {Object} props.detection - Latest detection (optional)
 * @param {function} props.onStart - Start camera handler
 * @param {function} props.onStop - Stop camera handler
 */
export default function CameraTile({
  title = "Cam 01",
  cameraId,
  cameraType = "entry",
  status = "stopped",
  frameData,
  detection,
  onStart,
  onStop,
}) {
  const isRunning = status === "running";
  const hasError = status === "error";
  const isEntry = cameraType === "entry";

  return (
    <div className="relative rounded-xl bg-[#161616] border border-[#232323] h-64 flex flex-col overflow-hidden group">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-3 bg-linear-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2">
          <span className="bg-black/50 px-2 py-1 rounded text-xs text-white">
            {title}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
              isEntry
                ? "bg-green-500/20 text-green-400"
                : "bg-blue-500/20 text-blue-400"
            }`}
          >
            {isEntry ? "ENTRY" : "EXIT"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Status indicator */}
          <div
            className={`w-2 h-2 rounded-full ${
              isRunning
                ? "bg-green-500 animate-pulse"
                : hasError
                ? "bg-red-500"
                : "bg-gray-500"
            }`}
          ></div>
        </div>
      </div>

      {/* Video/Frame Display Area */}
      <div className="flex-1 flex items-center justify-center bg-black">
        {frameData ? (
          <img
            src={`data:image/jpeg;base64,${frameData}`}
            alt={`${title} feed`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-gray-600 group-hover:text-gray-500 transition flex flex-col items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            <span className="text-xs">
              {isRunning ? "Loading..." : "Camera Stopped"}
            </span>
          </div>
        )}
      </div>

      {/* Detection Overlay */}
      {detection && (
        <div className="absolute bottom-16 left-0 right-0 flex justify-center">
          <div className="bg-sentraYellow px-4 py-2 rounded-lg shadow-lg">
            <p className="text-black font-bold text-lg">{detection.plate_text}</p>
          </div>
        </div>
      )}

      {/* Controls Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-linear-to-t from-black/80 to-transparent">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">
            {isRunning ? "Live" : hasError ? "Error" : "Idle"}
          </span>
          <div className="flex gap-2">
            {!isRunning && !hasError && onStart && (
              <button
                onClick={() => onStart(cameraId)}
                className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition"
              >
                Start
              </button>
            )}
            {isRunning && onStop && (
              <button
                onClick={() => onStop(cameraId)}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
