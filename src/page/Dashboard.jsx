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
  "Laku Tinggi": { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#34d399" },
  "Laku Sedang": { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)", text: "#fbbf24" },
  "Laku Rendah": { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)",  text: "#f87171" },
};
function ClusterBadge({ label }) {
  const s = CLUSTER_STYLE[label] || CLUSTER_STYLE["Laku Sedang"];
  return (
    <span
      className="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      {label}
    </span>
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
  const clusteredData  = result?.clusteredData  || [];
  const clusterStats   = result?.stats          || [];

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalTerjual = dailyAggregated.reduce((s, d) => s + (d.Total_Terjual || 0), 0);
  const totalStok    = dailyAggregated.reduce((s, d) => s + (d.Total_Stok    || 0), 0);
  const totalHari    = dailyAggregated.length;
  const rasioGlobal  = totalStok > 0 ? ((totalTerjual / totalStok) * 100).toFixed(1) : "0";

  // ── Chart: penjualan harian ───────────────────────────────────────────────
  const dailyChartData = {
    labels: dailyAggregated.slice(-30).map((d) => d.tanggal),
    datasets: [
      {
        label: "Total Terjual",
        data: dailyAggregated.slice(-30).map((d) => d.Total_Terjual),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.08)",
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
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
  const elbowChartData = {
    labels: elbowData.map((e) => `k=${e.k}`),
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
  const clusterCounts = { "Laku Tinggi": 0, "Laku Sedang": 0, "Laku Rendah": 0 };
  clusteredData.forEach((d) => { if (clusterCounts[d.Label_Cluster] !== undefined) clusterCounts[d.Label_Cluster]++; });

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
              : <><Upload size={15} /> Upload CSV</>}
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
        <StatCard label="Total Terjual"  value={totalTerjual.toLocaleString("id-ID")} icon={TrendingUp} accent="#ef4444" />
        <StatCard label="Total Stok"     value={totalStok.toLocaleString("id-ID")}    icon={Package}    accent="#3b82f6" />
        <StatCard label="Hari Tercatat"  value={totalHari}                            icon={Activity}   accent="#8b5cf6" />
        <StatCard label="Rasio Terjual"  value={`${rasioGlobal}%`}                    icon={Zap}        accent="#f59e0b" />
      </div>

      {/* ── Charts row 1 ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Line chart */}
        <DarkCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Tren Penjualan Harian</h2>
              <p className="text-xs text-white/30 mt-0.5">30 hari terakhir</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </div>
          <div className="h-56">
            {dailyAggregated.length > 0
              ? <Line data={dailyChartData} options={chartOptions} />
              : <div className="flex items-center justify-center h-full text-white/20 text-sm">Tidak ada data</div>}
          </div>
        </DarkCard>

        {/* Donut chart */}
        <DarkCard>
          <h2 className="text-sm font-semibold text-white mb-1">Distribusi Cluster</h2>
          <p className="text-xs text-white/30 mb-4">Hasil K-Means (k=3)</p>
          <div className="h-56">
            {clusteredData.length > 0
              ? <Doughnut data={donutData} options={donutOptions} />
              : <div className="flex items-center justify-center h-full text-white/20 text-sm">Belum ada data cluster</div>}
          </div>
        </DarkCard>
      </div>

      {/* ── Charts row 2 ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Elbow chart */}
        <DarkCard>
          <h2 className="text-sm font-semibold text-white mb-1">Elbow Method</h2>
          <p className="text-xs text-white/30 mb-4">Penentuan nilai K optimal</p>
          <div className="h-44">
            {elbowData.length > 0
              ? <Line data={elbowChartData} options={chartOptions} />
              : <div className="flex items-center justify-center h-full text-white/20 text-sm">Belum ada data elbow</div>}
          </div>
        </DarkCard>

        {/* Cluster summary */}
        <DarkCard className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={16} className="text-red-400" />
            <h2 className="text-sm font-semibold text-white">Ringkasan Cluster</h2>
          </div>
          {clusterStats.length > 0 ? (
            <div className="space-y-3">
              {clusterStats.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div className="flex items-center gap-3">
                    <ClusterBadge label={s.Label_Cluster} />
                    <span className="text-xs text-white/40">{s.Jumlah_Produk} produk</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{Math.round(s.Rata_Total_Terjual).toLocaleString("id-ID")}</p>
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

      {/* ── Dataset info ────────────────────────────────────────────────────── */}
      {(preprocessSummary || datasetInfo) && (
        <DarkCard>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-red-400" />
            <h2 className="text-sm font-semibold text-white">Info Dataset</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Baris",    value: preprocessSummary?.total_rows    ?? datasetInfo?.total_rows    ?? "—" },
              { label: "Produk Unik",    value: preprocessSummary?.unique_items  ?? datasetInfo?.unique_items  ?? "—" },
              { label: "Rentang Tanggal",value: preprocessSummary?.date_range    ?? datasetInfo?.date_range    ?? "—" },
              { label: "Missing Values", value: preprocessSummary?.missing_values ?? datasetInfo?.missing_values ?? "0" },
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