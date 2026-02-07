import React from "react";

/**
 * Modal for confirming vehicle entry/exit actions
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {function} props.onClose - Close handler
 * @param {Object} props.detection - Detection data
 * @param {function} props.onConfirmEntry - Entry confirmation handler
 * @param {function} props.onConfirmExit - Exit confirmation handler
 * @param {function} props.onIgnore - Ignore handler
 * @param {Object} props.result - Result of last action (optional)
 */
export default function PlateConfirmModal({
  isOpen,
  onClose,
  detection,
  onConfirmEntry,
  onConfirmExit,
  onIgnore,
  result,
}) {
  if (!isOpen || !detection) return null;

  const isEntryCamera = detection.camera_type === "entry";
  const confidencePercent = Math.round((detection.confidence || 0) * 100);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Plate Detected</h2>
            <p className="text-gray-400 text-sm mt-1">
              {isEntryCamera ? "Entry Gate" : "Exit Gate"} - {detection.camera_id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Plate Display */}
        <div className="bg-sentraYellow rounded-xl p-4 mb-6">
          <p className="text-black text-3xl font-bold text-center tracking-wider">
            {detection.plate_text}
          </p>
        </div>

        {/* Confidence */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-gray-400">Confidence</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-[#333] rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  confidencePercent >= 80
                    ? "bg-green-500"
                    : confidencePercent >= 60
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${confidencePercent}%` }}
              ></div>
            </div>
            <span className="text-white font-bold">{confidencePercent}%</span>
          </div>
        </div>

        {/* Vehicle Info */}
        {detection.vehicle_class && (
          <div className="flex items-center justify-between mb-6">
            <span className="text-gray-400">Vehicle Type</span>
            <span className="text-white capitalize">{detection.vehicle_class}</span>
          </div>
        )}

        {/* Result Message */}
        {result && (
          <div
            className={`p-4 rounded-xl mb-6 ${
              result.success
                ? "bg-green-500/20 border border-green-500 text-green-400"
                : "bg-red-500/20 border border-red-500 text-red-400"
            }`}
          >
            <p className="font-semibold">{result.message}</p>
            {result.spot_name && (
              <p className="text-sm mt-1">Spot: {result.spot_name}</p>
            )}
            {result.duration_minutes !== undefined && (
              <p className="text-sm mt-1">Duration: {result.duration_minutes} minutes</p>
            )}
            {result.amount_charged !== undefined && (
              <p className="text-sm mt-1">Amount: LKR {result.amount_charged}</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {!result && (
          <div className="space-y-3">
            {isEntryCamera ? (
              <button
                onClick={() => onConfirmEntry(detection.plate_text, detection.camera_id)}
                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition"
              >
                Confirm Entry
              </button>
            ) : (
              <button
                onClick={() => onConfirmExit(detection.plate_text, detection.camera_id)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition"
              >
                Confirm Exit
              </button>
            )}
            <button
              onClick={onIgnore}
              className="w-full py-3 bg-[#333] hover:bg-[#444] text-gray-300 font-medium rounded-xl transition"
            >
              Ignore
            </button>
          </div>
        )}

        {/* Close button after result */}
        {result && (
          <button
            onClick={onClose}
            className="w-full py-3 bg-[#333] hover:bg-[#444] text-white font-medium rounded-xl transition"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
