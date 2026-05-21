import React, { useState, useEffect } from "react";
import {
  Clock3, Search, LogIn, Upload, Download, BarChart3, Trash2,
  Eye, FileSpreadsheet, ChevronRight, Activity, RefreshCw, Calendar,
  User, AlertTriangle, Database
} from "lucide-react";
import { fetchActivityLog, fetchDatasets } from "../api/dataService";

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

const ACTIVITY_CONFIG = {
  login:      { icon: LogIn,          accent: "#3b82f6", label: "Login" },
  upload:     { icon: Upload,         accent: "#10b981", label: "Upload Dataset" },
  export:     { icon: Download,       accent: "#f59e0b", label: "Export Data" },
  analyze:    { icon: BarChart3,      accent: "#8b5cf6", label: "Analisis" },
  clear_data: { icon: Trash2,         accent: "#ef4444", label: "Hapus Data" },
  register:   { icon: User,           accent: "#06b6d4", label: "Register" },
  default:    { icon: Activity,       accent: "#6b7280", label: "Aktivitas" },
};

function formatDateTime(isoStr) {
  if (!isoStr) return { date: "-", time: "-", relative: "" };
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  let relative = "";
  if (diffMin < 1) relative = "Baru saja";
  else if (diffMin < 60) relative = `${diffMin} menit lalu`;
  else if (diffHr < 24) relative = `${diffHr} jam lalu`;
  else if (diffDay < 7) relative = `${diffDay} hari lalu`;
  else relative = d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  return {
    date: d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    time: d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    relative,
  };
}

