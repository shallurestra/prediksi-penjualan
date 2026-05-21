import React, { useEffect, useState, useCallback } from "react";
import { Bar, Doughnut, Line, Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import * as XLSX from "xlsx";
import { Home, UploadCloud, BarChart3, TrendingUp, Clock3, Search, Package, Activity, UserCircle, Layers, Info, Lightbulb, AlertTriangle, CalendarDays, LogOut, Download, RefreshCw, Server } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

// URL backend Python FastAPI
const API_BASE_URL = "prediksi-penjualan-be-production.up.railway.app";

// Token management
function getToken() {
  return localStorage.getItem("sawangan-token") || null;
}
function setToken(token) {
  localStorage.setItem("sawangan-token", token);
}
function removeToken() {
  localStorage.removeItem("sawangan-token");
}

// Authenticated fetch helper
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

const DAYS_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const STORAGE_KEY = "sawangan-kmeans-dashboard";
const STORAGE_VERSION = 5;

const CLUSTER_COLORS = {
  Rendah: "rgba(239,68,68,0.8)",
  Sedang: "rgba(234,179,8,0.8)",
  Tinggi: "rgba(34,197,94,0.8)",
};
const CLUSTER_BADGE_CLASSES = {
  Rendah: "bg-red-50 text-red-700",
  Sedang: "bg-amber-50 text-amber-700",
  Tinggi: "bg-green-50 text-green-700",
};
const CONFIDENCE_BADGE_CLASSES = {
  Rendah: "bg-rose-50 text-rose-700",
  Sedang: "bg-sky-50 text-sky-700",
  Tinggi: "bg-emerald-50 text-emerald-700",
};
const FORECAST_LIMITATIONS = [
  "Perkiraan dibentuk dari pola historis nama hari dan hasil K-Means, bukan dari model time-series tambahan.",
  "Model belum mempertimbangkan promo, musim libur, cuaca, atau kejadian khusus lain yang bisa mengubah permintaan.",
  "Tingkat kepercayaan akan lebih kuat bila riwayat data per nama hari semakin banyak dan pola kategorinya semakin konsisten.",
];

function loadStoredAppState() {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue);
    const storedStatsAreDetailed =
      parsed.result &&
      Array.isArray(parsed.result.stats) &&
      parsed.result.stats.every((item) =>
        ["minTerjual", "maxTerjual", "dominantDay"].every((key) => key in item)
      );
    const storedProductInsightsAreDetailed =
      parsed.result &&
      parsed.result.productInsights &&
      Array.isArray(parsed.result.productInsights.topProductsOverall) &&
      Array.isArray(parsed.result.productInsights.categorySummary);
    const storedForecastsAreDetailed =
      Array.isArray(parsed.futureForecasts) &&
      parsed.futureForecasts.every((item) =>
        [
          "tingkatKepercayaan",
          "dasarPerkiraan",
          "rentangPerkiraanPenjualan",
          "kategoriProdukDominan",
          "produkUtamaPendukung",
          "jumlahRiwayatKategoriDominan",
          "minimumTotalTerjualHistoris",
          "maksimumTotalTerjualHistoris",
          "rataRataTotalStokHistorisHariSama",
          "minimumTotalStokHistoris",
          "maksimumTotalStokHistoris",
          "rekomendasiProduk",
        ].every((key) => key in item)
      );
    const needsReanalysis =
      parsed.version !== STORAGE_VERSION ||
      !storedStatsAreDetailed ||
      !storedProductInsightsAreDetailed ||
      !storedForecastsAreDetailed;

    return {
      isLogin: Boolean(parsed.isLogin),
      page: typeof parsed.page === "string" ? parsed.page : "dashboard",
      preprocessSummary: parsed.preprocessSummary ?? null,
      transactionRows: Array.isArray(parsed.transactionRows) ? parsed.transactionRows : [],
      dailyAggregated: Array.isArray(parsed.dailyAggregated) ? parsed.dailyAggregated : [],
      elbowData: Array.isArray(parsed.elbowData) ? parsed.elbowData : [],
      result:
        !needsReanalysis &&
          parsed.result &&
          Array.isArray(parsed.result.clusteredData) &&
          Array.isArray(parsed.result.stats)
          ? parsed.result
          : null,
      futureForecasts:
        !needsReanalysis && Array.isArray(parsed.futureForecasts)
          ? parsed.futureForecasts
          : [],
      needsReanalysis,
    };
  } catch (error) {
    console.warn("Gagal memuat data dashboard yang tersimpan:", error);
    return null;
  }
}

function clearStoredAppState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

function toTitleCase(value) {
  return String(value || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function getClusterBadgeClasses(label) {
  return CLUSTER_BADGE_CLASSES[label] || "bg-slate-100 text-slate-700";
}

function getConfidenceBadgeClasses(level) {
  return CONFIDENCE_BADGE_CLASSES[level] || "bg-slate-100 text-slate-700";
}

function classifyForecastConfidence(sampleCount, dominantRatio) {
  if (sampleCount >= 8 && dominantRatio >= 0.60) return "Tinggi";
  if (sampleCount >= 4 && dominantRatio >= 0.45) return "Sedang";
  return "Rendah";
}

function describeForecastBasis(dayName, demandLevel, sampleCount, dominantCount, dominantRatio) {
  return `Berdasarkan ${sampleCount} data historis hari ${dayName}, kategori dominan ${demandLevel} muncul ${dominantCount} kali (${(dominantRatio * 100).toFixed(1)}% dari riwayat hari yang sama).`;
}

function inferProductCategory(productName) {
  const rawValue = String(productName || "").trim();
  if (!rawValue) return "Lainnya";

  const upper = rawValue.toUpperCase();
  const tokens = upper.split(/\s+/);
  const firstToken = tokens[0];
  const tokenAliasMap = {
    GETUK: "Getuk",
    MENDOAN: "Mendoan",
    DAGE: "Dage",
    GHOSTING: "Ghosting",
    JAHAT: "Jahat",
    JUMBO: "Jumbo",
    MEDIUM: "Medium",
    MEGA: "Mega",
    MOZARELLA: "Mozarella",
    RAKSASA: "Raksasa",
    SACU: "Sacu",
    SMALL: "Small",
    SUPER: "Super Jumbo",
    FREE: "Free Man",
  };

  return tokenAliasMap[firstToken] || toTitleCase(firstToken);
}

// NORMALIZATION
function normalize(data) {
  if (data.length === 0) return [];
  const numericKeys = ["Total_Stok", "Total_Terjual"];
  const stats = {};

  numericKeys.forEach((key) => {
    const values = data.map((item) => item[key]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance) || 1;
    stats[key] = { mean, std };
  });

  return data.map((item) => {
    const normalizedItem = { ...item };
    numericKeys.forEach((key) => {
      normalizedItem[key] = (item[key] - stats[key].mean) / stats[key].std;
    });
    return normalizedItem;
  });
}

// K-MEANS
function createSeededRandom(seed = 42) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function calculateDistance(point1, point2, features) {
  let sum = 0;
  features.forEach(f => {
    sum += Math.pow((point1[f] || 0) - (point2[f] || 0), 2);
  });
  return Math.sqrt(sum);
}

function kMeansMulti(data, features, k = 3, maxIter = 20) {
  if (data.length === 0) return { clusters: [], centroids: [], sse: 0 };
  const rng = createSeededRandom(42);
  const availableIndices = Array.from({ length: data.length }, (_, index) => index);
  const initialIndices = [];
  while (initialIndices.length < k && availableIndices.length > 0) {
    const selectedIndex = Math.floor(rng() * availableIndices.length);
    initialIndices.push(availableIndices.splice(selectedIndex, 1)[0]);
  }

  let centroids = initialIndices.map((index) => ({ ...data[index] }));
  let clusters = new Array(data.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    data.forEach((point, i) => {
      let minDist = Infinity;
      let minIdx = 0;
      centroids.forEach((c, cIdx) => {
        const dist = calculateDistance(point, c, features);
        if (dist < minDist) {
          minDist = dist;
          minIdx = cIdx;
        }
      });
      if (clusters[i] !== minIdx) {
        clusters[i] = minIdx;
        changed = true;
      }
    });

    if (!changed) break;

    centroids = centroids.map((_, cIdx) => {
      const clusterPoints = data.filter((_, i) => clusters[i] === cIdx);
      if (clusterPoints.length === 0) {
        const fallbackIndex = Math.floor(rng() * data.length);
        return { ...data[fallbackIndex] };
      }

      const newC = {};
      features.forEach(f => {
        newC[f] = clusterPoints.reduce((sum, p) => sum + (p[f] || 0), 0) / clusterPoints.length;
      });
      return newC;
    });
  }

  let sse = 0;
  data.forEach((point, i) => {
    sse += Math.pow(calculateDistance(point, centroids[clusters[i]], features), 2);
  });

  return { clusters, centroids, sse };
}

function buildDayPatternSummary(clusteredData) {
  return DAYS_ORDER.map((day) => {
    const rows = clusteredData.filter((item) => item.hari === day);
    if (rows.length === 0) return null;

    const counts = { Rendah: 0, Sedang: 0, Tinggi: 0 };
    rows.forEach((item) => {
      if (counts[item.cluster] !== undefined) {
        counts[item.cluster] += 1;
      }
    });

    const dominantCategory = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const dominantCount = counts[dominantCategory];

    return {
      hari: day,
      jumlahHari: rows.length,
      rataRataStok: rows.reduce((sum, item) => sum + item.Total_Stok, 0) / rows.length,
      rataRataTerjual: rows.reduce((sum, item) => sum + item.Total_Terjual, 0) / rows.length,
      dominantCategory,
      dominantCount,
      dominantRatio: dominantCount / rows.length,
    };
  }).filter(Boolean);
}

function aggregateRows(rows, keyBuilder, seedFactory, reducer, sorter) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = keyBuilder(row);
    if (!grouped.has(key)) {
      grouped.set(key, seedFactory(row));
    }
    reducer(grouped.get(key), row);
  });
  return Array.from(grouped.values()).sort(sorter);
}

