import React, { useState } from "react";
import { Line } from "react-chartjs-2";
import { BarChart3, Download, Search, Info, Layers, ChevronUp, ChevronDown } from "lucide-react";
import { formatNumber, getClusterBadgeClasses, buildDayPatternSummary, aggregateRows } from "../components/shared/helpers";
import { DAYS_ORDER } from "../components/shared/constants";

// ─── Shared dark card ──────────────────────────────────────────────────────
function DarkCard({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Cluster badge ─────────────────────────────────────────────────────────
const CLUSTER_STYLE = {
  Tinggi: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#34d399" },
  Sedang: { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)", text: "#fbbf24" },
  Rendah: { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)",  text: "#f87171" },
};
function ClusterBadge({ label }) {
  const s = CLUSTER_STYLE[label] || CLUSTER_STYLE["Sedang"];
  return (
    <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>
      {label}
    </span>
  );
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: "rgba(255,255,255,0.4)", font: { size: 11 } } },
    tooltip: {
      backgroundColor: "rgba(15,23,42,0.95)",
      borderColor: "rgba(220,38,38,0.3)",
      borderWidth: 1,
      titleColor: "#fff",
      bodyColor: "rgba(255,255,255,0.6)",
    },
  },
  scales: {
    x: {
      ticks: { color: "rgba(255,255,255,0.3)", font: { size: 10 } },
      grid: { color: "rgba(255,255,255,0.04)" },
      border: { color: "rgba(255,255,255,0.06)" },
    },
    y: {
      ticks: { color: "rgba(255,255,255,0.3)", font: { size: 10 } },
      grid: { color: "rgba(255,255,255,0.04)" },
      border: { color: "rgba(255,255,255,0.06)" },
    },
  },
};

