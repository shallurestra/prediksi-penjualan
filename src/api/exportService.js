import { apiFetchBlob } from "./client";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportHistory() {
  const blob = await apiFetchBlob("/api/export/history");
  downloadBlob(blob, `history_penjualan_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportReport() {
  const blob = await apiFetchBlob("/api/export/report");
  downloadBlob(blob, `report_kmeans_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportForecast() {
  const blob = await apiFetchBlob("/api/export/forecast");
  downloadBlob(blob, `forecast_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportTemplate() {
  const blob = await apiFetchBlob("/api/export/template");
  downloadBlob(blob, "template_penjualan.xlsx");
}

// Generic export function
export async function exportData(type) {
  const exportFunctions = {
    history: exportHistory,
    report: exportReport,
    forecast: exportForecast,
  };
  const fn = exportFunctions[type];
  if (fn) {
    return fn();
  }
  throw new Error(`Unknown export type: ${type}`);
}

// Alias for backward compatibility
export const downloadTemplate = exportTemplate;
