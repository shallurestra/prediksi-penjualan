import { apiFetch } from "./client";

export async function getFullData() {
  return apiFetch("/api/full-data");
}

export async function getDatasetInfo() {
  return apiFetch("/api/dataset-info");
}

export async function analyze() {
  return apiFetch("/api/analyze");
}

export async function getForecast() {
  return apiFetch("/api/forecast");
}

export async function getDailySales() {
  return apiFetch("/api/daily-sales");
}

export async function getTopProducts(limit = 10) {
  return apiFetch(`/api/top-products?limit=${limit}`);
}

export async function getProducts() {
  return apiFetch("/api/products");
}

// ── NEW: Activity Log ────────────────────────────────────────────────────────
export async function fetchActivityLog(limit = 50) {
  return apiFetch(`/api/activity-log?limit=${limit}`);
}

// ── NEW: Datasets ────────────────────────────────────────────────────────────
export async function fetchDatasets() {
  return apiFetch("/api/datasets");
}

export async function fetchDatasetDetail(datasetId) {
  return apiFetch(`/api/datasets/${datasetId}`);
}

export async function fetchDatasetAnalysis(datasetId) {
  return apiFetch(`/api/datasets/${datasetId}/analyze`);
}

export async function fetchForecastPeriod(startDate, endDate) {
  return apiFetch(`/api/forecast/period?start_date=${startDate}&end_date=${endDate}`);
}

export async function fetchDatasetForecastPeriod(datasetId, startDate, endDate) {
  return apiFetch(`/api/datasets/${datasetId}/forecast/period?start_date=${startDate}&end_date=${endDate}`);
}

// Aliases for backward compatibility
export const fetchFullData = getFullData;
export const fetchDatasetInfo = getDatasetInfo;
export const fetchAnalysis = analyze;
export const fetchForecast = getForecast;