function buildProductSupportInsights(transactionRows, clusteredData) {
  if (!Array.isArray(transactionRows) || transactionRows.length === 0) {
    return {
      enrichedTransactions: [],
      topProductsOverall: [],
      categorySummary: [],
      topProductsByCluster: {},
      topCategoriesByCluster: {},
    };
  }

  const clusterLookup = new Map(
    clusteredData.map((item) => [`${item.tanggal}_${item.hari}`, item.cluster])
  );

  const enrichedTransactions = transactionRows
    .map((item) => ({
      ...item,
      cluster: clusterLookup.get(`${item.tanggal}_${item.hari}`) || null,
    }))
    .filter((item) => item.cluster);

  const topProductsOverall = aggregateRows(
    enrichedTransactions,
    (item) => `${item.kategoriProduk}__${item.nama}`,
    (item) => ({
      kategoriProduk: item.kategoriProduk,
      nama: item.nama,
      totalTerjual: 0,
      totalStok: 0,
      jumlahHariAktif: new Set(),
    }),
    (bucket, item) => {
      bucket.totalTerjual += item.terjual;
      bucket.totalStok += item.stok;
      bucket.jumlahHariAktif.add(item.tanggal);
    },
    (a, b) => b.totalTerjual - a.totalTerjual
  ).map((item) => ({
    ...item,
    jumlahHariAktif: item.jumlahHariAktif.size,
  }));

  const categorySummary = aggregateRows(
    enrichedTransactions,
    (item) => item.kategoriProduk,
    (item) => ({
      kategoriProduk: item.kategoriProduk,
      totalTerjual: 0,
      totalStok: 0,
      jumlahProduk: new Set(),
      jumlahHariAktif: new Set(),
    }),
    (bucket, item) => {
      bucket.totalTerjual += item.terjual;
      bucket.totalStok += item.stok;
      bucket.jumlahProduk.add(item.nama);
      bucket.jumlahHariAktif.add(item.tanggal);
    },
    (a, b) => b.totalTerjual - a.totalTerjual
  ).map((item) => ({
    ...item,
    jumlahProduk: item.jumlahProduk.size,
    jumlahHariAktif: item.jumlahHariAktif.size,
  }));

  const topProductsByCluster = {};
  const topCategoriesByCluster = {};
  ["Rendah", "Sedang", "Tinggi"].forEach((clusterLabel) => {
    const clusterRows = enrichedTransactions.filter((item) => item.cluster === clusterLabel);
    topProductsByCluster[clusterLabel] = aggregateRows(
      clusterRows,
      (item) => `${item.kategoriProduk}__${item.nama}`,
      (item) => ({
        kategoriProduk: item.kategoriProduk,
        nama: item.nama,
        totalTerjual: 0,
      }),
      (bucket, item) => {
        bucket.totalTerjual += item.terjual;
      },
      (a, b) => b.totalTerjual - a.totalTerjual
    ).slice(0, 5);

    topCategoriesByCluster[clusterLabel] = aggregateRows(
      clusterRows,
      (item) => item.kategoriProduk,
      (item) => ({
        kategoriProduk: item.kategoriProduk,
        totalTerjual: 0,
      }),
      (bucket, item) => {
        bucket.totalTerjual += item.terjual;
      },
      (a, b) => b.totalTerjual - a.totalTerjual
    ).slice(0, 5);
  });

  return {
    enrichedTransactions,
    topProductsOverall,
    categorySummary,
    topProductsByCluster,
    topCategoriesByCluster,
  };
}

function buildForecastSummary(futureForecasts) {
  if (!futureForecasts || futureForecasts.length === 0) return null;

  const forecastRows = futureForecasts.map((item) => ({
    ...item,
    perkiraanTerjualNumber: Number(item.perkiraanTerjual),
    rekomendasiStokNumber: Number(item.rekomendasiStok),
  }));

  const totalPredicted = forecastRows.reduce((sum, item) => sum + item.perkiraanTerjualNumber, 0);
  const averagePredicted = totalPredicted / forecastRows.length;
  const highest = forecastRows.reduce((best, current) =>
    current.perkiraanTerjualNumber > best.perkiraanTerjualNumber ? current : best
  );
  const lowest = forecastRows.reduce((best, current) =>
    current.perkiraanTerjualNumber < best.perkiraanTerjualNumber ? current : best
  );
  const confidenceCounts = { Rendah: 0, Sedang: 0, Tinggi: 0 };
  forecastRows.forEach((item) => {
    if (confidenceCounts[item.tingkatKepercayaan] !== undefined) {
      confidenceCounts[item.tingkatKepercayaan] += 1;
    }
  });

  return {
    totalPredicted,
    averagePredicted,
    highest,
    lowest,
    confidenceCounts,
  };
}

function buildAnalysisFromDailyData(dailyAggregated, transactionRows = []) {
  if (!Array.isArray(dailyAggregated) || dailyAggregated.length === 0) {
    throw new Error("Tidak ada data valid untuk diolah.");
  }

  const dataForKMeans = dailyAggregated.map((d) => {
    const obj = { Total_Stok: d.Total_Stok, Total_Terjual: d.Total_Terjual };
    DAYS_ORDER.forEach((day) => {
      obj[`is_${day}`] = d.hari === day ? 1 : 0;
    });
    return obj;
  });

  const normalized = normalize(dataForKMeans);
  const features = ["Total_Stok", "Total_Terjual", ...DAYS_ORDER.map((d) => `is_${d}`)];

  const sseArr = [];
  for (let k = 1; k <= 10; k++) {
    if (k > normalized.length) break;
    const res = kMeansMulti(normalized, features, k, 20);
    sseArr.push(res.sse);
  }

  const finalK = Math.min(3, normalized.length);
  const finalRes = kMeansMulti(normalized, features, finalK, 50);

  const clusterStatsRaw = Array.from({ length: finalK }).map((_, cIdx) => {
    const items = dailyAggregated.filter((_, i) => finalRes.clusters[i] === cIdx);
    const avgTerjual = items.length
      ? items.reduce((sum, item) => sum + item.Total_Terjual, 0) / items.length
      : 0;
    return { cIdx, avgTerjual, items };
  });

  clusterStatsRaw.sort((a, b) => a.avgTerjual - b.avgTerjual);

  const labelSets = {
    1: ["Sedang"],
    2: ["Rendah", "Tinggi"],
    3: ["Rendah", "Sedang", "Tinggi"],
  };

  const labelMapping = {};
  const selectedLabels = labelSets[finalK] || clusterStatsRaw.map((_, idx) => `Cluster ${idx + 1}`);
  clusterStatsRaw.forEach((clusterInfo, idx) => {
    labelMapping[clusterInfo.cIdx] = selectedLabels[idx] || `Cluster ${idx + 1}`;
  });

  const mappedClusters = finalRes.clusters.map((cIdx) => labelMapping[cIdx]);
  const clusteredData = dailyAggregated.map((d, i) => ({
    ...d,
    cluster: mappedClusters[i],
  }));
  const productInsights = buildProductSupportInsights(transactionRows, clusteredData);

  const stats = clusterStatsRaw.map((cs) => {
    const label = labelMapping[cs.cIdx];
    const countsByDay = {};
    cs.items.forEach((item) => {
      countsByDay[item.hari] = (countsByDay[item.hari] || 0) + 1;
    });
    const dominantDay = Object.entries(countsByDay).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

    return {
      label,
      avgTerjual: cs.avgTerjual,
      count: cs.items.length,
      avgStok: cs.items.length
        ? cs.items.reduce((sum, item) => sum + item.Total_Stok, 0) / cs.items.length
        : 0,
      minTerjual: cs.items.length ? Math.min(...cs.items.map((item) => item.Total_Terjual)) : 0,
      maxTerjual: cs.items.length ? Math.max(...cs.items.map((item) => item.Total_Terjual)) : 0,
      dominantDay,
    };
  });

  const lastDateStr = clusteredData[clusteredData.length - 1].tanggal;
  let lastDate = new Date(lastDateStr);

  if (isNaN(lastDate.getTime())) {
    lastDate = new Date();
  }

  const forecasts = [];
  const daysMapRev = { 1: "Senin", 2: "Selasa", 3: "Rabu", 4: "Kamis", 5: "Jumat", 6: "Sabtu", 0: "Minggu" };
  const allCategoryCounts = { Rendah: 0, Sedang: 0, Tinggi: 0 };
  clusteredData.forEach((item) => {
    if (allCategoryCounts[item.cluster] !== undefined) {
      allCategoryCounts[item.cluster] += 1;
    }
  });
  const overallCategory = Object.entries(allCategoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Sedang";

  for (let i = 1; i <= 7; i++) {
    const nextDate = new Date(lastDate);
    nextDate.setDate(lastDate.getDate() + i);
    const hariName = daysMapRev[nextDate.getDay()];
    const dayRows = clusteredData.filter((item) => item.hari === hariName);
    const counts = { Rendah: 0, Sedang: 0, Tinggi: 0 };
    dayRows.forEach((item) => {
      if (counts[item.cluster] !== undefined) {
        counts[item.cluster] += 1;
      }
    });

    const sampleCount = dayRows.length || clusteredData.length;
    const dominantCategory = dayRows.length
      ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
      : overallCategory;
    const dominantRows = dayRows.length
      ? dayRows.filter((item) => item.cluster === dominantCategory)
      : clusteredData.filter((item) => item.cluster === overallCategory);
    const dominantCount = dayRows.length
      ? counts[dominantCategory]
      : dominantRows.length;
    const dominantRatio = sampleCount ? dominantCount / sampleCount : 0;
    const averageSoldHistorical = dayRows.length
      ? dayRows.reduce((sum, item) => sum + item.Total_Terjual, 0) / dayRows.length
      : clusteredData.reduce((sum, item) => sum + item.Total_Terjual, 0) / clusteredData.length;
    const averageStockHistorical = dayRows.length
      ? dayRows.reduce((sum, item) => sum + item.Total_Stok, 0) / dayRows.length
      : clusteredData.reduce((sum, item) => sum + item.Total_Stok, 0) / clusteredData.length;
    const averageSoldDominant = dominantRows.reduce((sum, item) => sum + item.Total_Terjual, 0) / dominantRows.length;
    const averageStockDominant = dominantRows.reduce((sum, item) => sum + item.Total_Stok, 0) / dominantRows.length;
    const minSold = Math.min(...dominantRows.map((item) => item.Total_Terjual));
    const maxSold = Math.max(...dominantRows.map((item) => item.Total_Terjual));
    const minStock = Math.min(...dominantRows.map((item) => item.Total_Stok));
    const maxStock = Math.max(...dominantRows.map((item) => item.Total_Stok));
    const confidence = dayRows.length
      ? classifyForecastConfidence(sampleCount, dominantRatio)
      : "Rendah";
    const basis = dayRows.length
      ? describeForecastBasis(hariName, dominantCategory, sampleCount, dominantCount, dominantRatio)
      : "Menggunakan rata-rata keseluruhan data historis karena nama hari belum memiliki riwayat yang cukup.";
    const supportRows = productInsights.enrichedTransactions.filter(
      (item) => item.hari === hariName && item.cluster === dominantCategory
    );
    const fallbackSupportRows = supportRows.length
      ? supportRows
      : productInsights.enrichedTransactions.filter((item) => item.hari === hariName);
    const effectiveSupportRows = fallbackSupportRows.length
      ? fallbackSupportRows
      : productInsights.enrichedTransactions;
    const supportCategorySummary = aggregateRows(
      effectiveSupportRows,
      (item) => item.kategoriProduk,
      (item) => ({
        kategoriProduk: item.kategoriProduk,
        totalTerjual: 0,
      }),
      (bucket, item) => {
        bucket.totalTerjual += item.terjual;
      },
      (a, b) => b.totalTerjual - a.totalTerjual
    );
    const supportProductSummary = aggregateRows(
      effectiveSupportRows,
      (item) => `${item.kategoriProduk}__${item.nama}`,
      (item) => ({
        kategoriProduk: item.kategoriProduk,
        nama: item.nama,
        totalTerjual: 0,
        totalStok: 0,
        jumlahBaris: 0,
        jumlahHariAktif: new Set(),
      }),
      (bucket, item) => {
        bucket.totalTerjual += item.terjual;
        bucket.totalStok += item.stok;
        bucket.jumlahBaris += 1;
        bucket.jumlahHariAktif.add(item.tanggal);
      },
      (a, b) => b.totalTerjual - a.totalTerjual
    );
    const dominantProductCategory = supportCategorySummary[0]?.kategoriProduk || "Lainnya";
    const topProductNames = supportProductSummary.slice(0, 3).map((item) => item.nama);
    const productRecommendations = supportProductSummary.slice(0, 5).map((item) => ({
      kategoriProduk: item.kategoriProduk,
      nama: item.nama,
      rataRataTerjualProduk: Math.round(item.totalTerjual / item.jumlahBaris),
      rekomendasiStokProduk: Math.round(item.totalStok / item.jumlahBaris),
      jumlahHariAktif: item.jumlahHariAktif.size,
    }));

    forecasts.push({
      tanggal: nextDate.toISOString().split("T")[0],
      hari: hariName,
      kategori: dominantCategory,
      jumlahRiwayatHariSerupa: sampleCount,
      jumlahRiwayatKategoriDominan: dominantCount,
      proporsiDominasiKategori: Number((dominantRatio * 100).toFixed(2)),
      rataRataTotalTerjualHistorisHariSama: Math.round(averageSoldHistorical),
      rataRataTotalTerjualKategoriDominan: Math.round(averageSoldDominant),
      minimumTotalTerjualHistoris: Math.round(minSold),
      maksimumTotalTerjualHistoris: Math.round(maxSold),
      perkiraanTerjual: Math.round(averageSoldDominant),
      rentangPerkiraanPenjualan: `${Math.round(minSold)} - ${Math.round(maxSold)}`,
      rataRataTotalStokHistorisHariSama: Math.round(averageStockHistorical),
      rataRataTotalStokKategoriDominan: Math.round(averageStockDominant),
      minimumTotalStokHistoris: Math.round(minStock),
      maksimumTotalStokHistoris: Math.round(maxStock),
      kategoriProdukDominan: dominantProductCategory,
      produkUtamaPendukung: topProductNames.join(", ") || "-",
      rekomendasiProduk: productRecommendations,
      rekomendasiStok: Math.round(averageStockDominant),
      tingkatKepercayaan: confidence,
      dasarPerkiraan: basis,
    });
  }

  return {
    elbowData: sseArr,
    result: { clusteredData, stats, productInsights },
    futureForecasts: forecasts,
  };
}

// REPORT PAGE
// ── Eye icons ─────────────────────────────────────────────────────────────────
function EyeOpen() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function EyeOff() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
    </svg>
  );
}