export default function History({ onViewDataset }) {
  const [activities, setActivities] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [activeTab, setActiveTab] = useState("activity");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [actRes, dsRes] = await Promise.all([
        fetchActivityLog(100),
        fetchDatasets(),
      ]);
      setActivities(actRes.activities || []);
      setDatasets(dsRes.datasets || []);
    } catch (err) {
      setError(err.message || "Gagal memuat data riwayat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── Filter activities ──────────────────────────────────────────────────────
  const filteredActivities = activities.filter((a) => {
    if (filterType !== "all" && a.activity_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (a.description || "").toLowerCase().includes(q) ||
        (a.activity_type || "").toLowerCase().includes(q) ||
        (a.metadata?.filename || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── Filter datasets ────────────────────────────────────────────────────────
  const filteredDatasets = datasets.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (d.original_filename || "").toLowerCase().includes(q) ||
      (d.table_name || "").toLowerCase().includes(q)
    );
  });

  const activityTypes = ["all", ...new Set(activities.map((a) => a.activity_type))];

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalLogins = activities.filter((a) => a.activity_type === "login").length;
  const totalUploads = activities.filter((a) => a.activity_type === "upload").length;
  const totalExports = activities.filter((a) => a.activity_type === "export").length;
  const totalDatasets = datasets.length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-red-500/30 border-t-red-500 animate-spin" />
        <p className="text-white/40 text-sm">Memuat riwayat aktivitas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">History</h1>
          <p className="text-white/35 text-sm">Riwayat aktivitas dan dataset yang pernah diupload</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: "rgba(220,38,38,0.15)",
            border: "1px solid rgba(220,38,38,0.3)",
            color: "#fca5a5",
          }}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Login",    value: totalLogins,   icon: LogIn,          accent: "#3b82f6" },
          { label: "Total Upload",   value: totalUploads,  icon: Upload,         accent: "#10b981" },
          { label: "Total Export",   value: totalExports,  icon: Download,       accent: "#f59e0b" },
          { label: "Total Dataset",  value: totalDatasets, icon: Database,       accent: "#8b5cf6" },
        ].map((s) => (
          <DarkCard key={s.label} className="p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${s.accent}18`, border: `1px solid ${s.accent}30` }}>
              <s.icon size={16} style={{ color: s.accent }} />
            </div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{s.label}</p>
            <p className="text-xl font-bold text-white">{s.value}</p>
          </DarkCard>
        ))}
      </div>

      {/* ── Tabs + search ──────────────────────────────────────────────────── */}
      <DarkCard className="p-0 overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            {[
              { key: "activity", label: `Aktivitas (${activities.length})` },
              { key: "datasets", label: `Dataset (${datasets.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={
                  activeTab === tab.key
                    ? { background: "rgba(220,38,38,0.2)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.3)" }
                    : { background: "transparent", color: "rgba(255,255,255,0.35)", border: "1px solid transparent" }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {activeTab === "activity" && (
              <div className="flex gap-1 flex-wrap">
                {activityTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={
                      filterType === type
                        ? { background: "rgba(220,38,38,0.2)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.3)" }
                        : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.06)" }
                    }
                  >
                    {type === "all" ? "Semua" : (ACTIVITY_CONFIG[type]?.label || type)}
                  </button>
                ))}
              </div>
            )}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                type="text"
                placeholder="Cari aktivitas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl text-sm outline-none w-56"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.7)",
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Activity Tab ───────────────────────────────────────────────────── */}
        {activeTab === "activity" && (
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {filteredActivities.length === 0 ? (
              <div className="p-12 text-center">
                <Clock3 size={40} className="mx-auto text-white/15 mb-3" />
                <p className="text-white/25 text-sm">Belum ada riwayat aktivitas</p>
              </div>
            ) : (
              filteredActivities.map((act) => {
                const config = ACTIVITY_CONFIG[act.activity_type] || ACTIVITY_CONFIG.default;
                const dt = formatDateTime(act.created_at);
                const meta = act.metadata || {};
                const Icon = config.icon;
                const hasDatasetDetail = act.activity_type === "upload" && meta.dataset_id;

                return (
                  <div
                    key={act.id}
                    className="flex items-start gap-4 px-6 py-4 transition-colors"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${config.accent}18`, border: `1px solid ${config.accent}30` }}
                    >
                      <Icon size={18} style={{ color: config.accent }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: `${config.accent}18`, color: config.accent, border: `1px solid ${config.accent}30` }}
                        >
                          {config.label}
                        </span>
                        <span className="text-xs text-white/25">{dt.relative}</span>
                      </div>
                      <p className="text-sm text-white/80 mb-1">{act.description}</p>

                      {/* Upload metadata */}
                      {act.activity_type === "upload" && meta.filename && (
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <div className="flex items-center gap-1.5 text-xs text-white/35">
                            <FileSpreadsheet size={12} />
                            <span className="font-medium text-white/50">{meta.filename}</span>
                          </div>
                          {meta.row_count != null && (
                            <span className="text-xs text-white/30">
                              {meta.row_count} baris berhasil
                            </span>
                          )}
                          {meta.error_count > 0 && (
                            <span className="text-xs text-red-400/60">
                              {meta.error_count} error
                            </span>
                          )}
                          {meta.unique_products != null && (
                            <span className="text-xs text-white/30">
                              {meta.unique_products} produk unik
                            </span>
                          )}
                        </div>
                      )}

                      {/* Timestamp detail */}
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-white/20">
                        <Calendar size={11} />
                        <span>{dt.date}</span>
                        <span>•</span>
                        <Clock3 size={11} />
                        <span>{dt.time}</span>
                      </div>
                    </div>

                    {/* View Detail button for uploads */}
                    {hasDatasetDetail && onViewDataset && (
                      <button
                        onClick={() => onViewDataset(meta.dataset_id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all flex-shrink-0 self-center"
                        style={{
                          background: "rgba(16,185,129,0.12)",
                          border: "1px solid rgba(16,185,129,0.25)",
                          color: "#34d399",
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = "rgba(16,185,129,0.2)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = "rgba(16,185,129,0.12)";
                        }}
                      >
                        <Eye size={13} />
                        View Detail
                        <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Datasets Tab ───────────────────────────────────────────────────── */}
        {activeTab === "datasets" && (
          <div className="overflow-x-auto">
            {filteredDatasets.length === 0 ? (
              <div className="p-12 text-center">
                <Database size={40} className="mx-auto text-white/15 mb-3" />
                <p className="text-white/25 text-sm">Belum ada dataset yang diupload</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                    <th className="p-4 text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Nama File</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Tanggal Upload</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-widest text-right"
                      style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Baris</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-widest text-right"
                      style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Produk Unik</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Rentang</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-widest text-center"
                      style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDatasets.map((ds) => {
                    const dt = formatDateTime(ds.created_at);
                    return (
                      <tr key={ds.id} className="transition-colors"
                        style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet size={16} className="text-green-400/60" />
                            <span className="text-sm font-medium text-white">{ds.original_filename}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm text-white/50">{dt.relative}</div>
                          <div className="text-[11px] text-white/25 mt-0.5">{dt.time}</div>
                        </td>
                        <td className="p-4 text-sm font-semibold text-right text-white">{(ds.row_count || 0).toLocaleString("id-ID")}</td>
                        <td className="p-4 text-sm text-right text-white/50">{ds.unique_products || 0}</td>
                        <td className="p-4 text-xs text-white/35">
                          {ds.date_range_start && ds.date_range_end
                            ? `${ds.date_range_start} — ${ds.date_range_end}`
                            : "—"}
                        </td>
                        <td className="p-4 text-center">
                          {onViewDataset && (
                            <button
                              onClick={() => onViewDataset(ds.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                              style={{
                                background: "rgba(16,185,129,0.12)",
                                border: "1px solid rgba(16,185,129,0.25)",
                                color: "#34d399",
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = "rgba(16,185,129,0.2)";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = "rgba(16,185,129,0.12)";
                              }}
                            >
                              <Eye size={12} />
                              Detail
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </DarkCard>
    </div>
  );
}