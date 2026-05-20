import { useState } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import AuthBg from "./AuthBg";
import AuthBrand from "./AuthBrand";
import { register } from "../../api/authService";

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

export default function RegisterPage({ onGoLogin }) {
  const [nama, setNama]             = useState("");
  const [username, setUsername]     = useState("");
  const [password, setPassword]     = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [errorMsg, setErrorMsg]     = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading]       = useState(false);

  const pwMatch   = confirmPw.length > 0 && password === confirmPw;
  const pwNoMatch = confirmPw.length > 0 && password !== confirmPw;

  const handleSubmit = async () => {
    setErrorMsg(""); setSuccessMsg("");
    if (!nama.trim() || !username.trim() || !password.trim())
      return setErrorMsg("Semua kolom wajib diisi.");
    if (username.trim().length < 4) return setErrorMsg("Username minimal 4 karakter.");
    if (password.length < 6)        return setErrorMsg("Password minimal 6 karakter.");
    if (password !== confirmPw)     return setErrorMsg("Konfirmasi password tidak cocok.");
    setLoading(true);
    try {
      await register(nama.trim(), username.trim(), password);
      setSuccessMsg("Akun berhasil dibuat!");
      setTimeout(() => onGoLogin(), 1800);
    } catch (err) {
      setErrorMsg(err.message || "Registrasi gagal.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 focus:bg-white/10 transition-all";

  return (
    <div className="min-h-screen flex">
      <AuthBg />
      <div className="flex-1 relative">
        <AuthBrand />
      </div>

      <div className="w-full lg:w-[480px] flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-sm py-6">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-10 justify-center">
            <img src="/logo.png" className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1"
              onError={(e) => { e.target.style.display = "none"; }} />
            <span className="font-bold text-white text-lg">Prediksi Penjualan</span>
          </div>

          <div className="bg-white/[0.07] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/40">
            {/* Back button */}
            <button onClick={onGoLogin}
              className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-6 transition-colors group">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {successMsg} Mengalihkan...
                </div>
              )}
              {errorMsg && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-300 text-sm px-4 py-3 rounded-2xl">
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
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
                    onChange={(e) => setPassword(e.target.value)} className={inputCls + " pr-12"} />
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
                {loading
                  ? <><RefreshCw size={15} className="animate-spin" />Memproses...</>
                  : "Buat Akun →"}
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <p className="text-sm text-white/40">
                Sudah punya akun?{" "}
                <button onClick={onGoLogin}
                  className="text-red-400 font-semibold hover:text-red-300 transition-colors">
                  Masuk di sini
                </button>
              </p>
            </div>
          </div>

          <p className="text-center text-white/20 text-xs mt-6">© 2025 Sistem Analisis Penjualan</p>
        </div>
      </div>
    </div>
  );
}
