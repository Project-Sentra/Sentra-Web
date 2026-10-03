/**
 * Reports.jsx - Financial and usage reports (FR-11)
 * ==================================================
 *   - KPI cards: revenue, collected vs pending, entries, average stay
 *   - Daily revenue chart (billed vs collected)
 *   - Entries per hour with the peak hour highlighted
 *   - Weekday x hour heatmap of arrivals (busiest times at a glance)
 *   - Session type / entry method breakdown
 *   - CSV export of all sessions in the selected range
 * All days and hours are in the facility's local time (reported by the API).
 */

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Sidebar from "../../components/Sidebar";
import lprService from "../../services/lprService";

const RANGES = [7, 30, 90];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const YELLOW = "#e2e600";

const lkr = (n) => `LKR ${Number(n || 0).toLocaleString()}`;
const hourLabel = (h) => `${String(h).padStart(2, "0")}:00`;
const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString([], { day: "numeric", month: "short" });
const formatDuration = (minutes) => {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

const tooltipStyle = {
  contentStyle: { background: "#1b1b1b", border: "1px solid #333", borderRadius: 12 },
  labelStyle: { color: "#aaa" },
};

function Kpi({ label, value, sub, accent = false }) {
  return (
    <div className="bg-[#171717] border border-[#232323] rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${accent ? "text-sentraYellow" : "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function Panel({ title, subtitle, children, className = "" }) {
  return (
    <section className={`bg-[#171717] border border-[#232323] rounded-2xl p-5 ${className}`}>
      <h2 className="font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Heatmap({ data }) {
  const max = Math.max(1, ...data.flat());
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid gap-1" style={{ gridTemplateColumns: "40px repeat(24, 1fr)" }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[10px] text-gray-600 text-center">
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
          {data.map((row, d) => (
            <React.Fragment key={d}>
              <div className="text-xs text-gray-500 flex items-center">{WEEKDAYS[d]}</div>
              {row.map((count, h) => (
                <div
                  key={h}
                  title={`${WEEKDAYS[d]} ${hourLabel(h)}: ${count} arrivals`}
                  className="aspect-square rounded-[3px]"
                  style={{
                    background: count
                      ? `rgba(226, 230, 0, ${0.15 + 0.85 * (count / max)})`
                      : "#1f1f1f",
                  }}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function Breakdown({ items }) {
  const total = Object.values(items).reduce((a, b) => a + b, 0);
  if (!total) return <p className="text-sm text-gray-500">No data yet.</p>;
  return (
    <ul className="space-y-3">
      {Object.entries(items)
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => (
          <li key={key}>
            <div className="flex justify-between text-sm">
              <span className="text-gray-300 capitalize">{key.replace("_", " ")}</span>
              <span className="text-gray-500">
                {count} · {Math.round((count / total) * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-[#222] rounded-full mt-1.5">
              <div
                className="h-full rounded-full bg-sentraYellow"
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
          </li>
        ))}
    </ul>
  );
}

export default function Reports() {
  const { facilityId } = useParams();
  const fid = parseInt(facilityId) || 1;

  const [facilityName, setFacilityName] = useState("Parking Facility");
  const [days, setDays] = useState(30);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    lprService
      .getFacility(fid)
      .then((data) => data.facility && setFacilityName(data.facility.name))
      .catch(() => {});
  }, [fid]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    lprService
      .getReportSummary(fid, days)
      .then((data) => {
        if (!cancelled) {
          setReport(data);
          setError("");
        }
      })
      .catch((err) => !cancelled && setError(err.response?.data?.message || "Could not load the report."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [fid, days]);

  async function handleExport() {
    setExporting(true);
    try {
      await lprService.downloadSessionsCsv(fid, days);
    } catch {
      setError("Could not export the sessions.");
    } finally {
      setExporting(false);
    }
  }

  const totals = report?.totals;
  const peakHour = report?.peak_hour;

  return (
    <div className="min-h-screen bg-sentraBlack text-white flex">
      <Sidebar facilityName={facilityName} />

      <main className="flex-1 p-8 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="text-gray-500 text-sm mt-1">
              Revenue and usage{report ? ` · times in ${report.timezone}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[#171717] border border-[#232323] rounded-xl p-1" role="group" aria-label="Date range">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setDays(r)}
                  aria-pressed={days === r}
                  className={
                    "px-3 py-1.5 text-sm rounded-lg transition " +
                    (days === r ? "bg-sentraYellow text-black font-semibold" : "text-gray-400 hover:text-white")
                  }
                >
                  {r} days
                </button>
              ))}
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 text-sm rounded-xl border border-[#333] text-gray-300 hover:border-sentraYellow hover:text-sentraYellow disabled:opacity-50 transition"
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/60 text-red-400 p-4 rounded-xl mb-6 text-sm">{error}</div>
        )}

        {loading && !report ? (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-[#171717] border border-[#232323] animate-pulse" />
            ))}
          </div>
        ) : (
          report && (
            <div className={`space-y-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Kpi label="Revenue" value={lkr(totals.revenue)} sub={`${totals.exits} completed stays`} accent />
                <Kpi
                  label="Collected"
                  value={lkr(totals.collected)}
                  sub={totals.pending ? `${lkr(totals.pending)} pending` : "Nothing pending"}
                />
                <Kpi
                  label="Entries"
                  value={totals.entries.toLocaleString()}
                  sub={`${totals.unique_vehicles} vehicles · ${totals.active} parked now`}
                />
                <Kpi
                  label="Peak hour"
                  value={peakHour == null ? "—" : `${hourLabel(peakHour)}–${hourLabel((peakHour + 1) % 24)}`}
                  sub={`Avg stay ${formatDuration(totals.avg_duration_minutes)}${
                    report.peak_weekday == null ? "" : ` · busiest ${WEEKDAYS[report.peak_weekday]}`
                  }`}
                />
              </div>

              <Panel title="Daily revenue" subtitle="Billed at exit; collected = paid">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={report.daily} margin={{ left: 0, right: 8 }}>
                      <defs>
                        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={YELLOW} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={YELLOW} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#222" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={shortDate} stroke="#555" fontSize={11} minTickGap={20} />
                      <YAxis stroke="#555" fontSize={11} width={56} />
                      <Tooltip
                        {...tooltipStyle}
                        labelFormatter={shortDate}
                        formatter={(v, name) => [lkr(v), name === "revenue" ? "Billed" : "Collected"]}
                      />
                      <Area type="monotone" dataKey="revenue" stroke={YELLOW} fill="url(#rev)" strokeWidth={2} />
                      <Area type="monotone" dataKey="collected" stroke="#22c55e" fill="transparent" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <div className="grid gap-6 xl:grid-cols-3">
                <Panel
                  title="Arrivals by hour"
                  subtitle={peakHour == null ? "No arrivals yet" : `Peak at ${hourLabel(peakHour)}`}
                  className="xl:col-span-2"
                >
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.hourly}>
                        <CartesianGrid stroke="#222" vertical={false} />
                        <XAxis dataKey="hour" tickFormatter={(h) => h} stroke="#555" fontSize={11} />
                        <YAxis allowDecimals={false} stroke="#555" fontSize={11} width={32} />
                        <Tooltip
                          {...tooltipStyle}
                          cursor={{ fill: "#ffffff08" }}
                          labelFormatter={hourLabel}
                          formatter={(v) => [v, "Arrivals"]}
                        />
                        <Bar dataKey="entries" radius={[4, 4, 0, 0]}>
                          {report.hourly.map((h) => (
                            <Cell key={h.hour} fill={h.hour === peakHour ? YELLOW : "#3a3a3a"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel title="Session types">
                  <Breakdown items={report.by_session_type} />
                  <h3 className="font-semibold text-white mt-6 mb-3 text-sm">Entry method</h3>
                  <Breakdown items={report.by_entry_method} />
                </Panel>
              </div>

              <Panel title="When do drivers arrive?" subtitle="Arrivals by weekday and hour">
                <Heatmap data={report.heatmap} />
              </Panel>
            </div>
          )
        )}
      </main>
    </div>
  );
}
