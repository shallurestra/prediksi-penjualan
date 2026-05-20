import React, { useState } from "react";
import { Clock3, Download, Search, ChevronUp, ChevronDown, TrendingUp, Package, Calendar, Layers } from "lucide-react";

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

export default function History({ transactionRows, dailyAggregated, onExport }) {
  const [search, setSearch]       = useState("");
  const [activeTab, setActiveTab] = useState("daily");
  const [sortField, setSortField] = useState("tanggal");
  const [sortDir, setSortDir]     = useState("desc");

  if (!transactionRows || transactionRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)" }}>
          <Clock3 size={28} className="text-red-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-1">Belum ada Riwayat Data</h3>
          <p className="text-white/35 text-sm">Data akan muncul setelah berhasil dimuat dari server.</p>
        </div>
      </div>
    );
  }

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }) => sortField === field
    ? (sortDir === "asc" ? <ChevronUp size={12} className="text-red-400" /> : <ChevronDown size={12} className="text-red-400" />)
    : <ChevronUp size={12} className="text-white/20" />;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalTerjual   = transactionRows.reduce((s, r) => s + r.terjual, 0);
  const totalStok      = transactionRows.reduce((s, r) => s + r.stok, 0);
  const uniqueDates    = new Set(transactionRows.map((r) => r.tanggal)).size;
  const uniqueProducts = new Set(transactionRows.map((r) => r.nama)).size;

  // ── Filtered daily ─────────────────────────────────────────────────────────
  const filteredDaily = dailyAggregated
    .filter((d) =>
      d.tanggal.toLowerCase().includes(search.toLowerCase()) ||
      d.hari.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (typeof va === "string") { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  // ── Filtered products ──────────────────────────────────────────────────────
  const filteredProducts = transactionRows
    .filter((d) =>
      d.nama.toLowerCase().includes(search.toLowerCase()) ||
      (d.kategoriProduk || "").toLowerCase().includes(search.toLowerCase()) ||
      d.tanggal.toLowerCase().includes(search.toLowerCase()) ||
      (d.hari || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const fieldMap = { tanggal: "tanggal", hari: "hari", nama: "nama", terjual: "terjual", stok: "stok" };
      const f = fieldMap[sortField] || "tanggal";
      let va = a[f], vb = b[f];
      if (typeof va === "string") { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const ThCell = ({ field, children, right }) => (
    <th
      onClick={() => handleSort(field)}
      className={`p-4 text-xs font-semibold uppercase tracking-widest cursor-pointer select-none ${right ? "text-right" : ""}`}
      style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className={`flex items-center gap-1 ${right ? "justify-end" : ""}`}>{children}<SortIcon field={field} /></div>
    </th>
  );

  return (
    <div className="space-y-6 p-1">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">History</h1>
          <p className="text-white/35 text-sm">Riwayat seluruh data penjualan historis</p>
        </div>
        {onExport && (
          <button onClick={onExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", color: "#fca5a5" }}>
            <Download size={15} /> Export Excel
          </button>
        )}
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Transaksi",  value: transactionRows.length.toLocaleString("id-ID"), icon: Layers,     accent: "#8b5cf6" },
          { label: "Hari Unik",        value: uniqueDates,                                     icon: Calendar,   accent: "#3b82f6" },
          { label: "Total Terjual",    value: totalTerjual.toLocaleString("id-ID"),            icon: TrendingUp, accent: "#10b981" },
          { label: "Total Stok",       value: totalStok.toLocaleString("id-ID"),               icon: Package,    accent: "#f59e0b" },
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

      {/* ── Table card ─────────────────────────────────────────────────────── */}
      <DarkCard className="p-0 overflow-hidden">
        {/* Tabs + search */}
        <div className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            {[
              { key: "daily",    label: `Data Harian (${dailyAggregated.length})` },
              { key: "products", label: `Data Produk (${transactionRows.length.toLocaleString("id-ID")})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSortField(tab.key === "daily" ? "tanggal" : "terjual"); setSortDir("desc"); }}
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
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              type="text"
              placeholder={activeTab === "daily" ? "Cari tanggal / hari..." : "Cari produk / tanggal..."}
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

        {/* Table */}
        <div className="overflow-x-auto">
          {activeTab === "daily" ? (
            <table className="w-full text-left">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  <ThCell field="tanggal">Tanggal</ThCell>
                  <ThCell field="hari">Hari</ThCell>
                  <ThCell field="Total_Stok" right>Total Stok</ThCell>
                  <ThCell field="Total_Terjual" right>Total Terjual</ThCell>
                  <ThCell field="Jumlah_Produk" right>Jml Produk</ThCell>
                  <th className="p-4 text-xs font-semibold uppercase tracking-widest text-right"
                    style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Rasio</th>
                </tr>
              </thead>
              <tbody>
                {filteredDaily.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-white/25 text-sm italic">Data tidak ditemukan</td></tr>
                ) : filteredDaily.map((r, i) => {
                  const rasio = r.Total_Stok > 0 ? (r.Total_Terjual / r.Total_Stok) : 0;
                  const rasioColor = rasio >= 0.7 ? "#34d399" : rasio >= 0.4 ? "#fbbf24" : "#f87171";
                  return (
                    <tr key={i} className="transition-colors"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td className="p-4 text-sm font-medium text-white">{r.tanggal}</td>
                      <td className="p-4 text-sm text-white/50">{r.hari}</td>
                      <td className="p-4 text-sm font-semibold text-right text-white/70">{r.Total_Stok.toLocaleString("id-ID")}</td>
                      <td className="p-4 text-sm font-semibold text-right text-white">{r.Total_Terjual.toLocaleString("id-ID")}</td>
                      <td className="p-4 text-sm text-right text-white/50">{r.Jumlah_Produk}</td>
                      <td className="p-4 text-sm font-bold text-right" style={{ color: rasioColor }}>
                        {r.Total_Stok > 0 ? `${(rasio * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  <ThCell field="tanggal">Tanggal</ThCell>
                  <ThCell field="hari">Hari</ThCell>
                  <ThCell field="nama">Nama Produk</ThCell>
                  <th className="p-4 text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Kategori</th>
                  <ThCell field="stok" right>Stok</ThCell>
                  <ThCell field="terjual" right>Terjual</ThCell>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-white/25 text-sm italic">Data tidak ditemukan</td></tr>
                ) : filteredProducts.slice(0, 500).map((r, i) => (
                  <tr key={i} className="transition-colors"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td className="p-4 text-sm font-medium text-white">{r.tanggal}</td>
                    <td className="p-4 text-sm text-white/50">{r.hari}</td>
                    <td className="p-4 text-sm text-white">{r.nama}</td>
                    <td className="p-4 text-xs text-white/35">{r.kategoriProduk}</td>
                    <td className="p-4 text-sm text-right text-white/60">{r.stok.toLocaleString("id-ID")}</td>
                    <td className="p-4 text-sm font-semibold text-right text-white">{r.terjual.toLocaleString("id-ID")}</td>
                  </tr>
                ))}
                {filteredProducts.length > 500 && (
                  <tr>
                    <td colSpan="6" className="p-4 text-center text-xs text-white/25 italic">
                      Menampilkan 500 dari {filteredProducts.length.toLocaleString("id-ID")} baris. Gunakan pencarian untuk mempersempit hasil.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </DarkCard>
    </div>
  );
}