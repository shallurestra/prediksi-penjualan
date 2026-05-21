import React, { useState, useEffect } from "react";
import { 
  Sparkles, TrendingUp, Layers, Sliders, Database, 
  Calendar, ChevronDown, ChevronUp, AlertCircle, Info, Download
} from "lucide-react";
import { fetchDatasets, fetchForecastPeriod, fetchDatasetForecastPeriod } from "../api/dataService";
import { formatNumber, inferProductCategory } from "../components/shared/helpers";
import { DAYS_ORDER } from "../components/shared/constants";

// ─── Shared Premium Cards ──────────────────────────────────────────────────
function DarkCard({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-2xl p-6 ${className}`}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Cluster Badges ────────────────────────────────────────────────────────
const CLUSTER_CONFIG = {
  Tinggi: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#34d399", desc: "Permintaan Tinggi (Prioritas Stok Utama)" },
  Sedang: { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)", text: "#fbbf24", desc: "Permintaan Sedang (Stok Standar)" },
  Rendah: { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)",  text: "#f87171", desc: "Permintaan Rendah (Stok Aman Minim)" },
};

function ClusterBadge({ label }) {
  const cfg = CLUSTER_CONFIG[label] || CLUSTER_CONFIG["Sedang"];
  return (
    <span 
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}
    >
      {label}
    </span>
  );
}

export default function Planner({ clusteredData = [], transactionRows = [], preprocessSummary = null }) {
  const [activeTab, setActiveTab] = useState("patterns"); // "patterns" | "simulator"
  const [expandedDay, setExpandedDay] = useState(null); // String of day name
  
  // Simulator States
  const [datasetsList, setDatasetsList] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("main"); // "main" | datasetId
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bufferPercent, setBufferPercent] = useState(15);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState("");
  const [simulationResults, setSimulationResults] = useState(null);
  const [expandedSimDay, setExpandedSimDay] = useState(null); // Index of day in sim

  // Load datasets list for simulator selection dropdown
  useEffect(() => {
    fetchDatasets()
      .then((data) => {
        if (data && data.datasets) {
          setDatasetsList(data.datasets);
        }
      })
      .catch((err) => console.error("Gagal memuat dataset list:", err));
  }, []);

  // Set default dates based on history dates or current time
  useEffect(() => {
    let baseDate = new Date();
    if (preprocessSummary && preprocessSummary.endDate) {
      baseDate = new Date(preprocessSummary.endDate);
    }
    
    // Default start date = baseDate + 1 day
    const start = new Date(baseDate);
    start.setDate(start.getDate() + 1);
    
    // Default end date = baseDate + 7 days
    const end = new Date(baseDate);
    end.setDate(end.getDate() + 7);
    
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  }, [preprocessSummary]);

  // ── Tab 1: Day of Week Pattern Profiling ───────────────────────────────────
  // Aggregated details per day of week
  const dayPatterns = DAYS_ORDER.map((day) => {
    const dayRows = clusteredData.filter((item) => item.hari === day);
    if (dayRows.length === 0) return null;
    
    const counts = { Rendah: 0, Sedang: 0, Tinggi: 0 };
    dayRows.forEach((item) => {
      if (item.cluster in counts) counts[item.cluster]++;
    });
    
    // Find dominant cluster
    const dominantCluster = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    
    // Calculate average stock and sales
    const avgStock = Math.round(dayRows.reduce((s, i) => s + i.Total_Stok, 0) / dayRows.length);
    const avgSold = Math.round(dayRows.reduce((s, i) => s + i.Total_Terjual, 0) / dayRows.length);
    const ratio = avgStock > 0 ? (avgSold / avgStock) : 0;
    
    // Aggregated product details for this day of week
    const pRows = transactionRows.filter((t) => t.hari === day);
    const productMap = {};
    pRows.forEach((t) => {
      const pName = t.nama_produk || t.nama;
      if (!pName) return;
      if (!productMap[pName]) {
        productMap[pName] = {
          nama: pName,
          kategori: t.kategoriProduk || inferProductCategory(pName),
          totalTerjual: 0,
          totalStok: 0,
          count: 0
        };
      }
      productMap[pName].totalTerjual += t.terjual || 0;
      productMap[pName].totalStok += t.stok || 0;
      productMap[pName].count += 1;
    });
    
    const topProducts = Object.values(productMap)
      .map((p) => ({
        nama: p.nama,
        kategori: p.kategori,
        avgTerjual: Math.round(p.totalTerjual / p.count),
        avgStok: Math.round(p.totalStok / p.count),
      }))
      .sort((a, b) => b.avgTerjual - a.avgTerjual)
      .slice(0, 5);
      
    return {
      hari: day,
      jumlahSampel: dayRows.length,
      dominantCluster,
      avgStock,
      avgSold,
      ratio,
      topProducts,
    };
  }).filter(Boolean);

  // ── Tab 2: Run Custom Period Simulator ─────────────────────────────────────
  const handleRunSimulation = async () => {
    if (!startDate || !endDate) {
      setSimulationError("Harap masukkan tanggal mulai dan selesai simulasi.");
      return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = (end - start) / (1000 * 60 * 60 * 24) + 1;
    
    if (diff <= 0) {
      setSimulationError("Tanggal selesai harus setelah atau sama dengan tanggal mulai.");
      return;
    }
    
    if (diff > 31) {
      setSimulationError("Maksimum periode simulasi adalah 31 hari agar hasil tetap akurat.");
      return;
    }
    
    setSimulationLoading(true);
    setSimulationError("");
    setSimulationResults(null);
    setExpandedSimDay(null);
    
    try {
      let response;
      if (selectedDataset === "main") {
        response = await fetchForecastPeriod(startDate, endDate);
      } else {
        response = await fetchDatasetForecastPeriod(selectedDataset, startDate, endDate);
      }
      
      if (!response || !response.forecasts) {
        throw new Error("Format output prediksi tidak valid dari server.");
      }
      
      // Calculate simulation summary
      const forecasts = response.forecasts;
      let totalExpectedSales = 0;
      let totalRecommendedStock = 0;
      const confidenceScores = { Tinggi: 0, Sedang: 0, Rendah: 0 };
      
      // Aggregate product-level needs over the entire period
      const aggregateProducts = {};
      
      forecasts.forEach((day) => {
        totalExpectedSales += day.perkiraanTerjual || 0;
        
        // Recommended stock with user's customized buffer percentage
        const dayStockBase = day.rekomendasiStok || 0;
        const dayStockBuffered = Math.round(dayStockBase * (1 + bufferPercent / 100));
        totalRecommendedStock += dayStockBuffered;
        
        confidenceScores[day.tingkatKepercayaan || "Sedang"]++;
        
        // Aggregate products
        if (day.rekomendasiProduk) {
          day.rekomendasiProduk.forEach((p) => {
            if (!aggregateProducts[p.nama]) {
              aggregateProducts[p.nama] = {
                nama: p.nama,
                kategoriProduk: p.kategoriProduk,
                totalTerjualBase: 0,
                totalStokBase: 0,
                totalStokBuffered: 0,
                daysActive: 0
              };
            }
            aggregateProducts[p.nama].totalTerjualBase += p.rataRataTerjualProduk || 0;
            aggregateProducts[p.nama].totalStokBase += p.rekomendasiStokProduk || 0;
            aggregateProducts[p.nama].totalStokBuffered += Math.round((p.rekomendasiStokProduk || 0) * (1 + bufferPercent / 100));
            aggregateProducts[p.nama].daysActive++;
          });
        }
      });
      
      // Sort confidence
      const overallConfidence = Object.entries(confidenceScores).sort((a, b) => b[1] - a[1])[0][0];
      
      setSimulationResults({
        forecasts,
        totalExpectedSales,
        totalRecommendedStock,
        overallConfidence,
        aggregateProducts: Object.values(aggregateProducts).sort((a, b) => b.totalStokBuffered - a.totalStokBuffered),
        daysCount: diff
      });
      
    } catch (err) {
      setSimulationError(err.message || "Gagal memproses simulasi prediksi.");
    } finally {
      setSimulationLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-1">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Sparkles className="text-red-400" size={24} />
            Perencanaan & Pola Stok
          </h1>
          <p className="text-white/35 text-sm">
            Dasar pengambilan keputusan penentuan jumlah produksi harian berdasarkan pola K-Means
          </p>
        </div>
      </div>

      {/* ── Navigation Tabs ────────────────────────────────────────────────── */}
      <div className="flex border-b border-white/5 gap-2">
        <button
          onClick={() => setActiveTab("patterns")}
          className="px-5 py-3 text-sm font-semibold relative transition-all duration-200"
          style={{
            color: activeTab === "patterns" ? "#fca5a5" : "rgba(255,255,255,0.4)"
          }}
        >
          {activeTab === "patterns" && (
            <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-red-500 rounded-full" />
          )}
          <span className="flex items-center gap-2">
            <Layers size={15} />
            Pola Permintaan Harian
          </span>
        </button>
        <button
          onClick={() => setActiveTab("simulator")}
          className="px-5 py-3 text-sm font-semibold relative transition-all duration-200"
          style={{
            color: activeTab === "simulator" ? "#fca5a5" : "rgba(255,255,255,0.4)"
          }}
        >
          {activeTab === "simulator" && (
            <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-red-500 rounded-full" />
          )}
          <span className="flex items-center gap-2">
            <Sliders size={15} />
            Simulator Rencana Stok
          </span>
        </button>
      </div>

      {/* ── TAB CONTENT ── */}
      
      {/* ── TAB 1: DAILY PATTERNS ── */}
      {activeTab === "patterns" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DarkCard className="p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 flex-shrink-0">
                <TrendingUp size={20} />
              </div>
              <div>
                <h3 className="text-xs text-white/30 uppercase tracking-widest mb-1">Hari Cluster Tinggi</h3>
                <p className="text-xl font-bold text-white">
                  {dayPatterns.filter((p) => p.dominantCluster === "Tinggi").map((p) => p.hari).join(", ") || "—"}
                </p>
                <p className="text-xs text-white/30 mt-1">Disarankan stok maksimal (buffer produksi +30%)</p>
              </div>
            </DarkCard>
            <DarkCard className="p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Layers size={20} />
              </div>
              <div>
                <h3 className="text-xs text-white/30 uppercase tracking-widest mb-1">Hari Cluster Sedang</h3>
                <p className="text-xl font-bold text-white">
                  {dayPatterns.filter((p) => p.dominantCluster === "Sedang").map((p) => p.hari).join(", ") || "—"}
                </p>
                <p className="text-xs text-white/30 mt-1">Gunakan volume stok standar rata-rata historis harian</p>
              </div>
            </DarkCard>
            <DarkCard className="p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 flex-shrink-0">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-xs text-white/30 uppercase tracking-widest mb-1">Hari Cluster Rendah</h3>
                <p className="text-xl font-bold text-white">
                  {dayPatterns.filter((p) => p.dominantCluster === "Rendah").map((p) => p.hari).join(", ") || "—"}
                </p>
                <p className="text-xs text-white/30 mt-1">Tekan stok minimum (-20%) untuk cegah sisa/overstock</p>
              </div>
            </DarkCard>
          </div>

          <DarkCard className="p-0 overflow-hidden">
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Matriks Profil & Rekomendasi Stok per Hari</h2>
              <span className="text-xs text-white/20">Klik baris hari untuk detail rekomendasi produk</span>
            </div>
            
            <div className="divide-y divide-white/5">
              {dayPatterns.map((dp) => {
                const isOpen = expandedDay === dp.hari;
                return (
                  <div key={dp.hari} className="transition-all duration-200">
                    {/* Header Row */}
                    <div 
                      onClick={() => setExpandedDay(isOpen ? null : dp.hari)}
                      className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-base font-bold text-white w-24">{dp.hari}</span>
                        <ClusterBadge label={dp.dominantCluster} />
                      </div>
                      
                      <div className="flex items-center gap-8 text-right hidden sm:flex">
                        <div>
                          <span className="text-[10px] text-white/20 uppercase block">Sampel Hari</span>
                          <span className="text-sm font-semibold text-white">{dp.jumlahSampel} Kali</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-white/20 uppercase block">Rata Terjual</span>
                          <span className="text-sm font-semibold text-red-400">{formatNumber(dp.avgSold)} unit</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-white/20 uppercase block">Rata Stok</span>
                          <span className="text-sm font-semibold text-white/60">{formatNumber(dp.avgStock)} unit</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-white/20 uppercase block">Rasio Jual</span>
                          <span className="text-sm font-semibold text-green-400">{(dp.ratio * 100).toFixed(1)}%</span>
                        </div>
                      </div>

                      <div className="text-white/30 ml-4">
                        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isOpen && (
                      <div className="px-6 pb-6 pt-2 bg-black/20 border-t border-white/[0.02]">
                        <div className="mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                          <Info size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-white/50 leading-relaxed">
                            <strong>Analisis Operasional Hari {dp.hari}:</strong> Hari ini didominasi oleh tingkat penjualan 
                            <span className="text-white font-semibold"> {dp.dominantCluster}</span>. 
                            {dp.dominantCluster === "Tinggi" && " Sangat disarankan meningkatkan volume stok harian minimal 30% dari rata-rata penjualan normal untuk meraup profit optimal dan menghindari hilangnya calon pembeli akibat stok habis."}
                            {dp.dominantCluster === "Sedang" && " Volume penjualan cenderung stabil. Cukup pertahankan ketersediaan stok standar agar tidak terjadi kekosongan atau penumpukan produk berlebih."}
                            {dp.dominantCluster === "Rendah" && " Penjualan di hari ini tergolong rendah. Disarankan menekan porsi produksi/stok produk harian sebesar 20% agar modal kerja tidak mengendap dalam bentuk barang tidak laku."}
                          </p>
                        </div>

                        <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Rekomendasi Distribusi Stok per Produk (Top 5)</h4>
                        
                        <div className="overflow-x-auto rounded-xl border border-white/5">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                                <th className="p-3 text-[10px] uppercase font-bold text-white/30">Nama Produk</th>
                                <th className="p-3 text-[10px] uppercase font-bold text-white/30">Kategori</th>
                                <th className="p-3 text-[10px] uppercase font-bold text-white/30 text-right">Rata Terjual Historis</th>
                                <th className="p-3 text-[10px] uppercase font-bold text-white/30 text-right">Saran Stok Harian</th>
                                <th className="p-3 text-[10px] uppercase font-bold text-white/30 text-center">Status Produksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {dp.topProducts.map((p, idx) => {
                                // Determine modified recommended stock based on day cluster
                                let multiplier = 1.0;
                                let tip = "Volume Standar";
                                let badgeColor = "rgba(251,191,36,0.12)";
                                let textColor = "#fbbf24";
                                
                                if (dp.dominantCluster === "Tinggi") {
                                  multiplier = 1.3;
                                  tip = "Tingkatkan +30%";
                                  badgeColor = "rgba(16,185,129,0.12)";
                                  textColor = "#34d399";
                                } else if (dp.dominantCluster === "Rendah") {
                                  multiplier = 0.8;
                                  tip = "Kurangi -20%";
                                  badgeColor = "rgba(239,68,68,0.12)";
                                  textColor = "#f87171";
                                }
                                
                                const finalRecStock = Math.round(p.avgStok * multiplier);

                                return (
                                  <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                                    <td className="p-3 text-sm font-semibold text-white">{p.nama}</td>
                                    <td className="p-3 text-xs text-white/40">{p.kategori}</td>
                                    <td className="p-3 text-sm font-medium text-white/60 text-right">{p.avgTerjual} unit</td>
                                    <td className="p-3 text-sm font-bold text-red-400 text-right">{finalRecStock} unit</td>
                                    <td className="p-3 text-center">
                                      <span 
                                        className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold"
                                        style={{ background: badgeColor, color: textColor }}
                                      >
                                        {tip}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </DarkCard>
        </div>
      )}

      {/* ── TAB 2: INTERACTIVE SIMULATOR ── */}
      {activeTab === "simulator" && (
        <div className="space-y-6">
          <DarkCard className="p-6">
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Sliders size={18} className="text-red-400" />
              Konfigurasi Parameter Perencanaan
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Basis Dataset Dropdown */}
              <div className="space-y-2">
                <label className="text-xs text-white/40 font-semibold uppercase tracking-wider block">
                  Pilih Basis Data Analisis
                </label>
                <div className="relative">
                  <Database size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <select
                    value={selectedDataset}
                    onChange={(e) => setSelectedDataset(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none cursor-pointer appearance-none"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.8)",
                    }}
                  >
                    <option value="main" className="bg-slate-900 text-white">Seluruh Data (Penjualan Utama)</option>
                    {datasetsList.map((ds) => (
                      <option key={ds.id} value={ds.id} className="bg-slate-900 text-white">
                        {ds.original_filename} ({ds.row_count} baris)
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
              </div>

              {/* Date Pickers */}
              <div className="space-y-2">
                <label className="text-xs text-white/40 font-semibold uppercase tracking-wider block">
                  Rentang Tanggal Perencanaan
                </label>
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full pl-9 pr-2 py-2.5 rounded-xl text-sm outline-none"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.8)",
                      }}
                    />
                  </div>
                  <span className="text-white/30 text-xs">s/d</span>
                  <div className="relative flex-1">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full pl-9 pr-2 py-2.5 rounded-xl text-sm outline-none"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.8)",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Buffer Stock Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-white/40 font-semibold uppercase tracking-wider block">
                    Buffer Stok Keamanan (Safety Stock)
                  </label>
                  <span className="text-xs font-bold text-red-400">+{bufferPercent}%</span>
                </div>
                <div className="pt-2">
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={bufferPercent}
                    onChange={(e) => setBufferPercent(parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                  <div className="flex justify-between text-[10px] text-white/20 mt-1">
                    <span>0% (Strict)</span>
                    <span>25% (Rekomendasi)</span>
                    <span>50% (Maksimal)</span>
                  </div>
                </div>
              </div>
            </div>

            {simulationError && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 text-xs">
                <AlertCircle size={15} />
                <span>{simulationError}</span>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleRunSimulation}
                disabled={simulationLoading}
                className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all flex items-center gap-2"
                style={{
                  background: simulationLoading 
                    ? "rgba(255,255,255,0.1)" 
                    : "linear-gradient(90deg, #dc2626 0%, #ef4444 100%)",
                  boxShadow: simulationLoading ? "none" : "0 4px 15px rgba(239, 68, 68, 0.25)",
                  cursor: simulationLoading ? "not-allowed" : "pointer"
                }}
              >
                {simulationLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Memproses Simulasi...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Jalankan Simulasi Perencanaan
                  </>
                )}
              </button>
            </div>
          </DarkCard>

          {/* SIMULATION RESULTS */}
          {simulationResults && (
            <div className="space-y-6 animate-fadeIn">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <DarkCard className="p-5">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Durasi Periode</p>
                  <p className="text-2xl font-bold text-white">{simulationResults.daysCount} Hari</p>
                  <p className="text-[11px] text-white/20 mt-1">Tanggal terpilih</p>
                </DarkCard>
                <DarkCard className="p-5">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Total Estimasi Terjual</p>
                  <p className="text-2xl font-bold text-red-400">{formatNumber(simulationResults.totalExpectedSales)} unit</p>
                  <p className="text-[11px] text-white/20 mt-1">Akumulasi penjualan</p>
                </DarkCard>
                <DarkCard className="p-5">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Saran Produksi Total</p>
                  <p className="text-2xl font-bold text-green-400">{formatNumber(simulationResults.totalRecommendedStock)} unit</p>
                  <p className="text-[11px] text-white/30 mt-1">Termasuk safety stock +{bufferPercent}%</p>
                </DarkCard>
                <DarkCard className="p-5">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Kepercayaan Model</p>
                  <p className="text-2xl font-bold text-amber-400">{simulationResults.overallConfidence}</p>
                  <p className="text-[11px] text-white/20 mt-1">Keakuratan data historis</p>
                </DarkCard>
              </div>

              {/* Aggregate Production Recipe Table */}
              <DarkCard className="p-0 overflow-hidden">
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Rencana Kebutuhan Produksi Agregat</h2>
                    <p className="text-xs text-white/30 mt-0.5">
                      Jumlah total stok per produk yang wajib disiapkan selama periode {startDate} s/d {endDate} (termasuk buffer)
                    </p>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                        <th className="p-4 text-xs font-semibold uppercase tracking-widest text-white/40">Nama Produk</th>
                        <th className="p-4 text-xs font-semibold uppercase tracking-widest text-white/40">Kategori</th>
                        <th className="p-4 text-xs font-semibold uppercase tracking-widest text-white/40 text-right">Rata Penjualan Pokok</th>
                        <th className="p-4 text-xs font-semibold uppercase tracking-widest text-white/40 text-right">Porsi Safety Stock</th>
                        <th className="p-4 text-xs font-semibold uppercase tracking-widest text-white/40 text-right">Rekomendasi Produksi Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {simulationResults.aggregateProducts.map((p, idx) => {
                        const bufferUnits = p.totalStokBuffered - p.totalStokBase;
                        return (
                          <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                            <td className="p-4 text-sm font-bold text-white">{p.nama}</td>
                            <td className="p-4 text-xs text-white/45">{p.kategoriProduk}</td>
                            <td className="p-4 text-sm text-white/60 text-right">{formatNumber(p.totalStokBase)} unit</td>
                            <td className="p-4 text-sm text-red-300 text-right">+{formatNumber(bufferUnits)} unit</td>
                            <td className="p-4 text-sm font-bold text-green-400 text-right">{formatNumber(p.totalStokBuffered)} unit</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </DarkCard>

              {/* Day-by-Day Forecast Breakdown Accordions */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest px-1">
                  Rincian Rencana Produksi Harian
                </h3>
                
                {simulationResults.forecasts.map((day, idx) => {
                  const isOpen = expandedSimDay === idx;
                  const dayStockBuffered = Math.round((day.rekomendasiStok || 0) * (1 + bufferPercent / 100));
                  
                  return (
                    <DarkCard key={idx} className="p-0 overflow-hidden transition-all duration-200">
                      <div 
                        onClick={() => setExpandedSimDay(isOpen ? null : idx)}
                        className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
                      >
                        <div className="flex items-center gap-6">
                          <span className="text-sm font-bold text-white w-24">
                            {day.hari}, {day.tanggal.split("-").reverse().join("/")}
                          </span>
                          <ClusterBadge label={day.kategori} />
                        </div>
                        
                        <div className="flex items-center gap-6 hidden sm:flex">
                          <div className="text-right">
                            <span className="text-[10px] text-white/20 uppercase block">Prediksi Terjual</span>
                            <span className="text-xs font-semibold text-white/70">{day.perkiraanTerjual} unit</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-white/20 uppercase block">Rekomendasi Produksi (+{bufferPercent}%)</span>
                            <span className="text-xs font-bold text-red-400">{dayStockBuffered} unit</span>
                          </div>
                        </div>

                        <div className="text-white/30 ml-4">
                          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>

                      {isOpen && (
                        <div className="px-6 pb-6 pt-3 bg-black/20 border-t border-white/[0.02] space-y-4">
                          <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 text-[11px] text-white/40 leading-relaxed">
                            <strong>Metode Prediksi Model:</strong> {day.dasarPerkiraan} 
                            (Kepercayaan: <span className="text-amber-400">{day.tingkatKepercayaan}</span>)
                          </div>

                          <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-wider">
                            Rekomendasi per Produk Harian
                          </h4>

                          <div className="overflow-x-auto rounded-lg border border-white/5">
                            <table className="w-full text-left">
                              <thead>
                                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                                  <th className="p-2.5 text-[9px] uppercase font-bold text-white/30">Nama Produk</th>
                                  <th className="p-2.5 text-[9px] uppercase font-bold text-white/30 text-right">Rata Terjual</th>
                                  <th className="p-2.5 text-[9px] uppercase font-bold text-white/30 text-right">Stok Pokok</th>
                                  <th className="p-2.5 text-[9px] uppercase font-bold text-white/30 text-right font-bold">Stok Saran (+{bufferPercent}%)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {day.rekomendasiProduk && day.rekomendasiProduk.map((p, pIdx) => {
                                  const prodStockBase = p.rekomendasiStokProduk || 0;
                                  const prodStockBuffered = Math.round(prodStockBase * (1 + bufferPercent / 100));
                                  return (
                                    <tr key={pIdx} className="hover:bg-white/[0.01]">
                                      <td className="p-2.5 text-xs font-semibold text-white">{p.nama}</td>
                                      <td className="p-2.5 text-xs text-white/50 text-right">{p.rataRataTerjualProduk} unit</td>
                                      <td className="p-2.5 text-xs text-white/50 text-right">{prodStockBase} unit</td>
                                      <td className="p-2.5 text-xs font-bold text-green-400 text-right">{prodStockBuffered} unit</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </DarkCard>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
