import {
  DAYS_ORDER, STORAGE_KEY, STORAGE_VERSION,
  CLUSTER_BADGE_CLASSES, CONFIDENCE_BADGE_CLASSES, FORECAST_LIMITATIONS,
} from "./constants";

// ── Formatting ────────────────────────────────────────────────────────────────
export function formatNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

export function toTitleCase(value) {
  return String(value || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(" ");
}

export function getClusterBadgeClasses(label) {
  return CLUSTER_BADGE_CLASSES[label] || "bg-slate-100 text-slate-700";
}

export function getConfidenceBadgeClasses(level) {
  return CONFIDENCE_BADGE_CLASSES[level] || "bg-slate-100 text-slate-700";
}

// ── Product category inference ────────────────────────────────────────────────
export function inferProductCategory(productName) {
  const raw = String(productName || "").trim();
  if (!raw) return "Lainnya";
  const first = raw.toUpperCase().split(/\s+/)[0];
  const MAP = {
    GETUK: "Getuk", MENDOAN: "Mendoan", DAGE: "Dage", GHOSTING: "Ghosting",
    JAHAT: "Jahat", JUMBO: "Jumbo", MEDIUM: "Medium", MEGA: "Mega",
    MOZARELLA: "Mozarella", RAKSASA: "Raksasa", SACU: "Sacu",
    SMALL: "Small", SUPER: "Super Jumbo", FREE: "Free Man",
  };
  return MAP[first] || toTitleCase(first);
}

// ── Forecast helpers ──────────────────────────────────────────────────────────
export function classifyForecastConfidence(sampleCount, dominantRatio) {
  if (sampleCount >= 8 && dominantRatio >= 0.60) return "Tinggi";
  if (sampleCount >= 4 && dominantRatio >= 0.45) return "Sedang";
  return "Rendah";
}

export function describeForecastBasis(dayName, demandLevel, sampleCount, dominantCount, dominantRatio) {
  return `Berdasarkan ${sampleCount} data historis hari ${dayName}, kategori dominan ${demandLevel} muncul ${dominantCount} kali (${(dominantRatio * 100).toFixed(1)}% dari riwayat hari yang sama).`;
}

export function buildForecastSummary(futureForecasts) {
  if (!futureForecasts || futureForecasts.length === 0) return null;
  const rows = futureForecasts.map((item) => ({
    ...item,
    perkiraanTerjualNumber: Number(item.perkiraanTerjual),
    rekomendasiStokNumber: Number(item.rekomendasiStok),
  }));
  const totalPredicted = rows.reduce((s, i) => s + i.perkiraanTerjualNumber, 0);
  const highest = rows.reduce((b, c) => c.perkiraanTerjualNumber > b.perkiraanTerjualNumber ? c : b);
  const lowest  = rows.reduce((b, c) => c.perkiraanTerjualNumber < b.perkiraanTerjualNumber ? c : b);
  const confidenceCounts = { Rendah: 0, Sedang: 0, Tinggi: 0 };
  rows.forEach((i) => { if (i.tingkatKepercayaan in confidenceCounts) confidenceCounts[i.tingkatKepercayaan]++; });
  return { totalPredicted, averagePredicted: totalPredicted / rows.length, highest, lowest, confidenceCounts };
}

// ── Aggregation ───────────────────────────────────────────────────────────────
export function aggregateRows(rows, keyBuilder, seedFactory, reducer, sorter) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = keyBuilder(row);
    if (!grouped.has(key)) grouped.set(key, seedFactory(row));
    reducer(grouped.get(key), row);
  });
  return Array.from(grouped.values()).sort(sorter);
}

export function buildDayPatternSummary(clusteredData) {
  return DAYS_ORDER.map((day) => {
    const rows = clusteredData.filter((item) => item.hari === day);
    if (rows.length === 0) return null;
    const counts = { Rendah: 0, Sedang: 0, Tinggi: 0 };
    rows.forEach((item) => { if (item.cluster in counts) counts[item.cluster]++; });
    const dominantCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return {
      hari: day,
      jumlahHari: rows.length,
      rataRataStok: rows.reduce((s, i) => s + i.Total_Stok, 0) / rows.length,
      rataRataTerjual: rows.reduce((s, i) => s + i.Total_Terjual, 0) / rows.length,
      dominantCategory,
      dominantCount: counts[dominantCategory],
      dominantRatio: counts[dominantCategory] / rows.length,
    };
  }).filter(Boolean);
}

