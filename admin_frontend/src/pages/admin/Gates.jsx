/**
 * Gates.jsx - Barrier control (FR-12)
 * ====================================
 * Operators can:
 *   - see every entry/exit gate of the facility with an animated barrier
 *   - open (optionally for a plate) or close a gate manually
 *   - add a gate
 *   - follow the gate event log: manual actions and automatic LPR openings
 *
 * The barrier briefly lifts and glows when the AI opened it in the last few
 * seconds, so a vehicle passing in the live feed is visible here too.
 * Data is polled every 3 seconds.
 */

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import GateBarrier from "../../components/GateBarrier";
import lprService from "../../services/lprService";

const RECENT_LPR_MS = 6000;

const GATE_TYPE_LABEL = { entry: "Entry", exit: "Exit", bidirectional: "Entry & Exit" };

const TRIGGER_STYLE = {
  auto_lpr: { label: "AI · LPR", className: "bg-sentraYellow/15 text-sentraYellow" },
  manual: { label: "Manual", className: "bg-blue-500/15 text-blue-300" },
  reservation: { label: "Reservation", className: "bg-purple-500/15 text-purple-300" },
  subscription: { label: "Subscription", className: "bg-emerald-500/15 text-emerald-300" },
};

const formatTime = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        day: "numeric",
        month: "short",
      })
    : "—";

const errorMessage = (err, fallback) => err.response?.data?.message || fallback;

