import React, { useState } from "react";
import { Line, Bar } from "react-chartjs-2";
import { TrendingUp, Download, CalendarDays, Package, Zap, ChevronUp, ChevronDown } from "lucide-react";

function DarkCard({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-2xl p-6 ${className}`}
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

const chartOptions = (yLabel = "") => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: "rgba(255,255,255,0.4)", font: { size: 11 } },
    },
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
      title: yLabel ? { display: true, text: yLabel, color: "rgba(255,255,255,0.25)", font: { size: 10 } } : undefined,
    },
  },
});

export default function Forecasting({ futureForecasts = [], preprocessSummary, onExport }) {
  const [sortField, setSortField] = useState("tanggal");
  const [sortDir, setSortDir]     = useState("asc");

  if (!futureForecasts || futureForecasts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)" }}
        >
          <TrendingUp size={28} className="text-red-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-1">Belum ada Data Forecasting</h3>
          <p className="text-white/35 text-sm">Data akan muncul setelah backend memproses prediksi.</p>
        </div>
      </div>
    );
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  // Backend returns perkiraanTerjual field
  const totalPrediksi  = futureForecasts.reduce((s, r) => s + (r.perkiraanTerjual || 0), 0);
  const avgPrediksi    = futureForecasts.length ? (totalPrediksi / futureForecasts.length).toFixed(0) : 0;
  const maxDay         = [...futureForecasts].sort((a, b) => (b.perkiraanTerjual || 0) - (a.perkiraanTerjual || 0))[0];
  const minDay         = [...futureForecasts].sort((a, b) => (a.perkiraanTerjual || 0) - (b.perkiraanTerjual || 0))[0];

  // ── Line chart ─────────────────────────────────────────────────────────────
  const lineData = {
    labels: futureForecasts.map((r) => r.tanggal),
    datasets: [
      {
        label: "Prediksi Terjual",
        data: futureForecasts.map((r) => r.perkiraanTerjual),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.08)",
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: "#ef4444",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        borderWidth: 2,
      },
    ],
  };

  // ── Bar chart ──────────────────────────────────────────────────────────────
  const barData = {
    labels: futureForecasts.map((r) => r.hari || r.tanggal),
    datasets: [
      {
        label: "Prediksi Terjual",
        data: futureForecasts.map((r) => r.perkiraanTerjual),
        backgroundColor: futureForecasts.map((_, i) =>
          i === futureForecasts.indexOf(maxDay) ? "rgba(239,68,68,0.8)" : "rgba(239,68,68,0.25)"
        ),
        borderColor: "rgba(239,68,68,0.5)",
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  // ── Sort table ─────────────────────────────────────────────────────────────
  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const sorted = [...futureForecasts].sort((a, b) => {
    let va = a[sortField], vb = b[sortField];
    if (typeof va === "string") { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronUp size={12} className="text-white/20" />;
    return sortDir === "asc"
      ? <ChevronUp size={12} className="text-red-400" />
      : <ChevronDown size={12} className="text-red-400" />;
  };

  const ThCell = ({ field, children }) => (
    <th
      className="p-4 text-xs font-semibold uppercase tracking-widest cursor-pointer select-none"
      style={{ color: "rgba(255,255,255,0.3)" }}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">{children}<SortIcon field={field} /></div>
    </th>
  );

  return (
    <div className="space-y-6 p-1">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Forecasting</h1>
          <p className="text-white/35 text-sm">Prediksi penjualan 7 hari ke depan</p>
        </div>
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "rgba(220,38,38,0.15)",
              border: "1px solid rgba(220,38,38,0.3)",
              color: "#fca5a5",
            }}
          >
            <Download size={15} /> Export Excel
          </button>
        )}
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Prediksi 7 Hari", value: totalPrediksi.toLocaleString("id-ID"), icon: TrendingUp, accent: "#ef4444" },
          { label: "Rata-rata Harian",       value: Number(avgPrediksi).toLocaleString("id-ID"), icon: Zap,         accent: "#f59e0b" },
          { label: "Hari Terlaris",          value: maxDay?.hari || maxDay?.tanggal || "—", icon: CalendarDays, accent: "#10b981" },
          { label: "Hari Terendah",          value: minDay?.hari || minDay?.tanggal || "—", icon: Package,     accent: "#8b5cf6" },
        ].map((s) => (
          <DarkCard key={s.label}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${s.accent}18`, border: `1px solid ${s.accent}30` }}
            >
              <s.icon size={16} style={{ color: s.accent }} />
            </div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{s.label}</p>
            <p className="text-xl font-bold text-white">{s.value}</p>
          </DarkCard>
        ))}
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DarkCard>
          <h2 className="text-sm font-semibold text-white mb-1">Tren Prediksi</h2>
          <p className="text-xs text-white/30 mb-4">Proyeksi penjualan harian</p>
          <div className="h-56 min-h-[180px]">
            <Line data={lineData} options={chartOptions("Unit")} />
          </div>
        </DarkCard>
        <DarkCard>
          <h2 className="text-sm font-semibold text-white mb-1">Prediksi per Hari</h2>
          <p className="text-xs text-white/30 mb-4">Perbandingan volume antar hari</p>
          <div className="h-56 min-h-[180px]">
            <Bar data={barData} options={chartOptions("Unit")} />
          </div>
        </DarkCard>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <DarkCard className="p-0 overflow-hidden">
        <div className="px-6 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <h2 className="text-sm font-semibold text-white">Detail Prediksi Harian</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                <ThCell field="tanggal">Tanggal</ThCell>
                <ThCell field="hari">Hari</ThCell>
                <ThCell field="perkiraanTerjual">Prediksi Terjual</ThCell>
                <th className="p-4 text-xs font-semibold uppercase tracking-widest text-right"
                  style={{ color: "rgba(255,255,255,0.3)" }}>Kategori</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const val = r.perkiraanTerjual || 0;
                const isMax = r === maxDay;
                return (
                  <tr
                    key={i}
                    className="transition-colors"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td className="p-4 text-sm font-medium text-white">{r.tanggal}</td>
                    <td className="p-4 text-sm text-white/50">{r.hari || "—"}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 rounded-full max-w-[120px]"
                          style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${maxDay?.perkiraanTerjual ? (val / maxDay.perkiraanTerjual) * 100 : 0}%`,
                              background: isMax ? "#ef4444" : "rgba(239,68,68,0.4)",
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-white">{val.toLocaleString("id-ID")}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span
                        className="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold"
                        style={
                          val >= (Number(avgPrediksi) * 1.1)
                            ? { background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" }
                            : val <= (Number(avgPrediksi) * 0.9)
                            ? { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }
                            : { background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }
                        }
                      >
                        {val >= (Number(avgPrediksi) * 1.1) ? "Tinggi" : val <= (Number(avgPrediksi) * 0.9) ? "Rendah" : "Sedang"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DarkCard>
    </div>
  );
}