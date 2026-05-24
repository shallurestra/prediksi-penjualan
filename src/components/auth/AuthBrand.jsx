const FEATURES = [
  { icon: "📊", text: "Analisis K-Means clustering penjualan harian" },
  { icon: "🔮", text: "Forecasting 7 hari ke depan otomatis" },
  { icon: "📈", text: "Laporan & export Excel lengkap" },
];

export default function AuthBrand() {
  return (
    <div className="hidden lg:flex flex-col justify-between h-full p-12 text-white">
      <div className="flex items-center gap-3">
        <img
          src="/logo.png"
          className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1 backdrop-blur"
          onError={(e) => { e.target.style.display = "none"; }}
        />
        <span className="font-bold text-lg tracking-tight">Prediksi Penjualan</span>
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Analisis Cerdas<br />
            <span className="text-red-400">Penjualan</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            Platform analisis berbasis K-Means untuk memahami pola penjualan
            dan meramalkan permintaan produk.
          </p>
        </div>
        <div className="space-y-4">
          {FEATURES.map((f) => (
            <div key={f.text} className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-base flex-shrink-0">
                {f.icon}
              </span>
              <span className="text-sm text-white/70">{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-white/25 text-xs">© 2026 Sistem Analisis Penjualan · K-Means</p>
    </div>
  );
}
