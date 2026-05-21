import React, { useState, useEffect } from "react";
import { Line, Doughnut, Bar } from "react-chartjs-2";
import {
  ArrowLeft, FileSpreadsheet, Calendar, Package, TrendingUp,
  BarChart3, Layers, RefreshCw, AlertTriangle, Database, Zap
} from "lucide-react";
import { fetchDatasetDetail, fetchDatasetAnalysis } from "../api/dataService";

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

const baseChartOptions = {
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
      ticks: { color: "rgba(255,255,255,0.3)", font: { size: 10 }, maxTicksLimit: 10 },
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

export default function DatasetDetail({ datasetId, onBack }) {
  const [detail, setDetail] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDetail();
  }, [datasetId]);

  const loadDetail = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchDatasetDetail(datasetId);
      setDetail(data);
      // Auto-analyze
      setAnalyzing(true);
      try {
        const analysisData = await fetchDatasetAnalysis(datasetId);
        setAnalysis(analysisData);
      } catch (err) {
        console.warn("Analisis gagal:", err.message);
      } finally {
        setAnalyzing(false);
      }
    } catch (err) {
      setError(err.message || "Gagal memuat detail dataset.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-red-500/30 border-t-red-500 animate-spin" />
        <p className="text-white/40 text-sm">Memuat detail dataset...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-1">
        <button onClick={onBack}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
          <ArrowLeft size={16} /> Kembali ke History
        </button>
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const ds = detail?.dataset || {};
  const dailyAggregated = detail?.dailyAggregated || [];
  const transactionRows = detail?.transactionRows || [];
  const preprocessSummary = detail?.preprocessSummary || {};

  const clusteredData = analysis?.clusteredData || [];
  const clusterStats = analysis?.stats || [];
  const elbowData = analysis?.elbowData || [];
  const forecasts = analysis?.forecasts || [];

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalTerjual = dailyAggregated.reduce((s, d) => s + (d.Total_Terjual || 0), 0);
  const totalStok = dailyAggregated.reduce((s, d) => s + (d.Total_Stok || 0), 0);
  const rasioGlobal = totalStok > 0 ? ((totalTerjual / totalStok) * 100).toFixed(1) : "0";

  // ── Line chart ─────────────────────────────────────────────────────────────
  const dailyChartData = {
    labels: dailyAggregated.map(d => d.tanggal),
    datasets: [
      {
        label: "Total Terjual",
        data: dailyAggregated.map(d => d.Total_Terjual),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.08)",
        fill: true, tension: 0.4, pointRadius: 2, borderWidth: 2,
      },
      {
        label: "Total Stok",
        data: dailyAggregated.map(d => d.Total_Stok),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.05)",
        fill: true, tension: 0.4, pointRadius: 2, borderWidth: 2,
      },
    ],
  };

  // ── Donut chart ────────────────────────────────────────────────────────────
  const clusterCounts = { Tinggi: 0, Sedang: 0, Rendah: 0 };
  clusteredData.forEach(d => { if (clusterCounts[d.cluster] !== undefined) clusterCounts[d.cluster]++; });
  const donutData = {
    labels: Object.keys(clusterCounts),
    datasets: [{
      data: Object.values(clusterCounts),
      backgroundColor: ["rgba(16,185,129,0.7)", "rgba(251,191,36,0.7)", "rgba(239,68,68,0.7)"],
      borderColor: ["#10b981", "#fbbf24", "#ef4444"],
      borderWidth: 1, hoverOffset: 6,
    }],
  };

  // ── Forecast chart ─────────────────────────────────────────────────────────
  const forecastChartData = forecasts.length > 0 ? {
    labels: forecasts.map(f => f.hari),
    datasets: [{
      label: "Perkiraan Terjual",
      data: forecasts.map(f => f.perkiraanTerjual),
      backgroundColor: forecasts.map(f => {
        if (f.kategori === "Tinggi") return "rgba(16,185,129,0.6)";
        if (f.kategori === "Sedang") return "rgba(251,191,36,0.6)";
        return "rgba(239,68,68,0.6)";
      }),
      borderRadius: 6,
      borderWidth: 0,
    }],
  } : null;

  return (
    <div className="space-y-6 p-1">
      {/* ── Back + Header ──────────────────────────────────────────────────── */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm mb-2">
        <ArrowLeft size={16} /> Kembali ke History
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
              <FileSpreadsheet size={20} className="text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{ds.original_filename || "Dataset"}</h1>
              <p className="text-white/35 text-sm">
                Diupload {ds.created_at ? new Date(ds.created_at).toLocaleDateString("id-ID", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                  hour: "2-digit", minute: "2-digit"
                }) : "-"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Baris",    value: (ds.row_count || 0).toLocaleString("id-ID"), icon: Database,    accent: "#8b5cf6" },
          { label: "Total Terjual",  value: totalTerjual.toLocaleString("id-ID"),        icon: TrendingUp,  accent: "#ef4444" },
          { label: "Total Stok",     value: totalStok.toLocaleString("id-ID"),           icon: Package,     accent: "#3b82f6" },
          { label: "Rasio Terjual",  value: `${rasioGlobal}%`,                          icon: Zap,         accent: "#f59e0b" },
        ].map(s => (
          <DarkCard key={s.label}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${s.accent}18`, border: `1px solid ${s.accent}30` }}>
              <s.icon size={16} style={{ color: s.accent }} />
            </div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{s.label}</p>
            <p className="text-xl font-bold text-white">{s.value}</p>
          </DarkCard>
        ))}
      </div>

      {/* ── Dataset Info ───────────────────────────────────────────────────── */}
      <DarkCard>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} className="text-red-400" />
          <h2 className="text-sm font-semibold text-white">Informasi Dataset</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Produk Unik",    value: preprocessSummary?.uniqueProducts || ds.unique_products || "—" },
            { label: "Hari Tercatat",   value: dailyAggregated.length || "—" },
            { label: "Tanggal Mulai",   value: preprocessSummary?.startDate || ds.date_range_start || "—" },
            { label: "Tanggal Akhir",   value: preprocessSummary?.endDate || ds.date_range_end || "—" },
          ].map(item => (
            <div key={item.label} className="p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{item.label}</p>
              <p className="text-sm font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </DarkCard>

      {/* ── Charts Row 1 ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DarkCard className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-white mb-1">Tren Penjualan Harian</h2>
          <p className="text-xs text-white/30 mb-4">Stok vs Terjual dari dataset ini</p>
          <div className="h-56 min-h-[180px]">
            {dailyAggregated.length > 0
              ? <Line data={dailyChartData} options={baseChartOptions} />
              : <div className="flex items-center justify-center h-full text-white/20 text-sm">Tidak ada data</div>}
          </div>
        </DarkCard>

        <DarkCard>
          <h2 className="text-sm font-semibold text-white mb-1">Distribusi Cluster</h2>
          <p className="text-xs text-white/30 mb-4">
            {analyzing ? "Menganalisis..." : "Hasil K-Means (k=3)"}
          </p>
          <div className="h-56 min-h-[180px]">
            {analyzing ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-red-500/30 border-t-red-500 animate-spin" />
                <p className="text-white/30 text-xs">Analyzing...</p>
              </div>
            ) : clusteredData.length > 0 ? (
              <Doughnut data={donutData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: { color: "rgba(255,255,255,0.5)", font: { size: 11 }, padding: 12 },
                  },
                },
                cutout: "70%",
              }} />
            ) : (
              <div className="flex items-center justify-center h-full text-white/20 text-sm">Belum ada analisis</div>
            )}
          </div>
        </DarkCard>
      </div>

      {/* ── Cluster Stats ──────────────────────────────────────────────────── */}
      {clusterStats.length > 0 && (
        <DarkCard>
          <div className="flex items-center gap-2 mb-4">
            <Layers size={16} className="text-red-400" />
            <h2 className="text-sm font-semibold text-white">Ringkasan Cluster</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {clusterStats.map((s, i) => (
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
                    <span className="text-xs text-white/30">Rata Stok</span>
                    <span className="text-xs font-semibold text-white">{Math.round(s.avgStok).toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-white/30">Hari Dominan</span>
                    <span className="text-xs font-semibold text-white">{s.dominantDay}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DarkCard>
      )}

      {/* ── Forecast ───────────────────────────────────────────────────────── */}
      {forecastChartData && (
        <DarkCard>
          <h2 className="text-sm font-semibold text-white mb-1">Prediksi 7 Hari ke Depan</h2>
          <p className="text-xs text-white/30 mb-4">Berdasarkan analisis K-Means dataset ini</p>
          <div className="h-56 min-h-[180px]">
            <Bar data={forecastChartData} options={{
              ...baseChartOptions,
              plugins: { ...baseChartOptions.plugins, legend: { display: false } },
            }} />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  <th className="p-3 text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Tanggal</th>
                  <th className="p-3 text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Hari</th>
                  <th className="p-3 text-xs font-semibold uppercase tracking-widest text-right"
                    style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Perkiraan</th>
                  <th className="p-3 text-xs font-semibold uppercase tracking-widest text-right"
                    style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Kategori</th>
                  <th className="p-3 text-xs font-semibold uppercase tracking-widest text-right"
                    style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((f, i) => (
                  <tr key={i} className="transition-colors"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td className="p-3 text-sm font-medium text-white">{f.tanggal}</td>
                    <td className="p-3 text-sm text-white/50">{f.hari}</td>
                    <td className="p-3 text-sm font-semibold text-right text-white">{(f.perkiraanTerjual || 0).toLocaleString("id-ID")}</td>
                    <td className="p-3 text-right"><ClusterBadge label={f.kategori} /></td>
                    <td className="p-3 text-right">
                      <span className="text-xs px-2 py-0.5 rounded-md"
                        style={{
                          background: f.tingkatKepercayaan === "Tinggi" ? "rgba(16,185,129,0.12)" : f.tingkatKepercayaan === "Sedang" ? "rgba(251,191,36,0.12)" : "rgba(239,68,68,0.12)",
                          color: f.tingkatKepercayaan === "Tinggi" ? "#34d399" : f.tingkatKepercayaan === "Sedang" ? "#fbbf24" : "#f87171",
                        }}>
                        {f.tingkatKepercayaan}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DarkCard>
      )}

      {/* ── Data Table ─────────────────────────────────────────────────────── */}
      <DarkCard className="p-0 overflow-hidden">
        <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <Database size={16} className="text-red-400" />
            <h2 className="text-sm font-semibold text-white">Data Mentah</h2>
            <span className="text-xs text-white/25">({transactionRows.length.toLocaleString("id-ID")} baris)</span>
          </div>
        </div>
        <div className="overflow-x-auto" style={{ maxHeight: "400px" }}>
          <table className="w-full text-left">
            <thead className="sticky top-0">
              <tr style={{ background: "rgba(15,23,42,0.95)" }}>
                <th className="p-4 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Tanggal</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Hari</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Produk</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-widest text-right"
                  style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Stok</th>
                <th className="p-4 text-xs font-semibold uppercase tracking-widest text-right"
                  style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Terjual</th>
              </tr>
            </thead>
            <tbody>
              {transactionRows.slice(0, 200).map((r, i) => (
                <tr key={i} className="transition-colors"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td className="p-4 text-sm font-medium text-white">{r.tanggal}</td>
                  <td className="p-4 text-sm text-white/50">{r.hari}</td>
                  <td className="p-4 text-sm text-white">{r.nama}</td>
                  <td className="p-4 text-sm text-right text-white/60">{(r.stok || 0).toLocaleString("id-ID")}</td>
                  <td className="p-4 text-sm font-semibold text-right text-white">{(r.terjual || 0).toLocaleString("id-ID")}</td>
                </tr>
              ))}
              {transactionRows.length > 200 && (
                <tr>
                  <td colSpan="5" className="p-4 text-center text-xs text-white/25 italic">
                    Menampilkan 200 dari {transactionRows.length.toLocaleString("id-ID")} baris
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DarkCard>
    </div>
  );
}
