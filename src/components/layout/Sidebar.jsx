import { Home, BarChart3, TrendingUp, Clock3, UserCircle, LogOut, Sparkles } from "lucide-react";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: Home },
  { key: "forecasting", label: "Forecasting", icon: TrendingUp },
  { key: "history", label: "History", icon: Clock3 },
];

export default function Sidebar({ page, setPage, loggedUser, onLogout }) {
  const userName = loggedUser?.nama || loggedUser?.username || "User";
  const userHandle = loggedUser?.username || "—";

  return (
    <div
      className="w-72 flex flex-col justify-between flex-shrink-0 relative z-10"
      style={{
        background: "linear-gradient(160deg, #0f172a 0%, #1c0a0a 60%, #0f172a 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute top-[-80px] left-[-60px] w-[300px] h-[300px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(220,38,38,0.12) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-60px] right-[-40px] w-[200px] h-[200px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 70%)" }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Top section */}
      <div className="relative z-10 p-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 px-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)" }}>
            <img
              src="/logo.png"
              className="w-6 h-6 object-contain"
              alt="logo"
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <Sparkles size={18} className="text-red-400 hidden" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight leading-tight">Analisis Cerdas Penjualan</h1>
            <p className="text-[10px] text-white/30 tracking-widest uppercase">K-Means Analytics</p>
          </div>
        </div>

        {/* Nav label */}
        <p className="text-[10px] text-white/25 font-semibold uppercase tracking-[0.15em] px-3 mb-3">Menu Utama</p>

        {/* Nav items */}
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
            const active = page === key;
            return (
              <li
                key={key}
                onClick={() => setPage(key)}
                className="relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 group"
                style={
                  active
                    ? {
                      background: "rgba(220,38,38,0.15)",
                      border: "1px solid rgba(220,38,38,0.25)",
                      boxShadow: "0 0 20px rgba(220,38,38,0.08)",
                    }
                    : {
                      background: "transparent",
                      border: "1px solid transparent",
                    }
                }
              >
                {/* Active indicator */}
                {active && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full"
                    style={{ background: "linear-gradient(180deg, #ef4444, #dc2626)" }}
                  />
                )}
                <Icon
                  size={18}
                  className={`transition-colors flex-shrink-0 ${active ? "text-red-400" : "text-white/30 group-hover:text-white/60"}`}
                />
                <span
                  className={`text-sm font-medium transition-colors ${active ? "text-white" : "text-white/40 group-hover:text-white/70"}`}
                >
                  {label}
                </span>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Bottom: user card */}
      <div className="relative z-10 p-6">
        <div
          className="rounded-2xl p-4 mb-3"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(220,38,38,0.2)", border: "1px solid rgba(220,38,38,0.2)" }}
            >
              <UserCircle size={20} className="text-red-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{userName}</p>
              <p className="text-xs text-white/35 truncate">@{userHandle}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={{
              background: "rgba(220,38,38,0.1)",
              border: "1px solid rgba(220,38,38,0.2)",
              color: "rgba(252,165,165,0.8)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(220,38,38,0.2)";
              e.currentTarget.style.color = "#fca5a5";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(220,38,38,0.1)";
              e.currentTarget.style.color = "rgba(252,165,165,0.8)";
            }}
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
        <p className="text-center text-white/15 text-[10px]">© 2026 Sistem Analisis Penjualan</p>
      </div>
    </div>
  );
}