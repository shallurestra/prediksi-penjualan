export const DAYS_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export const STORAGE_KEY = "sawangan-kmeans-dashboard";
export const STORAGE_VERSION = 5;

export const CLUSTER_COLORS = {
  Rendah: "rgba(239,68,68,0.8)",
  Sedang: "rgba(234,179,8,0.8)",
  Tinggi: "rgba(34,197,94,0.8)",
};

export const CLUSTER_BADGE_CLASSES = {
  Rendah: "bg-red-50 text-red-700",
  Sedang: "bg-amber-50 text-amber-700",
  Tinggi: "bg-green-50 text-green-700",
};

export const CONFIDENCE_BADGE_CLASSES = {
  Rendah: "bg-rose-50 text-rose-700",
  Sedang: "bg-sky-50 text-sky-700",
  Tinggi: "bg-emerald-50 text-emerald-700",
};

export const FORECAST_LIMITATIONS = [
  "Perkiraan dibentuk dari pola historis nama hari dan hasil K-Means, bukan dari model time-series tambahan.",
  "Model belum mempertimbangkan promo, musim libur, cuaca, atau kejadian khusus lain yang bisa mengubah permintaan.",
  "Tingkat kepercayaan akan lebih kuat bila riwayat data per nama hari semakin banyak dan pola kategorinya semakin konsisten.",
];