// ── Shared dark background ────────────────────────────────────────────────────
function AuthBg() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-slate-900 via-red-950 to-slate-900">
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-red-600/20 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-red-500/15 blur-[100px]" />
      <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] rounded-full bg-orange-500/10 blur-[80px]" />
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
    </div>
  );
}

// ── Brand left panel ──────────────────────────────────────────────────────────
function AuthBrand() {
  const features = [
    { icon: "📊", text: "Analisis K-Means clustering penjualan harian" },
    { icon: "🔮", text: "Forecasting 7 hari ke depan otomatis" },
    { icon: "📈", text: "Laporan & export Excel lengkap" },
  ];
  return (
    <div className="hidden lg:flex flex-col justify-between h-full p-12 text-white">
      <div className="flex items-center gap-3">
        <img src="/logo.png" className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1 backdrop-blur" onError={(e) => { e.target.style.display = "none"; }} />
        <span className="font-bold text-lg tracking-tight">Prediksi Penjualan</span>
      </div>
      <div className="space-y-8">
        <div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Analisis Cerdas<br />
            <span className="text-red-400">Penjualan Getuk</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            Platform analisis berbasis K-Means untuk memahami pola penjualan dan meramalkan permintaan produk.
          </p>
        </div>
        <div className="space-y-4">
          {features.map((f) => (
            <div key={f.text} className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-base flex-shrink-0">{f.icon}</span>
              <span className="text-sm text-white/70">{f.text}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-white/25 text-xs">© 2025 Sistem Analisis Penjualan · K-Means</p>
    </div>
  );
}

// ── LOGIN PAGE ────────────────────────────────────────────────────────────────
function LoginPage({ onLoginSuccess, onGoRegister }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setErrorMsg("");
    if (!username.trim() || !password.trim()) return setErrorMsg("Username dan password wajib diisi.");
    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      setToken(data.access_token);
      onLoginSuccess(data.user);
    } catch (err) {
      setErrorMsg(err.message || "Login gagal. Periksa username dan password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <AuthBg />
      <div className="flex-1 relative"><AuthBrand /></div>
      <div className="w-full lg:w-[480px] flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="flex lg:hidden items-center gap-3 mb-10 justify-center">
            <img src="/logo.png" className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1" onError={(e) => { e.target.style.display = "none"; }} />
            <span className="font-bold text-white text-lg">Prediksi Penjualan</span>
          </div>
          <div className="bg-white/[0.07] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/40">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white mb-1">Selamat datang 👋</h1>
              <p className="text-white/50 text-sm">Masuk ke dashboard analisis penjualan</p>
            </div>
            <div className="space-y-5">
              {errorMsg && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-300 text-sm px-4 py-3 rounded-2xl">
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" /><span>{errorMsg}</span>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest">Username</label>
                <input type="text" placeholder="Masukkan username" value={username} autoFocus
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 focus:bg-white/10 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest">Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} placeholder="Masukkan password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 pr-12 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 focus:bg-white/10 transition-all" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPw ? <EyeOff /> : <EyeOpen />}
                  </button>
                </div>
              </div>
              <button onClick={handleSubmit} disabled={loading}
                className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded-2xl font-semibold text-sm transition-all shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 mt-1">
                {loading ? <><RefreshCw size={15} className="animate-spin" />Memproses...</> : "Masuk ke Dashboard →"}
              </button>
            </div>
            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <p className="text-sm text-white/40">Belum punya akun?{" "}
                <button onClick={onGoRegister} className="text-red-400 font-semibold hover:text-red-300 transition-colors">Daftar sekarang</button>
              </p>
            </div>
          </div>
          <p className="text-center text-white/20 text-xs mt-6">© 2025 Sistem Analisis Penjualan</p>
        </div>
      </div>
    </div>
  );
}

// ── REGISTER PAGE ─────────────────────────────────────────────────────────────
function RegisterPage({ onGoLogin }) {
  const [nama, setNama] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const pwMatch = confirmPw.length > 0 && password === confirmPw;
  const pwNoMatch = confirmPw.length > 0 && password !== confirmPw;

  const handleSubmit = async () => {
    setErrorMsg(""); setSuccessMsg("");
    if (!nama.trim() || !username.trim() || !password.trim()) return setErrorMsg("Semua kolom wajib diisi.");
    if (username.trim().length < 4) return setErrorMsg("Username minimal 4 karakter.");
    if (password.length < 6) return setErrorMsg("Password minimal 6 karakter.");
    if (password !== confirmPw) return setErrorMsg("Konfirmasi password tidak cocok.");
    setLoading(true);
    try {
      await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ nama: nama.trim(), username: username.trim(), password }),
      });
      setSuccessMsg("Akun berhasil dibuat!");
      setTimeout(() => onGoLogin(), 1800);
    } catch (err) {
      setErrorMsg(err.message || "Registrasi gagal.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 focus:bg-white/10 transition-all";

  return (
    <div className="min-h-screen flex">
      <AuthBg />
      <div className="flex-1 relative"><AuthBrand /></div>
      <div className="w-full lg:w-[480px] flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-sm py-6">
          <div className="flex lg:hidden items-center gap-3 mb-10 justify-center">
            <img src="/logo.png" className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1" onError={(e) => { e.target.style.display = "none"; }} />
            <span className="font-bold text-white text-lg">Prediksi Penjualan</span>
          </div>
          <div className="bg-white/[0.07] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/40">
            <button onClick={onGoLogin}
              className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-6 transition-colors group">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Kembali ke login
            </button>
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-white mb-1">Buat akun baru ✨</h1>
              <p className="text-white/50 text-sm">Daftarkan diri untuk mengakses dashboard</p>
            </div>
            <div className="space-y-4">
              {successMsg && (
                <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm px-4 py-3 rounded-2xl">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  {successMsg} Mengalihkan...
                </div>
              )}
              {errorMsg && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-300 text-sm px-4 py-3 rounded-2xl">
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" /><span>{errorMsg}</span>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest">Nama Lengkap</label>
                <input type="text" placeholder="Masukkan nama lengkap" value={nama} autoFocus
                  onChange={(e) => setNama(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest">Username</label>
                <input type="text" placeholder="Min. 4 karakter" value={username}
                  onChange={(e) => setUsername(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest">Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} placeholder="Min. 6 karakter" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls + " pr-12"} />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPw ? <EyeOff /> : <EyeOpen />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest">Konfirmasi Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} placeholder="Ulangi password" value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    className={`${inputCls} pr-12 ${pwMatch ? "border-emerald-500/50 focus:ring-emerald-500/30" : pwNoMatch ? "border-red-500/50" : ""}`} />
                  {confirmPw && (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {pwMatch
                        ? <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        : <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      }
                    </span>
                  )}
                </div>
              </div>
              <button onClick={handleSubmit} disabled={loading || !!successMsg}
                className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded-2xl font-semibold text-sm transition-all shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 mt-1">
                {loading ? <><RefreshCw size={15} className="animate-spin" />Memproses...</> : "Buat Akun →"}
              </button>
            </div>
            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <p className="text-sm text-white/40">Sudah punya akun?{" "}
                <button onClick={onGoLogin} className="text-red-400 font-semibold hover:text-red-300 transition-colors">Masuk di sini</button>
              </p>
            </div>
          </div>
          <p className="text-center text-white/20 text-xs mt-6">© 2025 Sistem Analisis Penjualan</p>
        </div>
      </div>
    </div>
  );
}

// ── AUTH ROUTER ───────────────────────────────────────────────────────────────
function AuthPage({ onLoginSuccess }) {
  const [view, setView] = useState("login");
  if (view === "register") return <RegisterPage onGoLogin={() => setView("login")} />;
  return <LoginPage onLoginSuccess={onLoginSuccess} onGoRegister={() => setView("register")} />;
}

function Report({ clusteredData, clusterStats, productInsights, preprocessSummary, onExport }) {
  const [search, setSearch] = useState("");
  const [selectedDay, setSelectedDay] = useState("Semua Hari");

  if (!clusteredData || clusteredData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-100 text-center">
        <Package size={48} className="text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-700">Belum ada data Analisis</h3>
        <p className="text-slate-500 mt-2">Silakan unggah dan proses data pada menu Dashboard terlebih dahulu.</p>
      </div>
    );
  }

  const days = ["Semua Hari", ...DAYS_ORDER.filter(d => clusteredData.some(cd => cd.hari === d))];

  const filteredData = selectedDay === "Semua Hari"
    ? clusteredData
    : clusteredData.filter(d => d.hari === selectedDay);

  const filteredItems = filteredData.filter(d => d.tanggal.toLowerCase().includes(search.toLowerCase()) || d.hari.toLowerCase().includes(search.toLowerCase()));
  const counts = { Rendah: 0, Sedang: 0, Tinggi: 0 };
  filteredData.forEach((d) => {
    if (counts[d.cluster] !== undefined) counts[d.cluster]++;
  });

  const daySummary = buildDayPatternSummary(filteredData);
  const peakDay = daySummary.length
    ? [...daySummary].sort((a, b) => b.rataRataTerjual - a.rataRataTerjual)[0]
    : null;
  const quietDay = daySummary.length
    ? [...daySummary].sort((a, b) => a.rataRataTerjual - b.rataRataTerjual)[0]
    : null;
  const dominantCluster = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
  const dayAverageChartData = daySummary.length
    ? {
      labels: daySummary.map((item) => item.hari),
      datasets: [
        {
          label: "Rata-rata Total Terjual",
          data: daySummary.map((item) => item.rataRataTerjual),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          fill: true,
          tension: 0.1,
        },
      ],
    }
    : null;
  const insightRows = selectedDay === "Semua Hari"
    ? productInsights?.enrichedTransactions || []
    : (productInsights?.enrichedTransactions || []).filter((item) => item.hari === selectedDay);
  const categorySummary = aggregateRows(
    insightRows,
    (item) => item.kategoriProduk,
    (item) => ({
      kategoriProduk: item.kategoriProduk,
      totalTerjual: 0,
      totalStok: 0,
      jumlahProduk: new Set(),
    }),
    (bucket, item) => {
      bucket.totalTerjual += item.terjual;
      bucket.totalStok += item.stok;
      bucket.jumlahProduk.add(item.nama);
    },
    (a, b) => b.totalTerjual - a.totalTerjual
  )
    .map((item) => ({
      ...item,
      jumlahProduk: item.jumlahProduk.size,
    }))
    .slice(0, 8);
  const topProducts = aggregateRows(
    insightRows,
    (item) => `${item.kategoriProduk}__${item.nama}`,
    (item) => ({
      kategoriProduk: item.kategoriProduk,
      nama: item.nama,
      totalTerjual: 0,
      totalStok: 0,
      jumlahHariAktif: new Set(),
    }),
    (bucket, item) => {
      bucket.totalTerjual += item.terjual;
      bucket.totalStok += item.stok;
      bucket.jumlahHariAktif.add(item.tanggal);
    },
    (a, b) => b.totalTerjual - a.totalTerjual
  )
    .map((item) => ({
      ...item,
      jumlahHariAktif: item.jumlahHariAktif.size,
    }))
    .slice(0, 8);
  const clusterProductSupport = ["Rendah", "Sedang", "Tinggi"].map((label) => {
    const clusterRows = insightRows.filter((item) => item.cluster === label);
    const topCategory = aggregateRows(
      clusterRows,
      (item) => item.kategoriProduk,
      (item) => ({
        kategoriProduk: item.kategoriProduk,
        totalTerjual: 0,
      }),
      (bucket, item) => {
        bucket.totalTerjual += item.terjual;
      },
      (a, b) => b.totalTerjual - a.totalTerjual
    )[0] || null;
    const topClusterProducts = aggregateRows(
      clusterRows,
      (item) => `${item.kategoriProduk}__${item.nama}`,
      (item) => ({
        nama: item.nama,
        totalTerjual: 0,
      }),
      (bucket, item) => {
        bucket.totalTerjual += item.terjual;
      },
      (a, b) => b.totalTerjual - a.totalTerjual
    ).slice(0, 3);

    return {
      label,
      totalBaris: clusterRows.length,
      topCategory,
      topClusterProducts,
    };
  });

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-6 rounded-2xl flex items-start justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-4">
          <Info className="text-blue-600 flex-shrink-0 mt-1" size={24} />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Analisis Model K-Means Berdasarkan Hari</h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              Laporan ini menampilkan hasil klasifikasi (Tinggi, Sedang, Rendah) dari <strong>Pola Permintaan Berdasarkan Nama Hari</strong>.
            </p>
          </div>
        </div>
        {onExport && (
          <button onClick={onExport} className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl text-sm font-medium transition-colors shadow-sm">
            <Download size={16} /> Export Excel
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {days.map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedDay === day ? 'bg-red-600 text-white shadow-md scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group border-l-4 border-l-green-500">
          <p className="text-slate-500 font-medium text-sm mb-1">Jumlah Hari Tingkat Permintaan Tinggi</p>
          <h2 className="text-3xl font-bold text-slate-800 group-hover:text-green-600 transition-colors">{counts.Tinggi} Hari</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group border-l-4 border-l-amber-500">
          <p className="text-slate-500 font-medium text-sm mb-1">Jumlah Hari Tingkat Permintaan Sedang</p>
          <h2 className="text-3xl font-bold text-slate-800 group-hover:text-amber-500 transition-colors">{counts.Sedang} Hari</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group border-l-4 border-l-red-500">
          <p className="text-slate-500 font-medium text-sm mb-1">Jumlah Hari Tingkat Permintaan Rendah</p>
          <h2 className="text-3xl font-bold text-slate-800 group-hover:text-red-600 transition-colors">{counts.Rendah} Hari</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group border-l-4 border-l-sky-500">
          <p className="text-slate-500 font-medium text-sm mb-1">Kategori Paling Dominan</p>
          <h2 className="text-3xl font-bold text-slate-800">{dominantCluster}</h2>
          <p className="text-xs text-slate-500 mt-2">
            {peakDay ? `Hari teramai: ${peakDay.hari}` : "Menunggu data hari"}
          </p>
        </div>
      </div>

      {dayAverageChartData && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="font-semibold flex items-center gap-2 text-slate-800 text-lg mb-4">
              <BarChart3 size={20} className="text-red-500" /> Pola Permintaan Berdasarkan Nama Hari
            </h2>
            <div className="h-72">
              <Line
                data={dayAverageChartData}
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { display: true } }
                }}
              />
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">Hari Teramai</p>
              <h3 className="text-xl font-bold text-emerald-900 mt-1">
                {peakDay ? peakDay.hari : "-"}
              </h3>
              <p className="text-sm text-emerald-800 mt-1">
                {peakDay ? `${formatNumber(Math.round(peakDay.rataRataTerjual))} rata-rata terjual` : "Belum ada data"}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide">Hari Tersepi</p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">
                {quietDay ? quietDay.hari : "-"}
              </h3>
              <p className="text-sm text-slate-700 mt-1">
                {quietDay ? `${formatNumber(Math.round(quietDay.rataRataTerjual))} rata-rata terjual` : "Belum ada data"}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide">Interpretasi Singkat</p>
              <p className="text-sm text-blue-900 mt-2 leading-relaxed">
                Hasil cluster memperlihatkan bahwa intensitas permintaan tidak merata pada setiap nama hari. Hari dengan kategori dominan yang lebih tinggi dapat dijadikan prioritas untuk penyiapan stok.
              </p>
            </div>
          </div>
        </div>
      )}

      {preprocessSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-sm text-slate-500 font-medium">Jumlah Produk Unik</p>
            <h2 className="text-3xl font-bold text-slate-800 mt-2">
              {formatNumber(preprocessSummary.uniqueProducts)}
            </h2>
            <p className="text-xs text-slate-500 mt-2">Produk yang terlibat pada transaksi historis</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-sm text-slate-500 font-medium">Jumlah Kategori Produk</p>
            <h2 className="text-3xl font-bold text-slate-800 mt-2">
              {formatNumber(preprocessSummary.uniqueCategories)}
            </h2>
            <p className="text-xs text-slate-500 mt-2">Layer analisis pendukung di luar inti K-Means harian</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-sm text-slate-500 font-medium">Sumber Kategori Produk</p>
            <h2 className="text-lg font-bold text-slate-800 mt-2">
              {preprocessSummary.categorySource}
            </h2>
            <p className="text-xs text-slate-500 mt-2">Kategori dipakai untuk interpretasi produk, bukan fitur inti clustering</p>
          </div>
        </div>
      )}

      {insightRows.length > 0 && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="font-semibold flex items-center gap-2 text-slate-800 text-lg mb-4">
                <Package size={20} className="text-red-500" /> Ringkasan Kategori Produk Pendukung
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-sm">
                      <th className="p-3 border-b">Kategori Produk</th>
                      <th className="p-3 border-b text-right">Total Terjual</th>
                      <th className="p-3 border-b text-right">Total Stok</th>
                      <th className="p-3 border-b text-right">Jumlah Produk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorySummary.map((item) => (
                      <tr key={item.kategoriProduk} className="border-b border-slate-50">
                        <td className="p-3 font-medium text-slate-800">{item.kategoriProduk}</td>
                        <td className="p-3 text-right text-slate-700">{formatNumber(item.totalTerjual)}</td>
                        <td className="p-3 text-right text-slate-700">{formatNumber(item.totalStok)}</td>
                        <td className="p-3 text-right text-slate-700">{formatNumber(item.jumlahProduk)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="font-semibold flex items-center gap-2 text-slate-800 text-lg mb-4">
                <Package size={20} className="text-red-500" /> Produk Terlaris Pendukung
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-sm">
                      <th className="p-3 border-b">Nama Produk</th>
                      <th className="p-3 border-b">Kategori Produk</th>
                      <th className="p-3 border-b text-right">Total Terjual</th>
                      <th className="p-3 border-b text-right">Hari Aktif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((item) => (
                      <tr key={`${item.kategoriProduk}_${item.nama}`} className="border-b border-slate-50">
                        <td className="p-3 font-medium text-slate-800">{item.nama}</td>
                        <td className="p-3 text-slate-600">{item.kategoriProduk}</td>
                        <td className="p-3 text-right text-slate-700">{formatNumber(item.totalTerjual)}</td>
                        <td className="p-3 text-right text-slate-700">{formatNumber(item.jumlahHariAktif)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {clusterProductSupport.map((item) => (
              <div key={item.label} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="font-semibold text-slate-800 text-lg">Produk Pendukung Kategori {item.label}</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {selectedDay === "Semua Hari" ? "Semua hari historis" : `Difilter pada hari ${selectedDay}`}
                    </p>
                  </div>
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold ${getClusterBadgeClasses(item.label)}`}>
                    {item.label}
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Kategori Produk Dominan</p>
                    <p className="text-base font-semibold text-slate-800 mt-1">
                      {item.topCategory?.kategoriProduk || "-"}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {item.topCategory ? `${formatNumber(item.topCategory.totalTerjual)} total terjual` : "Belum ada transaksi pendukung"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Top Produk Pendukung</p>
                    <div className="space-y-2">
                      {item.topClusterProducts.length === 0 ? (
                        <div className="text-sm text-slate-400 italic">Belum ada data produk pada kategori ini</div>
                      ) : (
                        item.topClusterProducts.map((product) => (
                          <div key={`${item.label}_${product.nama}`} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                            <span className="text-sm font-medium text-slate-700">{product.nama}</span>
                            <span className="text-sm text-slate-500">{formatNumber(product.totalTerjual)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Jumlah transaksi pendukung: {formatNumber(item.totalBaris)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="font-semibold flex items-center gap-2 text-slate-800 text-lg mb-4">
            <Layers size={20} className="text-red-500" /> Ringkasan Kategori Tingkat Permintaan
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm">
                  <th className="p-3 border-b">Kategori</th>
                  <th className="p-3 border-b text-right">Jumlah Hari</th>
                  <th className="p-3 border-b text-right">Rata-rata Terjual</th>
                  <th className="p-3 border-b text-right">Rentang Terjual</th>
                  <th className="p-3 border-b">Hari Dominan</th>
                </tr>
              </thead>
              <tbody>
                {clusterStats.map((item) => (
                  <tr key={item.label} className="border-b border-slate-50">
                    <td className="p-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold ${getClusterBadgeClasses(item.label)}`}>
                        {item.label}
                      </span>
                    </td>
                    <td className="p-3 text-right font-medium text-slate-800">{formatNumber(item.count)}</td>
                    <td className="p-3 text-right font-medium text-slate-800">{formatNumber(Math.round(item.avgTerjual))}</td>
                    <td className="p-3 text-right text-slate-600">{formatNumber(item.minTerjual)} - {formatNumber(item.maxTerjual)}</td>
                    <td className="p-3 text-slate-600">{item.dominantDay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="font-semibold flex items-center gap-2 text-slate-800 text-lg mb-4">
            <CalendarDays size={20} className="text-red-500" /> Ringkasan Nama Hari
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm">
                  <th className="p-3 border-b">Hari</th>
                  <th className="p-3 border-b text-right">Jumlah Data</th>
                  <th className="p-3 border-b text-right">Rata-rata Terjual</th>
                  <th className="p-3 border-b text-right">Rata-rata Stok</th>
                  <th className="p-3 border-b">Kategori Dominan</th>
                </tr>
              </thead>
              <tbody>
                {daySummary.map((item) => (
                  <tr key={item.hari} className="border-b border-slate-50">
                    <td className="p-3 font-medium text-slate-800">{item.hari}</td>
                    <td className="p-3 text-right text-slate-700">{formatNumber(item.jumlahHari)}</td>
                    <td className="p-3 text-right text-slate-700">{formatNumber(Math.round(item.rataRataTerjual))}</td>
                    <td className="p-3 text-right text-slate-700">{formatNumber(Math.round(item.rataRataStok))}</td>
                    <td className="p-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold ${getClusterBadgeClasses(item.dominantCategory)}`}>
                        {item.dominantCategory}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="font-semibold flex items-center gap-2 text-slate-800 text-lg">
            <BarChart3 size={20} className="text-red-500" /> Data Klaster Harian
          </h2>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Cari tanggal/hari..."
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm bg-slate-50 focus:bg-white transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                <th className="p-4 font-semibold">Tanggal</th>
                <th className="p-4 font-semibold">Nama Hari</th>
                <th className="p-4 font-semibold text-right">Total Stok</th>
                <th className="p-4 font-semibold text-right">Total Terjual</th>
                <th className="p-4 font-semibold text-center">Kategori</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr><td colSpan="5" className="text-center p-8 text-slate-400 italic">Data tidak ditemukan</td></tr>
              ) : (
                filteredItems.map((r, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-medium text-slate-800">{r.tanggal}</td>
                    <td className="p-4 text-slate-600">{r.hari}</td>
                    <td className="p-4 text-right font-semibold text-slate-700">{r.Total_Stok.toLocaleString()}</td>
                    <td className="p-4 text-right font-semibold text-slate-700">{r.Total_Terjual.toLocaleString()}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold ${getClusterBadgeClasses(r.cluster)}`}>
                        {r.cluster}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// FORECAST PAGE
function ForecastPage({ futureForecasts, preprocessSummary, onExport }) {
  const [search, setSearch] = useState("");

  if (!futureForecasts || futureForecasts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-100 text-center">
        <CalendarDays size={48} className="text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-700">Belum ada Perkiraan</h3>
        <p className="text-slate-500 mt-2">Silakan jalankan pengolahan data pada menu Dashboard terlebih dahulu.</p>
      </div>
    );
  }
  const filteredData = futureForecasts.filter(d =>
    d.tanggal.toLowerCase().includes(search.toLowerCase()) ||
    d.hari.toLowerCase().includes(search.toLowerCase()) ||
    d.kategori.toLowerCase().includes(search.toLowerCase())
  );
  const forecastSummary = buildForecastSummary(futureForecasts);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Info className="text-blue-600 mt-0.5 flex-shrink-0" size={24} />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Perkiraan Permintaan pada Periode Tertentu</h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              Perkiraan dihasilkan dengan memproyeksikan tanggal ke depan, mengidentifikasi <strong>Nama Hari</strong>, dan menggunakan hasil klasifikasi dominan dari hari tersebut untuk meramal penjualan dan stok.
            </p>
            {preprocessSummary && (
              <p className="text-xs text-blue-700 mt-2">
                Analisis produk pendukung memakai kategori dari: {preprocessSummary.categorySource.toLowerCase()}.
              </p>
            )}
          </div>
        </div>
        {onExport && (
          <button onClick={onExport} className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl text-sm font-medium transition-colors shadow-sm">
            <Download size={16} /> Export Excel
          </button>
        )}
      </div>

      {forecastSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-sm text-slate-500 font-medium">Total Perkiraan Penjualan</p>
            <h2 className="text-3xl font-bold text-slate-800 mt-2">{formatNumber(forecastSummary.totalPredicted)}</h2>
            <p className="text-xs text-slate-500 mt-2">Akumulasi 7 hari ke depan</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-sm text-slate-500 font-medium">Rata-rata Per Hari</p>
            <h2 className="text-3xl font-bold text-slate-800 mt-2">{formatNumber(Math.round(forecastSummary.averagePredicted))}</h2>
            <p className="text-xs text-slate-500 mt-2">Rata-rata penjualan harian hasil perkiraan</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-sm text-slate-500 font-medium">Perkiraan Tertinggi</p>
            <h2 className="text-xl font-bold text-slate-800 mt-2">
              {forecastSummary.highest.hari}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {forecastSummary.highest.tanggal} • {formatNumber(forecastSummary.highest.perkiraanTerjual)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-sm text-slate-500 font-medium">Perkiraan Terendah</p>
            <h2 className="text-xl font-bold text-slate-800 mt-2">
              {forecastSummary.lowest.hari}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {forecastSummary.lowest.tanggal} • {formatNumber(forecastSummary.lowest.perkiraanTerjual)}
            </p>
          </div>
        </div>
      )}

      {forecastSummary && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="font-semibold text-lg text-slate-800 flex items-center gap-2 mb-4">
              <TrendingUp size={20} className="text-red-500" /> Ringkasan Tingkat Kepercayaan
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Object.entries(forecastSummary.confidenceCounts).map(([label, count]) => (
                <div key={label} className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold ${getConfidenceBadgeClasses(label)}`}>
                    {label}
                  </span>
                  <h3 className="text-2xl font-bold text-slate-800 mt-3">{formatNumber(count)}</h3>
                  <p className="text-sm text-slate-500">hari perkiraan</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="font-semibold text-lg text-slate-800 flex items-center gap-2 mb-4">
              <Lightbulb size={20} className="text-red-500" /> Cara Membaca Hasil
            </h2>
            <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>Perkiraan jumlah terjual diambil dari rata-rata historis pada kategori dominan untuk nama hari yang sama.</p>
              <p>Rekomendasi stok memakai rata-rata stok pada kategori dominan, sehingga tetap mengikuti pola riwayat yang paling sering muncul.</p>
              <p>Tingkat kepercayaan dihitung dari banyaknya sampel historis dan konsistensi kategori dominan pada nama hari terkait.</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
            <TrendingUp size={20} className="text-red-500" /> Tabel Perkiraan Detail (7 Hari Kedepan)
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Cari tanggal/hari/kategori..."
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm bg-slate-50 focus:bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm">
                <th className="p-4 border-b font-semibold">Tanggal</th>
                <th className="p-4 border-b font-semibold">Nama Hari</th>
                <th className="p-4 border-b font-semibold text-center">Kategori Tingkat Permintaan</th>
                <th className="p-4 border-b text-right font-semibold">Riwayat Hari Serupa</th>
                <th className="p-4 border-b text-right font-semibold">Proporsi Dominasi (%)</th>
                <th className="p-4 border-b text-right font-semibold">Rentang Historis Terjual</th>
                <th className="p-4 border-b text-right font-semibold">Perkiraan Jumlah Terjual</th>
                <th className="p-4 border-b text-right font-semibold">Rekomendasi Jumlah Stok</th>
                <th className="p-4 border-b text-center font-semibold">Tingkat Kepercayaan</th>
                <th className="p-4 border-b font-semibold">Dasar Perkiraan</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center p-8 text-slate-400">Pencarian tidak ditemukan</td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-sm font-medium text-slate-800">{item.tanggal}</td>
                    <td className="p-4 text-sm text-slate-600">{item.hari}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold ${getClusterBadgeClasses(item.kategori)}`}>
                        {item.kategori}
                      </span>
                    </td>
                    <td className="p-4 text-right text-slate-700">{formatNumber(item.jumlahRiwayatHariSerupa)}</td>
                    <td className="p-4 text-right text-slate-700">{item.proporsiDominasiKategori}</td>
                    <td className="p-4 text-right text-slate-700">{item.rentangPerkiraanPenjualan}</td>
                    <td className="p-4 text-right font-medium text-slate-800">{formatNumber(item.perkiraanTerjual)}</td>
                    <td className="p-4 text-right font-medium text-slate-800">{formatNumber(item.rekomendasiStok)}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold ${getConfidenceBadgeClasses(item.tingkatKepercayaan)}`}>
                        {item.tingkatKepercayaan}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600 min-w-[22rem]">{item.dasarPerkiraan}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="font-semibold text-lg text-slate-800 flex items-center gap-2 mb-4">
          <AlertTriangle size={20} className="text-red-500" /> Catatan dan Keterbatasan Model
        </h2>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {FORECAST_LIMITATIONS.map((item) => (
            <div key={item} className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-600 leading-relaxed">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="mb-6">
          <h2 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
            <Package size={20} className="text-red-500" /> Rincian Rekomendasi Stok per Produk
          </h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Bagian ini menjabarkan `Rekomendasi Jumlah Stok` ke level produk. Rincian dibentuk dari riwayat transaksi pada nama hari yang sama dan kategori permintaan dominan yang relevan, sehingga lebih cocok untuk kebutuhan operasional toko daripada tabel inti TA.
          </p>
        </div>

        <div className="space-y-6">
          {filteredData.map((item) => (
            <div key={`produk_${item.tanggal}_${item.hari}`} className="rounded-2xl border border-slate-100 overflow-hidden">
              <div className="bg-slate-50 px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-800">
                    {item.tanggal} • {item.hari}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Kategori {item.kategori} dengan rekomendasi stok total {formatNumber(item.rekomendasiStok)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold ${getClusterBadgeClasses(item.kategori)}`}>
                    {item.kategori}
                  </span>
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold ${getConfidenceBadgeClasses(item.tingkatKepercayaan)}`}>
                    Kepercayaan {item.tingkatKepercayaan}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white text-slate-500 text-sm">
                      <th className="p-4 border-b font-semibold">Nama Produk</th>
                      <th className="p-4 border-b font-semibold">Kategori Produk</th>
                      <th className="p-4 border-b text-right font-semibold">Rata-rata Terjual Historis</th>
                      <th className="p-4 border-b text-right font-semibold">Rekomendasi Stok Produk</th>
                      <th className="p-4 border-b text-right font-semibold">Jumlah Hari Aktif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.rekomendasiProduk?.length ? (
                      item.rekomendasiProduk.map((produk) => (
                        <tr key={`${item.tanggal}_${produk.kategoriProduk}_${produk.nama}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-medium text-slate-800">{produk.nama}</td>
                          <td className="p-4 text-slate-600">{produk.kategoriProduk}</td>
                          <td className="p-4 text-right text-slate-700">{formatNumber(produk.rataRataTerjualProduk)}</td>
                          <td className="p-4 text-right font-semibold text-slate-800">{formatNumber(produk.rekomendasiStokProduk)}</td>
                          <td className="p-4 text-right text-slate-700">{formatNumber(produk.jumlahHariAktif)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="p-6 text-center text-slate-400">
                          Belum ada rincian produk untuk hari ini
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// HISTORY PAGE
function HistoryPage({ transactionRows, dailyAggregated, onExport }) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("daily"); // "daily" | "products"
  const [sortField, setSortField] = useState("tanggal");
  const [sortDir, setSortDir] = useState("desc");

  if (!transactionRows || transactionRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-100 text-center">
        <Clock3 size={48} className="text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-700">Belum ada Riwayat Data</h3>
        <p className="text-slate-500 mt-2">Data akan muncul setelah berhasil dimuat dari server.</p>
      </div>
    );
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }) => (
    <span className={`ml-1 text-xs ${sortField === field ? "text-red-500" : "text-slate-300"}`}>
      {sortField === field ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  // Tab: Data Harian
  const filteredDaily = dailyAggregated
    .filter(d =>
      d.tanggal.toLowerCase().includes(search.toLowerCase()) ||
      d.hari.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  // Tab: Data Produk
  const filteredProducts = transactionRows
    .filter(d =>
      d.nama.toLowerCase().includes(search.toLowerCase()) ||
      d.kategoriProduk.toLowerCase().includes(search.toLowerCase()) ||
      d.tanggal.toLowerCase().includes(search.toLowerCase()) ||
      d.hari.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const fieldMap = { tanggal: "tanggal", hari: "hari", nama: "nama", terjual: "terjual", stok: "stok" };
      const f = fieldMap[sortField] || "tanggal";
      let va = a[f], vb = b[f];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  // Summary stats
  const totalTerjual = transactionRows.reduce((s, r) => s + r.terjual, 0);
  const totalStok = transactionRows.reduce((s, r) => s + r.stok, 0);
  const uniqueDates = new Set(transactionRows.map(r => r.tanggal)).size;
  const uniqueProducts = new Set(transactionRows.map(r => r.nama)).size;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-6 rounded-2xl flex items-start justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-4">
          <Clock3 className="text-blue-600 flex-shrink-0 mt-1" size={24} />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Riwayat Data Penjualan</h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              Menampilkan seluruh data historis yang dimuat dari server. Data ini menjadi dasar analisis K-Means dan forecasting.
            </p>
          </div>
        </div>
        {onExport && (
          <button onClick={onExport} className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl text-sm font-medium transition-colors shadow-sm">
            <Download size={16} /> Export Excel
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium">Total Baris Transaksi</p>
          <h2 className="text-2xl font-bold text-slate-800 mt-1">{transactionRows.length.toLocaleString("id-ID")}</h2>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium">Total Hari Unik</p>
          <h2 className="text-2xl font-bold text-slate-800 mt-1">{uniqueDates}</h2>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs text-emerald-600 font-medium">Total Terjual</p>
          <h2 className="text-2xl font-bold text-emerald-700 mt-1">{totalTerjual.toLocaleString("id-ID")}</h2>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs text-sky-600 font-medium">Total Stok</p>
          <h2 className="text-2xl font-bold text-sky-700 mt-1">{totalStok.toLocaleString("id-ID")}</h2>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-0 gap-4 flex-wrap">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => { setActiveTab("daily"); setSortField("tanggal"); setSortDir("desc"); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "daily" ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Data Harian ({dailyAggregated.length})
            </button>
            <button
              onClick={() => { setActiveTab("products"); setSortField("terjual"); setSortDir("desc"); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "products" ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Data Produk ({transactionRows.length.toLocaleString("id-ID")})
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={activeTab === "daily" ? "Cari tanggal/hari..." : "Cari produk/tanggal..."}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm bg-slate-50 focus:bg-white transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          {activeTab === "daily" ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                  <th className="p-4 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort("tanggal")}>
                    Tanggal <SortIcon field="tanggal" />
                  </th>
                  <th className="p-4 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort("hari")}>
                    Hari <SortIcon field="hari" />
                  </th>
                  <th className="p-4 font-semibold text-right cursor-pointer hover:text-slate-700" onClick={() => handleSort("Total_Stok")}>
                    Total Stok <SortIcon field="Total_Stok" />
                  </th>
                  <th className="p-4 font-semibold text-right cursor-pointer hover:text-slate-700" onClick={() => handleSort("Total_Terjual")}>
                    Total Terjual <SortIcon field="Total_Terjual" />
                  </th>
                  <th className="p-4 font-semibold text-right cursor-pointer hover:text-slate-700" onClick={() => handleSort("Jumlah_Produk")}>
                    Jumlah Produk <SortIcon field="Jumlah_Produk" />
                  </th>
                  <th className="p-4 font-semibold text-right">Rasio Terjual</th>
                </tr>
              </thead>
              <tbody>
                {filteredDaily.length === 0 ? (
                  <tr><td colSpan="6" className="text-center p-8 text-slate-400 italic">Data tidak ditemukan</td></tr>
                ) : (
                  filteredDaily.map((r, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-medium text-slate-800">{r.tanggal}</td>
                      <td className="p-4 text-slate-600">{r.hari}</td>
                      <td className="p-4 text-right font-semibold text-slate-700">{r.Total_Stok.toLocaleString("id-ID")}</td>
                      <td className="p-4 text-right font-semibold text-emerald-700">{r.Total_Terjual.toLocaleString("id-ID")}</td>
                      <td className="p-4 text-right text-slate-600">{r.Jumlah_Produk}</td>
                      <td className="p-4 text-right">
                        <span className={`text-sm font-medium ${r.Total_Stok > 0 && (r.Total_Terjual / r.Total_Stok) >= 0.7 ? "text-emerald-600" : r.Total_Stok > 0 && (r.Total_Terjual / r.Total_Stok) >= 0.4 ? "text-amber-600" : "text-red-500"}`}>
                          {r.Total_Stok > 0 ? `${((r.Total_Terjual / r.Total_Stok) * 100).toFixed(1)}%` : "—"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                  <th className="p-4 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort("tanggal")}>
                    Tanggal <SortIcon field="tanggal" />
                  </th>
                  <th className="p-4 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort("hari")}>
                    Hari <SortIcon field="hari" />
                  </th>
                  <th className="p-4 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort("nama")}>
                    Nama Produk <SortIcon field="nama" />
                  </th>
                  <th className="p-4 font-semibold">Kategori</th>
                  <th className="p-4 font-semibold text-right cursor-pointer hover:text-slate-700" onClick={() => handleSort("stok")}>
                    Stok <SortIcon field="stok" />
                  </th>
                  <th className="p-4 font-semibold text-right cursor-pointer hover:text-slate-700" onClick={() => handleSort("terjual")}>
                    Terjual <SortIcon field="terjual" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan="6" className="text-center p-8 text-slate-400 italic">Data tidak ditemukan</td></tr>
                ) : (
                  filteredProducts.slice(0, 500).map((r, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-medium text-slate-800">{r.tanggal}</td>
                      <td className="p-4 text-slate-600">{r.hari}</td>
                      <td className="p-4 font-medium text-slate-800">{r.nama}</td>
                      <td className="p-4 text-slate-500 text-sm">{r.kategoriProduk}</td>
                      <td className="p-4 text-right text-slate-700">{r.stok.toLocaleString("id-ID")}</td>
                      <td className="p-4 text-right font-semibold text-emerald-700">{r.terjual.toLocaleString("id-ID")}</td>
                    </tr>
                  ))
                )}
                {filteredProducts.length > 500 && (
                  <tr>
                    <td colSpan="6" className="text-center p-4 text-slate-400 text-sm italic">
                      Menampilkan 500 dari {filteredProducts.length.toLocaleString("id-ID")} baris. Gunakan pencarian untuk mempersempit hasil.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// APP
export default function App() {
  const [storedState] = useState(() => loadStoredAppState());
  const [isLogin, setIsLogin] = useState(storedState?.isLogin ?? false);
  const [page, setPage] = useState(storedState?.page ?? "dashboard");
  const [loggedUser, setLoggedUser] = useState(null);

  // App States
  const [errorMsg, setErrorMsg] = useState("");
  const [preprocessSummary, setPreprocessSummary] = useState(storedState?.preprocessSummary ?? null);
  const [transactionRows, setTransactionRows] = useState(storedState?.transactionRows ?? []);
  const [dailyAggregated, setDailyAggregated] = useState(storedState?.dailyAggregated ?? []);

  // Results
  const [elbowData, setElbowData] = useState(storedState?.elbowData ?? []);
  const [result, setResult] = useState(storedState?.result ?? null);
  const [futureForecasts, setFutureForecasts] = useState(storedState?.futureForecasts ?? []);
  const [needsReanalysis, setNeedsReanalysis] = useState(storedState?.needsReanalysis ?? false);

  // API loading state
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [datasetInfo, setDatasetInfo] = useState(null);

  // Fetch data dari backend Python
  const fetchFromAPI = useCallback(async () => {
    setApiLoading(true);
    setApiError("");
    setErrorMsg("");
    try {
      // Fetch semua sekaligus: data mentah + analisis + forecast
      const [fullData, info, analyzeResult, forecastResult] = await Promise.all([
        apiFetch("/api/full-data"),
        apiFetch("/api/dataset-info"),
        apiFetch("/api/analyze"),
        apiFetch("/api/forecast"),
      ]);

      setDatasetInfo(info);
      setPreprocessSummary(fullData.preprocessSummary);

      const dailyData = fullData.dailyAggregated;
      const productRows = analyzeResult.transactionRows || fullData.transactionRows;

      if (!dailyData || dailyData.length === 0) throw new Error("Data harian kosong dari server.");

      setDailyAggregated(dailyData);
      setTransactionRows(productRows);
      setElbowData(analyzeResult.elbowData || []);
      setResult({
        clusteredData: analyzeResult.clusteredData,
        stats: analyzeResult.stats,
        productInsights: buildProductSupportInsights(productRows, analyzeResult.clusteredData || []),
      });
      setFutureForecasts(forecastResult.forecasts || []);
      setNeedsReanalysis(false);
    } catch (err) {
      if (err.message?.includes("401") || err.message?.toLowerCase().includes("token")) {
        handleLogout();
      } else {
        setApiError(err.message || "Gagal terhubung ke server backend.");
      }
    } finally {
      setApiLoading(false);
    }
  }, []);

  // Restore session dari token tersimpan saat app pertama load
  useEffect(() => {
    const token = getToken();
    if (token && !isLogin) {
      apiFetch("/api/auth/me")
        .then((user) => {
          setLoggedUser(user);
          setIsLogin(true);
        })
        .catch(() => {
          removeToken();
        });
    }
  }, []);

  // Auto-fetch saat login jika belum ada data tersimpan
  useEffect(() => {
    if (isLogin && dailyAggregated.length === 0) {
      fetchFromAPI();
    }
  }, [isLogin]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        isLogin,
        page,
        preprocessSummary,
        transactionRows,
        dailyAggregated,
        elbowData,
        result,
        futureForecasts,
      })
    );
  }, [isLogin, page, preprocessSummary, transactionRows, dailyAggregated, elbowData, result, futureForecasts]);

  const applyAnalysisFromAPIResult = (apiResult) => {
    // apiResult dari /api/analyze: { clusteredData, stats, elbowData, transactionRows, preprocessSummary }
    setElbowData(apiResult.elbowData || []);
    setResult({ clusteredData: apiResult.clusteredData, stats: apiResult.stats, productInsights: buildProductSupportInsights(apiResult.transactionRows || [], apiResult.clusteredData || []) });
    setNeedsReanalysis(false);
  };

  useEffect(() => {
    if (needsReanalysis && dailyAggregated.length > 0) {
      // Re-run via API
      apiFetch("/api/analyze").then(apiResult => {
        applyAnalysisFromAPIResult(apiResult);
        setTransactionRows(apiResult.transactionRows || []);
      }).catch(() => {
        // fallback client-side
        const analysis = buildAnalysisFromDailyData(dailyAggregated, transactionRows);
        setElbowData(analysis.elbowData);
        setResult(analysis.result);
        setFutureForecasts(analysis.futureForecasts);
        setNeedsReanalysis(false);
      });
    }
  }, [needsReanalysis, dailyAggregated, transactionRows]);

  const handleLogin = () => setIsLogin(true);
  const handleLogout = () => {
    setIsLogin(false);
    setPage("dashboard");
    setPreprocessSummary(null);
    setTransactionRows([]);
    setDailyAggregated([]);
    setElbowData([]);
    setResult(null);
    setFutureForecasts([]);
    setNeedsReanalysis(false);
    setErrorMsg("");
    setApiError("");
    setDatasetInfo(null);
    removeToken();
    clearStoredAppState();
    setLoggedUser(null);
  };

  // ── Upload file → kirim ke backend, simpan ke DB ──────────────────────────
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setErrorMsg(""); setUploadMsg(""); setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/penjualan/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setUploadMsg(`✓ ${data.message}`);
      setPreprocessSummary(data.preprocessSummary);
      // Reload analisis dari backend
      await fetchFromAPI();
    } catch (err) {
      setErrorMsg(err.message || "Upload gagal.");
    } finally {
      setUploadLoading(false);
    }
  };

  // ── Download template dari backend ────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/export/template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Gagal download template");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "template_penjualan.xlsx";
      a.click(); URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(err.message || "Gagal download template.");
    }
  };

  // ── Export handlers ────────────────────────────────────────────────────────
  const handleExport = async (type) => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/export/${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Gagal export ${type}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(err.message || `Gagal export ${type}.`);
    }
  };

  const sseChartData = {
    labels: elbowData.map((_, i) => i + 1),
    datasets: [{
      label: "SSE (Sum of Squared Errors)",
      data: elbowData,
      borderColor: "#3b82f6",
      backgroundColor: "rgba(59, 130, 246, 0.2)",
      fill: true,
      tension: 0.1
    }]
  };

  const scatterData = result ? {
    datasets: result.stats.map(s => {
      const dataPoints = result.clusteredData
        .filter(d => d.cluster === s.label)
        .map(d => ({ x: d.Total_Stok, y: d.Total_Terjual, d }));
      return { label: s.label, data: dataPoints, backgroundColor: CLUSTER_COLORS[s.label] };
    })
  } : null;

  const donutData = result ? {
    labels: result.stats.map(s => s.label),
    datasets: [{
      data: result.stats.map(s => s.count),
      backgroundColor: result.stats.map(s => CLUSTER_COLORS[s.label]),
      borderWidth: 0, hoverOffset: 4
    }]
  } : null;

  if (!isLogin) {
    return (
      <AuthPage
        onLoginSuccess={(user) => {
          setLoggedUser(user);
          setIsLogin(true);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* SIDEBAR */}
      <div className="w-72 bg-white border-r border-slate-100 p-6 flex flex-col justify-between shadow-sm z-10 relative">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <img src="/logo.png" className="w-10" />
            <h1 className="text-xl font-bold text-red-600 tracking-tight">Prediksi Penjualan</h1>
          </div>
          <ul className="space-y-2">
            <li onClick={() => setPage("dashboard")} className={`transition-all duration-300 flex items-center gap-3 p-3 rounded-xl cursor-pointer ${page === "dashboard" ? "bg-red-50 text-red-600 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
              <Home size={20} /> Dashboard
            </li>
            <li onClick={() => setPage("forecasting")} className={`transition-all duration-300 flex items-center gap-3 p-3 rounded-xl cursor-pointer ${page === "forecasting" ? "bg-red-50 text-red-600 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
              <TrendingUp size={20} /> Forecasting
            </li>
            <li onClick={() => setPage("report")} className={`transition-all duration-300 flex items-center gap-3 p-3 rounded-xl cursor-pointer ${page === "report" ? "bg-red-50 text-red-600 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
              <BarChart3 size={20} /> Report K-Means
            </li>
            <li onClick={() => setPage("history")} className={`transition-all duration-300 flex items-center gap-3 p-3 rounded-xl cursor-pointer ${page === "history" ? "bg-red-50 text-red-600 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
              <Clock3 size={20} /> History
            </li>
          </ul>
        </div>
        <div className="border-t border-slate-100 pt-6 mt-6">
          <div className="flex items-center gap-3 mb-4 px-2">
            <UserCircle size={36} className="text-slate-400" />
            <div>
              <p className="text-sm font-semibold text-slate-800">{loggedUser?.nama || "User"}</p>
              <p className="text-xs text-slate-500">{loggedUser?.username || "Sawangan No.1"}</p>
            </div>
          </div>
          <div onClick={handleLogout} className="flex items-center gap-3 p-3 text-red-600 hover:bg-red-50 rounded-xl cursor-pointer transition-colors font-medium">
            <LogOut size={20} /> Logout
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {page === "dashboard" && (
          <>
            {/* Panel Sumber Data */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 bg-gradient-to-br from-white to-slate-50">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-start gap-4">
                  <div className="p-4 bg-red-50 text-red-600 rounded-2xl flex-shrink-0">
                    <Server size={28} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-lg">Sumber Data</h3>
                    <p className="text-sm text-slate-500 mb-2">Data diambil langsung dari backend server (dataset.csv)</p>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border ${apiLoading
                          ? "bg-amber-50 text-amber-700 border-amber-100"
                          : apiError
                            ? "bg-red-50 text-red-700 border-red-100"
                            : dailyAggregated.length > 0
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}>
                        {apiLoading ? (
                          <><RefreshCw size={12} className="animate-spin" /> Memuat data...</>
                        ) : apiError ? (
                          <><AlertTriangle size={12} /> Koneksi gagal</>
                        ) : dailyAggregated.length > 0 ? (
                          <><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Data berhasil dimuat</>
                        ) : (
                          <><span className="w-2 h-2 rounded-full bg-slate-400 inline-block" /> Belum ada data</>
                        )}
                      </span>
                    </div>
                    {apiError && (
                      <div className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-md flex items-center gap-1.5 mb-2 border border-red-100 font-medium">
                        <AlertTriangle size={14} /> {apiError} — Pastikan backend Python sudah berjalan.
                      </div>
                    )}
                    {errorMsg && (
                      <div className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-md flex items-center gap-1.5 mb-2 border border-red-100 font-medium">
                        <AlertTriangle size={14} /> {errorMsg}
                      </div>
                    )}
                    {datasetInfo && (
                      <p className="text-xs text-slate-500">
                        {datasetInfo.total_baris.toLocaleString("id-ID")} baris data •{" "}
                        {datasetInfo.total_produk_unik} produk unik •{" "}
                        {datasetInfo.tanggal_mulai} s/d {datasetInfo.tanggal_akhir}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={fetchFromAPI}
                    disabled={apiLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                  >
                    <RefreshCw size={16} className={apiLoading ? "animate-spin" : ""} />
                    {apiLoading ? "Memuat..." : "Muat Ulang Data"}
                  </button>
                  <button onClick={handleDownloadTemplate} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 transition-colors text-white rounded-xl text-sm font-medium shadow-sm">
                    <Download size={16} />
                    Template Excel
                  </button>                </div>
              </div>

              {/* Upload file ke database */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-3 font-medium">Upload file CSV/Excel — data akan disimpan ke database:</p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors font-medium ${uploadLoading ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"}`}>
                    {uploadLoading ? <RefreshCw size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    {uploadLoading ? "Mengupload..." : "Upload File"}
                    <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} disabled={uploadLoading} />
                  </label>
                  <span className="text-xs text-slate-400">Format: Tanggal, Hari, Nama Produk, Stok, Terjual</span>
                  {uploadMsg && <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">{uploadMsg}</span>}
                </div>
              </div>
            </div>

            {preprocessSummary && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-800">Pra-Pemrosesan Data</h2>
                  <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                    Sumber: Backend API
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500">Total Baris Awal</p>
                    <h3 className="text-xl font-bold text-slate-800">{preprocessSummary.total.toLocaleString("id-ID")}</h3>
                  </div>
                  <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                    <p className="text-xs text-green-600">Baris Valid</p>
                    <h3 className="text-xl font-bold text-green-700">{preprocessSummary.valid.toLocaleString("id-ID")}</h3>
                  </div>
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-xs text-red-600">Baris Dibuang</p>
                    <h3 className="text-xl font-bold text-red-700">{preprocessSummary.invalid}</h3>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-xs text-blue-600">Rentang Tanggal</p>
                    <h3 className="text-sm font-bold text-blue-700 mt-1">{preprocessSummary.startDate} <br /> {preprocessSummary.endDate}</h3>
                  </div>
                  <div className="p-4 bg-violet-50 rounded-xl border border-violet-100">
                    <p className="text-xs text-violet-600">Produk Unik</p>
                    <h3 className="text-xl font-bold text-violet-700">{preprocessSummary.uniqueProducts}</h3>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-xs text-amber-600">Kategori Produk</p>
                    <h3 className="text-xl font-bold text-amber-700">{preprocessSummary.uniqueCategories}</h3>
                  </div>
                  <div className="p-4 bg-cyan-50 rounded-xl border border-cyan-100">
                    <p className="text-xs text-cyan-600">Sumber Kategori</p>
                    <h3 className="text-sm font-bold text-cyan-700 mt-1">{preprocessSummary.categorySource}</h3>
                  </div>
                </div>
                {datasetInfo && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-xs text-emerald-600">Total Terjual (Keseluruhan)</p>
                      <h3 className="text-xl font-bold text-emerald-700">{datasetInfo.total_terjual.toLocaleString("id-ID")}</h3>
                    </div>
                    <div className="p-4 bg-sky-50 rounded-xl border border-sky-100">
                      <p className="text-xs text-sky-600">Total Stok (Keseluruhan)</p>
                      <h3 className="text-xl font-bold text-sky-700">{datasetInfo.total_stok.toLocaleString("id-ID")}</h3>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                      <p className="text-xs text-indigo-600">Total Hari Unik</p>
                      <h3 className="text-xl font-bold text-indigo-700">{datasetInfo.total_hari}</h3>
                    </div>
                    <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                      <p className="text-xs text-rose-600">Rasio Terjual/Stok</p>
                      <h3 className="text-xl font-bold text-rose-700">
                        {datasetInfo.total_stok > 0
                          ? `${((datasetInfo.total_terjual / datasetInfo.total_stok) * 100).toFixed(1)}%`
                          : "—"}
                      </h3>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><CalendarDays size={24} /></div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Hari Data</p>
                  <h2 className="text-2xl font-bold text-slate-800">
                    {apiLoading ? <span className="text-slate-300 animate-pulse">—</span> : dailyAggregated.length}
                  </h2>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Layers size={24} /></div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Jumlah Clusters</p>
                  <h2 className="text-2xl font-bold text-slate-800">
                    {apiLoading ? <span className="text-slate-300 animate-pulse">—</span> : result ? result.stats.length : 0}
                  </h2>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Activity size={24} /></div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Status Proses</p>
                  <h2 className="text-lg font-bold text-slate-800">
                    {apiLoading ? <span className="text-amber-500 animate-pulse">Memuat...</span> : result ? "Selesai" : "Menunggu"}
                  </h2>
                </div>
              </div>
            </div>

            {/* Loading skeleton */}
            {apiLoading && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-4 min-h-[200px]">
                <RefreshCw size={32} className="text-red-400 animate-spin" />
                <p className="text-slate-500 font-medium">Memuat dan menganalisis data dari server...</p>
                <p className="text-xs text-slate-400">Proses K-Means clustering sedang berjalan</p>
              </div>
            )}

            {result && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h2 className="font-semibold mb-4 text-slate-800">Evaluasi Model (Elbow Method / SSE)</h2>
                  <div className="h-64">
                    <Line data={sseChartData} options={{ maintainAspectRatio: false }} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                    <h2 className="font-semibold mb-6 flex items-center gap-2 text-slate-800"><Activity size={20} className="text-red-500" /> Klasifikasi Data Menggunakan K-Means (Scatter)</h2>
                    <div className="flex-1 min-h-[16rem] flex items-center justify-center">
                      <Scatter data={scatterData} options={{
                        maintainAspectRatio: false,
                        plugins: { tooltip: { callbacks: { label: (ctx) => `Hari: ${ctx.raw.d.hari}, Stok: ${ctx.raw.x}, Terjual: ${ctx.raw.y}` } } },
                        scales: { x: { title: { display: true, text: 'Total Stok' } }, y: { title: { display: true, text: 'Total Terjual' } } }
                      }} />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                    <h2 className="font-semibold mb-6 flex items-center gap-2 text-slate-800">Distribusi Kategori</h2>
                    <div className="flex-1 min-h-0 flex items-center justify-center pb-4">
                      <Doughnut data={donutData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h2 className="font-semibold mb-4 text-slate-800">Ringkasan Klaster</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-sm">
                          <th className="p-3 border-b">Kategori</th>
                          <th className="p-3 border-b text-right">Jumlah Hari</th>
                          <th className="p-3 border-b text-right">Rata-rata Terjual</th>
                          <th className="p-3 border-b text-right">Rata-rata Stok</th>
                          <th className="p-3 border-b text-right">Rentang Terjual</th>
                          <th className="p-3 border-b">Hari Dominan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.stats.map((s, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-3 font-medium">
                              <span className={`inline-flex px-2 py-1 rounded text-xs ${getClusterBadgeClasses(s.label)}`}>{s.label}</span>
                            </td>
                            <td className="p-3 text-right">{formatNumber(s.count)}</td>
                            <td className="p-3 text-right">{formatNumber(Math.round(s.avgTerjual))}</td>
                            <td className="p-3 text-right">{formatNumber(Math.round(s.avgStok))}</td>
                            <td className="p-3 text-right">{formatNumber(s.minTerjual)} - {formatNumber(s.maxTerjual)}</td>
                            <td className="p-3">{s.dominantDay}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {page === "report" && (
          <Report
            clusteredData={result?.clusteredData || []}
            clusterStats={result?.stats || []}
            productInsights={result?.productInsights || null}
            preprocessSummary={preprocessSummary}
            onExport={() => handleExport("report")}
          />
        )}

        {page === "forecasting" && (
          <ForecastPage
            futureForecasts={futureForecasts}
            preprocessSummary={preprocessSummary}
            onExport={() => handleExport("forecast")}
          />
        )}

        {page === "history" && (
          <HistoryPage
            transactionRows={transactionRows}
            dailyAggregated={dailyAggregated}
            onExport={() => handleExport("history")}
          />
        )}
      </div>
    </div>
  );
}