export default function Report({ clusteredData, clusterStats, productInsights, preprocessSummary, onExport }) {
  const [search, setSearch]       = useState("");
  const [selectedDay, setSelectedDay] = useState("Semua Hari");
  const [sortField, setSortField] = useState("tanggal");
  const [sortDir, setSortDir]     = useState("desc");

  if (!clusteredData || clusteredData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)" }}>
          <BarChart3 size={28} className="text-red-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-1">Belum ada Data Analisis</h3>
          <p className="text-white/35 text-sm">Silakan proses data pada menu Dashboard terlebih dahulu.</p>
        </div>
      </div>
    );
  }

  const days = ["Semua Hari", ...DAYS_ORDER.filter((d) => clusteredData.some((cd) => cd.hari === d))];
  const filteredData = selectedDay === "Semua Hari" ? clusteredData : clusteredData.filter((d) => d.hari === selectedDay);

  const counts = { Rendah: 0, Sedang: 0, Tinggi: 0 };
  filteredData.forEach((d) => { if (counts[d.cluster] !== undefined) counts[d.cluster]++; });

  const daySummary = buildDayPatternSummary(filteredData);
  const peakDay    = daySummary.length ? [...daySummary].sort((a, b) => b.rataRataTerjual - a.rataRataTerjual)[0] : null;
  const dominantCluster = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  const dayAverageChartData = daySummary.length
    ? {
        labels: daySummary.map((item) => item.hari),
        datasets: [{
          label: "Rata-rata Total Terjual",
          data: daySummary.map((item) => item.rataRataTerjual),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.08)",
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "#ef4444",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          borderWidth: 2,
        }],
      }
    : null;

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const filteredItems = filteredData
    .filter((d) => d.tanggal.toLowerCase().includes(search.toLowerCase()) || d.hari.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (typeof va === "string") { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const SortIcon = ({ field }) => sortField === field
    ? (sortDir === "asc" ? <ChevronUp size={12} className="text-red-400" /> : <ChevronDown size={12} className="text-red-400" />)
    : <ChevronUp size={12} className="text-white/20" />;

  return (
    <div className="space-y-6 p-1">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Report K-Means</h1>
          <p className="text-white/35 text-sm">Klasifikasi pola permintaan berdasarkan nama hari</p>
        </div>
        {onExport && (
          <button onClick={onExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", color: "#fca5a5" }}>
            <Download size={15} /> Export Excel
          </button>
        )}
      </div>

      {/* ── Day filter ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={
              selectedDay === day
                ? { background: "rgba(220,38,38,0.8)", border: "1px solid rgba(220,38,38,0.5)", color: "white" }
                : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }
            }
          >
            {day}
          </button>
        ))}
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Hari Permintaan Tinggi", value: `${counts.Tinggi} Hari`, accent: "#10b981" },
          { label: "Hari Permintaan Sedang", value: `${counts.Sedang} Hari`, accent: "#fbbf24" },
          { label: "Hari Permintaan Rendah", value: `${counts.Rendah} Hari`, accent: "#ef4444" },
          { label: "Kategori Dominan", value: dominantCluster, sub: peakDay ? `Puncak: ${peakDay.hari}` : "", accent: "#3b82f6" },
        ].map((s) => (
          <DarkCard key={s.label} className="p-5"
            style={{ borderLeft: `3px solid ${s.accent}`, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.07)`, borderLeftColor: s.accent, borderLeftWidth: "3px" }}>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">{s.label}</p>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            {s.sub && <p className="text-xs mt-1" style={{ color: s.accent }}>{s.sub}</p>}
          </DarkCard>
        ))}
      </div>

      {/* ── Chart ──────────────────────────────────────────────────────────── */}
      {dayAverageChartData && (
        <DarkCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-red-400" />
            <h2 className="text-sm font-semibold text-white">Pola Permintaan Berdasarkan Nama Hari</h2>
          </div>
          <div className="h-64 min-h-[200px]">
            <Line data={dayAverageChartData} options={chartOptions} />
          </div>
        </DarkCard>
      )}

      {/* ── Cluster summary ────────────────────────────────────────────────── */}
      {clusterStats && clusterStats.length > 0 && (
        <DarkCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={16} className="text-red-400" />
            <h2 className="text-sm font-semibold text-white">Ringkasan per Cluster</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {clusterStats.map((s, i) => {
              const rasio = s.avgStok > 0 ? (s.avgTerjual / s.avgStok) : 0;
              return (
                <div key={i} className="p-4 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <ClusterBadge label={s.label} />
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-xs text-white/30">Jumlah Hari</span>
                      <span className="text-xs font-semibold text-white">{s.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-white/30">Rata Terjual</span>
                      <span className="text-xs font-semibold text-white">{Math.round(s.avgTerjual).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-white/30">Rata Rasio</span>
                      <span className="text-xs font-semibold text-white">{(rasio * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DarkCard>
      )}

      {/* ── Data table ─────────────────────────────────────────────────────── */}
      <DarkCard className="p-0 overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-red-400" />
            <h2 className="text-sm font-semibold text-white">Data Klaster Harian</h2>
            <span className="text-xs text-white/25">({filteredItems.length} baris)</span>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              type="text"
              placeholder="Cari tanggal / hari..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl text-sm outline-none w-52"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.7)",
              }}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                {[
                  { field: "tanggal", label: "Tanggal" },
                  { field: "hari", label: "Hari" },
                  { field: "Total_Stok", label: "Total Stok" },
                  { field: "Total_Terjual", label: "Total Terjual" },
                  { field: "cluster", label: "Kategori" },
                ].map(({ field, label }) => (
                  <th key={field}
                    className="p-4 text-xs font-semibold uppercase tracking-widest cursor-pointer select-none"
                    style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    onClick={() => handleSort(field)}>
                    <div className="flex items-center gap-1">{label}<SortIcon field={field} /></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-white/25 text-sm italic">Data tidak ditemukan</td>
                </tr>
              ) : (
                filteredItems.map((r, i) => (
                  <tr key={i} className="transition-colors"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td className="p-4 text-sm font-medium text-white">{r.tanggal}</td>
                    <td className="p-4 text-sm text-white/50">{r.hari}</td>
                    <td className="p-4 text-sm font-semibold text-white/70">{(r.Total_Stok || 0).toLocaleString("id-ID")}</td>
                    <td className="p-4 text-sm font-semibold text-white">{(r.Total_Terjual || 0).toLocaleString("id-ID")}</td>
                    <td className="p-4"><ClusterBadge label={r.cluster} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DarkCard>
    </div>
  );
}