export function buildProductSupportInsights(transactionRows, clusteredData) {
  if (!Array.isArray(transactionRows) || transactionRows.length === 0) {
    return { enrichedTransactions: [], topProductsOverall: [], categorySummary: [], topProductsByCluster: {}, topCategoriesByCluster: {} };
  }
  const clusterLookup = new Map(clusteredData.map((item) => [`${item.tanggal}_${item.hari}`, item.cluster]));
  const enrichedTransactions = transactionRows
    .map((item) => ({ ...item, cluster: clusterLookup.get(`${item.tanggal}_${item.hari}`) || null }))
    .filter((item) => item.cluster);

  const topProductsOverall = aggregateRows(
    enrichedTransactions,
    (i) => `${i.kategoriProduk}__${i.nama}`,
    (i) => ({ kategoriProduk: i.kategoriProduk, nama: i.nama, totalTerjual: 0, totalStok: 0, jumlahHariAktif: new Set() }),
    (b, i) => { b.totalTerjual += i.terjual; b.totalStok += i.stok; b.jumlahHariAktif.add(i.tanggal); },
    (a, b) => b.totalTerjual - a.totalTerjual
  ).map((i) => ({ ...i, jumlahHariAktif: i.jumlahHariAktif.size }));

  const categorySummary = aggregateRows(
    enrichedTransactions,
    (i) => i.kategoriProduk,
    (i) => ({ kategoriProduk: i.kategoriProduk, totalTerjual: 0, totalStok: 0, jumlahProduk: new Set(), jumlahHariAktif: new Set() }),
    (b, i) => { b.totalTerjual += i.terjual; b.totalStok += i.stok; b.jumlahProduk.add(i.nama); b.jumlahHariAktif.add(i.tanggal); },
    (a, b) => b.totalTerjual - a.totalTerjual
  ).map((i) => ({ ...i, jumlahProduk: i.jumlahProduk.size, jumlahHariAktif: i.jumlahHariAktif.size }));

  const topProductsByCluster = {};
  const topCategoriesByCluster = {};
  ["Rendah", "Sedang", "Tinggi"].forEach((label) => {
    const cr = enrichedTransactions.filter((i) => i.cluster === label);
    topProductsByCluster[label] = aggregateRows(cr, (i) => `${i.kategoriProduk}__${i.nama}`,
      (i) => ({ kategoriProduk: i.kategoriProduk, nama: i.nama, totalTerjual: 0 }),
      (b, i) => { b.totalTerjual += i.terjual; }, (a, b) => b.totalTerjual - a.totalTerjual).slice(0, 5);
    topCategoriesByCluster[label] = aggregateRows(cr, (i) => i.kategoriProduk,
      (i) => ({ kategoriProduk: i.kategoriProduk, totalTerjual: 0 }),
      (b, i) => { b.totalTerjual += i.terjual; }, (a, b) => b.totalTerjual - a.totalTerjual).slice(0, 5);
  });
  return { enrichedTransactions, topProductsOverall, categorySummary, topProductsByCluster, topCategoriesByCluster };
}

// ── LocalStorage state ────────────────────────────────────────────────────────
export function loadStoredAppState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const needsReanalysis = parsed.version !== STORAGE_VERSION ||
      !parsed.result?.stats?.every((i) => ["minTerjual","maxTerjual","dominantDay"].every((k) => k in i)) ||
      !parsed.result?.productInsights?.topProductsOverall ||
      !Array.isArray(parsed.futureForecasts);
    return {
      isLogin: Boolean(parsed.isLogin),
      page: typeof parsed.page === "string" ? parsed.page : "dashboard",
      loggedUser: parsed.loggedUser ?? null,
      preprocessSummary: parsed.preprocessSummary ?? null,
      transactionRows: Array.isArray(parsed.transactionRows) ? parsed.transactionRows : [],
      dailyAggregated: Array.isArray(parsed.dailyAggregated) ? parsed.dailyAggregated : [],
      elbowData: Array.isArray(parsed.elbowData) ? parsed.elbowData : [],
      result: !needsReanalysis && parsed.result?.clusteredData ? parsed.result : null,
      futureForecasts: !needsReanalysis && Array.isArray(parsed.futureForecasts) ? parsed.futureForecasts : [],
      needsReanalysis,
    };
  } catch { return null; }
}

export function clearStoredAppState() {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}

// Re-export constants for convenience
export { FORECAST_LIMITATIONS };
