import React from "react";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  RefreshCw, Upload, Download, AlertTriangle, TrendingUp,
  Package, BarChart3, Layers, Zap, Activity,
} from "lucide-react";

// ─── Reusable dark card ────────────────────────────────────────────────────
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

// ─── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent = "#ef4444" }) {
  return (
    <DarkCard>
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
        >
          <Icon size={18} style={{ color: accent }} />
        </div>
      </div>
      <p className="text-xs text-white/35 font-medium uppercase tracking-widest mb-1">{label}</p>
      <h2 className="text-2xl font-bold text-white">{value}</h2>
      {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
    </DarkCard>
  );
}

// ─── Cluster badge ─────────────────────────────────────────────────────────
const CLUSTER_STYLE = {
  Tinggi: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#34d399" },
  Sedang: { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)", text: "#fbbf24" },
  Rendah: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", text: "#f87171" },
};
function ClusterBadge({ label }) {
  const s = CLUSTER_STYLE[label] || CLUSTER_STYLE["Sedang"];
  return (
    <span
      className="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      {label}
    </span>
  );
}

const DAYS_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

// ─── Demand Heatmap Component ──────────────────────────────────────────────
function DemandHeatmap({ clusteredData }) {
  const heatmapData = DAYS_ORDER.map((day) => {
    const dayRows = clusteredData.filter((d) => d.hari === day);
    const counts = { Rendah: 0, Sedang: 0, Tinggi: 0 };
    dayRows.forEach((d) => {
      if (counts[d.cluster] !== undefined) {
        counts[d.cluster]++;
      }
    });
    return {
      day,
      total: dayRows.length,
      counts,
    };
  });

  const getHeatmapColor = (cluster, count, total) => {
    if (total === 0 || count === 0) return "rgba(255,255,255,0.02)";
    const ratio = count / total;
    const opacity = 0.12 + ratio * 0.78; // scale opacity beautifully
    if (cluster === "Tinggi") return `rgba(16, 185, 129, ${opacity})`; // Sleek Green
    if (cluster === "Sedang") return `rgba(251, 191, 36, ${opacity})`; // Amber/Yellow
    return `rgba(239, 68, 68, ${opacity})`; // Red
  };

  const getTextColor = (count, total) => {
    if (total === 0 || count === 0) return "rgba(255,255,255,0.2)";
    const ratio = count / total;
    return ratio > 0.45 ? "#0f172a" : "#ffffff";
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-white/5">
      <table className="w-full text-center border-collapse">
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.02)" }}>
            <th className="p-4 text-xs font-bold uppercase tracking-widest text-left text-white/30" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Hari</th>
            <th className="p-4 text-xs font-bold uppercase tracking-widest text-red-400" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Rendah</th>
            <th className="p-4 text-xs font-bold uppercase tracking-widest text-amber-400" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Sedang</th>
            <th className="p-4 text-xs font-bold uppercase tracking-widest text-emerald-400" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Tinggi</th>
            <th className="p-4 text-xs font-bold uppercase tracking-widest text-white/30" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Total Terjadi</th>
          </tr>
        </thead>
        <tbody>
          {heatmapData.map((row) => (
            <tr key={row.day} className="border-t border-white/5 transition-colors hover:bg-white/[0.01]">
              <td className="p-4 text-sm font-medium text-left text-white/80 bg-white/[0.01]">{row.day}</td>
              {["Rendah", "Sedang", "Tinggi"].map((cluster) => {
                const count = row.counts[cluster];
                const pct = row.total > 0 ? (count / row.total) * 100 : 0;
                const bg = getHeatmapColor(cluster, count, row.total);
                const textColor = getTextColor(count, row.total);

                return (
                  <td
                    key={cluster}
                    className="p-4 transition-all duration-300 relative group"
                    style={{ backgroundColor: bg }}
                  >
                    {count > 0 ? (
                      <div className="flex flex-col items-center justify-center" style={{ color: textColor }}>
                        <span className="text-sm font-extrabold">{count}x</span>
                        <span className="text-[10px] font-medium opacity-85">{pct.toFixed(0)}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-white/10">—</span>
                    )}
                    {row.total > 0 && count > 0 && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-slate-950 border border-white/10 text-white shadow-2xl whitespace-nowrap">
                        {count} kali ({pct.toFixed(1)}%) bernilai {cluster}
                      </div>
                    )}
                  </td>
                );
              })}
              <td className="p-4 text-sm font-semibold text-white/30 bg-white/[0.01]" style={{ borderLeft: "1px solid rgba(255,255,255,0.03)" }}>{row.total} Hari</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export default function Dashboard({
  dailyAggregated = [],
  preprocessSummary,
  datasetInfo,
  elbowData = [],
  result,
  apiLoading,
  apiError,
  errorMsg,
  uploadLoading,
  uploadMsg,
  fetchFromAPI,
  handleDownloadTemplate,
  handleFileUpload,
}) {
  const clusteredData = result?.clusteredData || [];
  const clusterStats = result?.stats || [];

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalTerjual = dailyAggregated.reduce((s, d) => s + (d.Total_Terjual || 0), 0);
  const totalStok = dailyAggregated.reduce((s, d) => s + (d.Total_Stok || 0), 0);
  const totalHari = dailyAggregated.length;
  const rasioGlobal = totalStok > 0 ? ((totalTerjual / totalStok) * 100).toFixed(1) : "0";

  // ── Chart 1: Line Chart (Tren Permintaan Harian sepanjang Periode) ──
  const dailyTrendChartData = {
    labels: dailyAggregated.map((d) => d.tanggal),
    datasets: [
      {
        label: "Total Terjual",
        data: dailyAggregated.map((d) => d.Total_Terjual),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.08)",
        fill: true,
        tension: 0.4,
        pointRadius: dailyAggregated.length > 80 ? 1 : 2.5,
        borderWidth: 2,
      },
      {
        label: "Total Stok",
        data: dailyAggregated.map((d) => d.Total_Stok),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.04)",
        fill: true,
        tension: 0.4,
        pointRadius: dailyAggregated.length > 80 ? 1 : 2.5,
        borderWidth: 2,
      }
    ],
  };

  // ── Chart 2: Histogram/Bar Chart (Rata-rata per Nama Hari) ──
  const daySummary = DAYS_ORDER.map((day) => {
    const rows = clusteredData.filter((item) => item.hari === day);
    if (rows.length === 0) return null;
    const avgTerjual = rows.reduce((s, i) => s + i.Total_Terjual, 0) / rows.length;
    const avgStok = rows.reduce((s, i) => s + i.Total_Stok, 0) / rows.length;
    return { hari: day, avgTerjual, avgStok };
  }).filter(Boolean);

  const dayAverageBarChartData = daySummary.length
    ? {
      labels: daySummary.map((item) => item.hari),
      datasets: [
        {
          label: "Rata-rata Terjual",
          data: daySummary.map((item) => item.avgTerjual),
          backgroundColor: "rgba(239, 68, 68, 0.75)",
          borderColor: "#ef4444",
          borderWidth: 1.5,
          borderRadius: 6,
        },
        {
          label: "Rata-rata Stok",
          data: daySummary.map((item) => item.avgStok),
          backgroundColor: "rgba(59, 130, 246, 0.6)",
          borderColor: "#3b82f6",
          borderWidth: 1.5,
          borderRadius: 6,
        }
      ],
    }
    : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { color: "rgba(255,255,255,0.3)", font: { size: 10 }, maxTicksLimit: 8 },
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

  // ── Chart: elbow ──────────────────────────────────────────────────────────
  // Backend returns [{k, inertia}, ...] array
  const elbowChartData = {
    labels: elbowData.map((e) => e.k),
    datasets: [
      {
        label: "Inertia",
        data: elbowData.map((e) => e.inertia),
        borderColor: "#f87171",
        backgroundColor: "rgba(248,113,113,0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#ef4444",
        borderWidth: 2,
      },
    ],
  };

  // ── Chart: cluster donut ──────────────────────────────────────────────────
  // Backend returns cluster = "Rendah"/"Sedang"/"Tinggi"
  const clusterCounts = { Tinggi: 0, Sedang: 0, Rendah: 0 };
  clusteredData.forEach((d) => {
    if (clusterCounts[d.cluster] !== undefined) clusterCounts[d.cluster]++;
  });

  const donutData = {
    labels: Object.keys(clusterCounts),
    datasets: [
      {
        data: Object.values(clusterCounts),
        backgroundColor: ["rgba(16,185,129,0.7)", "rgba(251,191,36,0.7)", "rgba(239,68,68,0.7)"],
        borderColor: ["#10b981", "#fbbf24", "#ef4444"],
        borderWidth: 1,
        hoverOffset: 6,
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: "rgba(255,255,255,0.5)", font: { size: 11 }, padding: 12 },
      },
    },
    cutout: "70%",
  };

  // ── Loading / error states ────────────────────────────────────────────────
  if (apiLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-red-500/30 border-t-red-500 animate-spin" />
        <p className="text-white/40 text-sm">Memuat data dari server...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
          <p className="text-white/35 text-sm">Analisis penjualan & hasil clustering K-Means</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            <Download size={15} /> Template
          </button>
          <label
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all"
            style={{
              background: "rgba(220,38,38,0.15)",
              border: "1px solid rgba(220,38,38,0.3)",
              color: "#fca5a5",
            }}
          >
            {uploadLoading
              ? <><RefreshCw size={15} className="animate-spin" /> Mengupload...</>
              : <><Upload size={15} /> Upload EXCEL</>}
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileUpload} disabled={uploadLoading} />
          </label>
          <button
            onClick={fetchFromAPI}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "rgba(220,38,38,0.9)",
              border: "1px solid rgba(220,38,38,0.5)",
              color: "white",
            }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────────────── */}
      {(apiError || errorMsg) && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}
        >
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{apiError || errorMsg}</span>
        </div>
      )}
      {uploadMsg && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#34d399" }}
        >
          <span>{uploadMsg}</span>
        </div>
      )}

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Terjual" value={totalTerjual.toLocaleString("id-ID")} icon={TrendingUp} accent="#ef4444" />
        <StatCard label="Total Stok" value={totalStok.toLocaleString("id-ID")} icon={Package} accent="#3b82f6" />
        <StatCard label="Hari Tercatat" value={totalHari} icon={Activity} accent="#8b5cf6" />
        <StatCard label="Rasio Terjual" value={`${rasioGlobal}%`} icon={Zap} accent="#f59e0b" />
      </div>

      {/* ── Visualisasi Pengujian Sistem ── */}
      {clusteredData.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-red-400" />
            <h2 className="text-base font-bold text-white">Visualisasi Pengujian Sistem K-Means </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1) Line Chart Tren Permintaan Harian */}
            <DarkCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">1) Tren Permintaan Harian sepanjang Periode</h3>
                  <p className="text-[11px] text-white/30">Line Chart untuk mengamati pergerakan stok dan penjualan harian</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              </div>
              <div className="h-64 min-h-[200px]">
                <Line data={dailyTrendChartData} options={{ ...chartOptions, plugins: { legend: { display: true, labels: { color: "rgba(255,255,255,0.4)" } } } }} />
              </div>
            </DarkCard>

            {/* 2) Histogram / Bar Chart Rata-rata per Hari */}
            {dayAverageBarChartData && (
              <DarkCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">2) Rata-rata Penjualan per Nama Hari</h3>
                    <p className="text-[11px] text-white/30">Histogram / Bar Chart untuk melihat penjualan rata-rata pada hari Senin–Minggu</p>
                  </div>
                </div>
                <div className="h-64 min-h-[200px]">
                  <Bar data={dayAverageBarChartData} options={{ ...chartOptions, plugins: { legend: { display: true, labels: { color: "rgba(255,255,255,0.4)" } } } }} />
                </div>
              </DarkCard>
            )}
          </div>

          {/* 3) Heatmap Relasi Hari dan Kategori Klaster */}
          <DarkCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Layers size={16} className="text-red-400" />
              <div>
                <h3 className="text-sm font-semibold text-white">3) Heatmap Relasi Nama Hari & Kategori Klaster</h3>
                <p className="text-[11px] text-white/30">Mengidentifikasi visual relasi antara hari dengan tingkat permintaan (Rendah, Sedang, Tinggi)</p>
              </div>
            </div>
            <DemandHeatmap clusteredData={clusteredData} />
          </DarkCard>
        </div>
      )}

      {/* ── Dashboard Charts Row (Only shown if NOT analyzed yet or as technical parameters) ── */}
      {clusteredData.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Default 30-day Line chart for empty state */}
          <DarkCard className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Tren Penjualan Harian</h2>
                <p className="text-xs text-white/30 mt-0.5">30 hari terakhir</p>
              </div>
            </div>
            <div className="h-56 min-h-[180px]">
              <div className="flex items-center justify-center h-full text-white/20 text-sm">Tidak ada data</div>
            </div>
          </DarkCard>

          {/* Donut chart for empty state */}
          <DarkCard>
            <h2 className="text-sm font-semibold text-white mb-1">Distribusi Cluster</h2>
            <p className="text-xs text-white/30 mb-4">Hasil K-Means (k=3)</p>
            <div className="h-56 min-h-[180px]">
              <div className="flex items-center justify-center h-full text-white/20 text-sm">Belum ada data cluster</div>
            </div>
          </DarkCard>
        </div>
      ) : (
        /* Technical parameters section when analyzed */
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-red-400" />
            <h2 className="text-base font-bold text-white">Parameter & Distribusi Algoritma K-Means</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Donut chart */}
            <DarkCard>
              <h2 className="text-sm font-semibold text-white mb-1">Distribusi Cluster</h2>
              <p className="text-xs text-white/30 mb-4">Hasil K-Means (k=3)</p>
              <div className="h-56 min-h-[180px]">
                <Doughnut data={donutData} options={donutOptions} />
              </div>
            </DarkCard>

            {/* Elbow chart */}
            <DarkCard>
              <h2 className="text-sm font-semibold text-white mb-1">Elbow Method</h2>
              <p className="text-xs text-white/30 mb-4">Penentuan nilai K optimal</p>
              <div className="h-56 min-h-[180px]">
                {elbowData.length > 0 ? (
                  <Line data={elbowChartData} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-white/20 text-sm">Belum ada data elbow</div>
                )}
              </div>
            </DarkCard>

            {/* Cluster summary */}
            <DarkCard>
              <div className="flex items-center gap-2 mb-4">
                <Layers size={16} className="text-red-400" />
                <h2 className="text-sm font-semibold text-white">Ringkasan Cluster</h2>
              </div>
              {clusterStats.length > 0 ? (
                <div className="space-y-3 overflow-y-auto max-h-[200px] pr-1">
                  {clusterStats.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <div className="flex items-center gap-3">
                        <ClusterBadge label={s.label} />
                        <span className="text-xs text-white/40">{s.count} hari</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{Math.round(s.avgTerjual).toLocaleString("id-ID")}</p>
                        <p className="text-[10px] text-white/30">rata terjual</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-28 text-white/20 text-sm">
                  Belum ada data cluster
                </div>
              )}
            </DarkCard>
          </div>
        </div>
      )}

      {/* ── Dataset info ────────────────────────────────────────────────────── */}
      {(preprocessSummary || datasetInfo) && (
        <DarkCard>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-red-400" />
            <h2 className="text-sm font-semibold text-white">Info Dataset</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Baris", value: preprocessSummary?.total ?? datasetInfo?.total_baris ?? "—" },
              { label: "Produk Unik", value: preprocessSummary?.uniqueProducts ?? datasetInfo?.total_produk_unik ?? "—" },
              { label: "Rentang Tanggal", value: preprocessSummary ? `${preprocessSummary.startDate || ''} s/d ${preprocessSummary.endDate || ''}` : (datasetInfo ? `${datasetInfo.tanggal_mulai || ''} s/d ${datasetInfo.tanggal_akhir || ''}` : "—") },
              { label: "Hari Unik", value: preprocessSummary?.uniqueCategories ?? datasetInfo?.total_hari ?? "0" },
            ].map((item) => (
              <div
                key={item.label}
                className="p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </DarkCard>
      )}
    </div>
  );
}