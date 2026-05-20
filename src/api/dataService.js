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

// Aliases for backward compatibility
export const fetchFullData = getFullData;
export const fetchDatasetInfo = getDatasetInfo;
export const fetchAnalysis = analyze;
export const fetchForecast = getForecast;
