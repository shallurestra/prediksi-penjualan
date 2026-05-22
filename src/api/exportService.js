import { apiFetchBlob } from "./client";
import * as XLSX from "xlsx";

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
  // 1. Create a new workbook
  const wb = XLSX.utils.book_new();

  // 2. Create sheet 1: Data Penjualan
  const headers = [["Tanggal", "Hari", "Nama Produk", "Stok", "Terjual"]];
  const dataRows = [
    ["2025-10-01", "Rabu", "GETUK ORI 1 KG", 100, 75]
  ];
  const sheet1Data = [...headers, ...dataRows];
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);

  ws1['!cols'] = [
    { wch: 14 },
    { wch: 10 },
    { wch: 25 },
    { wch: 10 },
    { wch: 10 }
  ];

  XLSX.utils.book_append_sheet(wb, ws1, "Data Penjualan");

  // 3. Create sheet 2: Panduan
  const guideData = [
    ["Kolom", "Keterangan", "Contoh"],
    ["Tanggal", "Format YYYY-MM-DD atau D/M/YYYY", "2025-10-01"],
    ["Hari", "Nama hari Bahasa Indonesia", "Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu"],
    ["Nama Produk", "Nama produk yang dijual", "GETUK ORI 1 KG"],
    ["Stok", "Jumlah stok awal (angka)", 100],
    ["Terjual", "Jumlah terjual (angka)", 75]
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(guideData);

  ws2['!cols'] = [
    { wch: 15 },
    { wch: 45 },
    { wch: 45 }
  ];

  XLSX.utils.book_append_sheet(wb, ws2, "Panduan");

  // 4. Download workbook
  XLSX.writeFile(wb, "template_penjualan.xlsx");
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