function GateCard({ gate, lastLprEvent, busy, onOpen, onClose }) {
  const [plate, setPlate] = useState("");
  const recentLpr =
    lastLprEvent && Date.now() - new Date(lastLprEvent.created_at).getTime() < RECENT_LPR_MS;
  const isOpen = gate.status === "open" || recentLpr;

  return (
    <div
      className={
        "bg-[#171717] border rounded-2xl p-5 transition-colors duration-500 " +
        (recentLpr ? "border-sentraYellow/70" : "border-[#232323]")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{gate.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{GATE_TYPE_LABEL[gate.gate_type] || gate.gate_type}</p>
        </div>
        <span
          className={
            "text-xs font-semibold px-2.5 py-1 rounded-full " +
            (isOpen ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")
          }
        >
          {recentLpr ? "OPENED BY AI" : isOpen ? "OPEN" : "CLOSED"}
        </span>
      </div>

      <div className="my-3">
        <GateBarrier open={isOpen} highlight={recentLpr} />
      </div>

      {recentLpr && (
        <p className="text-sm text-sentraYellow mb-3">
          Vehicle <span className="font-mono font-semibold">{lastLprEvent.plate_number}</span> recognised
        </p>
      )}

      <input
        value={plate}
        onChange={(e) => setPlate(e.target.value.toUpperCase())}
        placeholder="Plate number (optional)"
        aria-label={`Plate number for ${gate.name}`}
        className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm font-mono text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-sentraYellow/60"
      />

      <div className="grid grid-cols-2 gap-3 mt-3">
        <button
          onClick={() => onOpen(gate, plate).then((ok) => ok && setPlate(""))}
          disabled={busy || gate.status === "open"}
          className="py-2.5 rounded-lg font-semibold text-sm bg-green-500 text-black hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Open
        </button>
        <button
          onClick={() => onClose(gate)}
          disabled={busy || gate.status !== "open"}
          className="py-2.5 rounded-lg font-semibold text-sm bg-[#262626] text-gray-200 hover:bg-red-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function AddGateForm({ facilityId, onAdded }) {
  const [name, setName] = useState("");
  const [gateType, setGateType] = useState("entry");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await lprService.addGate({ name: name.trim(), gate_type: gateType, facility_id: facilityId });
      setName("");
      onAdded();
    } catch (err) {
      setError(errorMessage(err, "Could not add the gate"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#171717] border border-dashed border-[#2f2f2f] rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Add a gate</h3>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Main Entry Gate"
        aria-label="Gate name"
        className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-sentraYellow/60"
      />
      <select
        value={gateType}
        onChange={(e) => setGateType(e.target.value)}
        aria-label="Gate type"
        className="w-full mt-3 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-sentraYellow/60"
      >
        <option value="entry">Entry</option>
        <option value="exit">Exit</option>
        <option value="bidirectional">Entry & Exit</option>
      </select>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full mt-3 py-2.5 rounded-lg font-semibold text-sm bg-sentraYellow text-black hover:brightness-110 disabled:opacity-40 transition"
      >
        {saving ? "Adding…" : "Add gate"}
      </button>
    </form>
  );
}

export default function Gates() {
  const { facilityId } = useParams();
  const fid = parseInt(facilityId) || 1;

  const [facilityName, setFacilityName] = useState("Parking Facility");
  const [gates, setGates] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyGate, setBusyGate] = useState(null);
  const [error, setError] = useState("");
  const [, setTick] = useState(0); // re-render so "recent LPR" highlights expire

  const refresh = useCallback(async () => {
    try {
      const [g, ev] = await Promise.all([
        lprService.getGates(fid),
        lprService.getGateEvents({ facilityId: fid, limit: 30 }),
      ]);
      setGates(g);
      setEvents(ev);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Cannot reach the backend."));
    } finally {
      setLoading(false);
    }
  }, [fid]);

  useEffect(() => {
    lprService
      .getFacility(fid)
      .then((data) => data.facility && setFacilityName(data.facility.name))
      .catch(() => {});
  }, [fid]);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 3000);
    const tick = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [refresh]);

  async function runGateAction(gate, action) {
    setBusyGate(gate.id);
    try {
      await action();
      await refresh();
      return true;
    } catch (err) {
      setError(errorMessage(err, `Could not control ${gate.name}`));
      return false;
    } finally {
      setBusyGate(null);
    }
  }

  const handleOpen = (gate, plate) =>
    runGateAction(gate, () => lprService.openGate(gate.id, plate || undefined));
  const handleClose = (gate) => runGateAction(gate, () => lprService.closeGate(gate.id));

  const lastLprByGate = {};
  for (const ev of events) {
    if (ev.triggered_by === "auto_lpr" && !lastLprByGate[ev.gate_id]) lastLprByGate[ev.gate_id] = ev;
  }

  return (
    <div className="min-h-screen bg-sentraBlack text-white flex">
      <Sidebar facilityName={facilityName} />

      <main className="flex-1 p-8 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Gates</h1>
            <p className="text-gray-500 text-sm mt-1">
              Open or close barriers manually. AI openings appear here automatically.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/60 text-red-400 p-4 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {loading
            ? [0, 1].map((i) => (
                <div key={i} className="h-72 rounded-2xl bg-[#171717] border border-[#232323] animate-pulse" />
              ))
            : gates.map((gate) => (
                <GateCard
                  key={gate.id}
                  gate={gate}
                  lastLprEvent={lastLprByGate[gate.id]}
                  busy={busyGate === gate.id}
                  onOpen={handleOpen}
                  onClose={handleClose}
                />
              ))}
          {!loading && <AddGateForm facilityId={fid} onAdded={refresh} />}
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-4">Gate activity</h2>
          <div className="bg-[#171717] border border-[#232323] rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-sentraYellow">
                <tr className="text-left">
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Gate</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Plate</th>
                  <th className="px-6 py-3">Triggered by</th>
                </tr>
              </thead>
              <tbody>
                {events.length ? (
                  events.map((ev) => {
                    const trigger = TRIGGER_STYLE[ev.triggered_by] || {
                      label: ev.triggered_by,
                      className: "bg-gray-500/15 text-gray-300",
                    };
                    const operator = ev.users?.full_name || ev.users?.email;
                    return (
                      <tr key={ev.id} className="odd:bg-[#151515] even:bg-[#181818] border-t border-[#222]">
                        <td className="px-6 py-3 text-gray-400 whitespace-nowrap">{formatTime(ev.created_at)}</td>
                        <td className="px-6 py-3 text-gray-200">{ev.gates?.name || `Gate ${ev.gate_id}`}</td>
                        <td className="px-6 py-3">
                          <span className={ev.event_type === "open" ? "text-green-400" : "text-red-400"}>
                            {ev.event_type === "open" ? "Opened" : "Closed"}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-mono text-gray-200">{ev.plate_number || "—"}</td>
                        <td className="px-6 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${trigger.className}`}>
                            {trigger.label}
                          </span>
                          {operator && <span className="text-gray-500 text-xs ml-2">{operator}</span>}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                      No gate activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
