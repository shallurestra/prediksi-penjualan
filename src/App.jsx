import React, { useEffect, useState, useCallback } from "react";
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

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  LineElement, PointElement, Title, Tooltip, Legend
);

import AuthPage    from "./components/auth/AuthPage";
import Sidebar     from "./components/layout/Sidebar";
import Dashboard   from "./page/Dashboard";
import Forecasting from "./page/Forecasting";
import Report      from "./page/Report";
import History     from "./page/History";

import { apiFetch, getToken, setToken, removeToken, getCurrentUserData, setCurrentUserData, clearCurrentUserData } from "./api/client";
import { login, register, getCurrentUser } from "./api/authService";
import { fetchFullData, fetchDatasetInfo, fetchAnalysis, fetchForecast } from "./api/dataService";
import { uploadFile, clearData } from "./api/uploadService";
import { exportData, downloadTemplate } from "./api/exportService";

import { loadStoredAppState, clearStoredAppState, buildProductSupportInsights } from "./components/shared/helpers";
import { STORAGE_KEY, STORAGE_VERSION } from "./components/shared/constants";

export default function App() {
  const [storedState] = useState(() => loadStoredAppState());
  const [isLogin, setIsLogin]   = useState(storedState?.isLogin ?? false);
  const [page, setPage]         = useState(storedState?.page ?? "dashboard");
  const [loggedUser, setLoggedUser] = useState(storedState?.loggedUser ?? null);

  const [errorMsg, setErrorMsg]               = useState("");
  const [preprocessSummary, setPreprocessSummary] = useState(storedState?.preprocessSummary ?? null);
  const [transactionRows, setTransactionRows] = useState(storedState?.transactionRows ?? []);
  const [dailyAggregated, setDailyAggregated] = useState(storedState?.dailyAggregated ?? []);

  const [elbowData, setElbowData]             = useState(storedState?.elbowData ?? []);
  const [result, setResult]                   = useState(storedState?.result ?? null);
  const [futureForecasts, setFutureForecasts] = useState(storedState?.futureForecasts ?? []);

  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError]     = useState("");
  const [datasetInfo, setDatasetInfo] = useState(null);

  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMsg, setUploadMsg]         = useState("");

  const fetchFromAPI = useCallback(async () => {
    setApiLoading(true);
    setApiError("");
    setErrorMsg("");
    try {
      const [fullData, info, analyzeResult, forecastResult] = await Promise.all([
        fetchFullData(), fetchDatasetInfo(), fetchAnalysis(), fetchForecast(),
      ]);
      setDatasetInfo(info);
      setPreprocessSummary(fullData.preprocessSummary);
      const dailyData   = fullData.dailyAggregated;
      const productRows = analyzeResult.transactionRows || fullData.transactionRows;
      if (!dailyData || dailyData.length === 0) throw new Error("Data harian kosong dari server.");
      setDailyAggregated(dailyData);
      setTransactionRows(productRows);
      setElbowData(analyzeResult.elbowData || []);
      setResult({
        clusteredData:   analyzeResult.clusteredData,
        stats:           analyzeResult.stats,
        productInsights: buildProductSupportInsights(productRows, analyzeResult.clusteredData || []),
      });
      setFutureForecasts(forecastResult.forecasts || []);
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

  useEffect(() => {
    const token = getToken();
    if (token) {
      const storedUser = getCurrentUserData();
      if (storedUser) {
        setLoggedUser(storedUser);
        setIsLogin(true);
      } else {
        getCurrentUser()
          .then((user) => { setLoggedUser(user); setCurrentUserData(user); setIsLogin(true); })
          .catch(() => { removeToken(); clearCurrentUserData(); setIsLogin(false); setLoggedUser(null); });
      }
    }
  }, []);

  useEffect(() => {
    if (isLogin && dailyAggregated.length === 0) fetchFromAPI();
  }, [isLogin, fetchFromAPI]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION, isLogin, page, loggedUser,
      preprocessSummary, transactionRows, dailyAggregated,
      elbowData, result, futureForecasts,
    }));
  }, [isLogin, page, loggedUser, preprocessSummary, transactionRows, dailyAggregated, elbowData, result, futureForecasts]);

  const handleLogout = () => {
    setIsLogin(false); setPage("dashboard"); setPreprocessSummary(null);
    setTransactionRows([]); setDailyAggregated([]); setElbowData([]);
    setResult(null); setFutureForecasts([]); setErrorMsg(""); setApiError("");
    setDatasetInfo(null); removeToken(); clearCurrentUserData();
    clearStoredAppState(); setLoggedUser(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setErrorMsg(""); setUploadMsg(""); setUploadLoading(true);
    try {
      const data = await uploadFile(file);
      setUploadMsg(`✓ ${data.message}`);
      setPreprocessSummary(data.preprocessSummary);
      await fetchFromAPI();
    } catch (err) {
      setErrorMsg(err.message || "Upload gagal.");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try { await downloadTemplate(); }
    catch (err) { setErrorMsg(err.message || "Gagal download template."); }
  };

  const handleExport = async (type) => {
    try { await exportData(type); }
    catch (err) { setErrorMsg(err.message || `Gagal export ${type}.`); }
  };

  if (!isLogin) {
    return <AuthPage onLoginSuccess={(user) => { setLoggedUser(user); setIsLogin(true); }} />;
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1c0a0a 50%, #0f172a 100%)",
      }}
    >
      {/* Ambient background blobs */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden>
        <div className="absolute top-[-10%] right-[20%] w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(220,38,38,0.06) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-10%] left-[10%] w-[300px] h-[300px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(220,38,38,0.04) 0%, transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }} />
      </div>

      <Sidebar page={page} setPage={setPage} loggedUser={loggedUser} onLogout={handleLogout} />

      <div className="flex-1 overflow-auto relative z-10">
        <div className="p-6 min-h-full">
          {page === "dashboard" && (
            <Dashboard
              dailyAggregated={dailyAggregated}
              preprocessSummary={preprocessSummary}
              datasetInfo={datasetInfo}
              elbowData={elbowData}
              result={result}
              apiLoading={apiLoading}
              apiError={apiError}
              errorMsg={errorMsg}
              uploadLoading={uploadLoading}
              uploadMsg={uploadMsg}
              fetchFromAPI={fetchFromAPI}
              handleDownloadTemplate={handleDownloadTemplate}
              handleFileUpload={handleFileUpload}
            />
          )}
          {page === "forecasting" && (
            <Forecasting
              futureForecasts={futureForecasts}
              preprocessSummary={preprocessSummary}
              onExport={() => handleExport("forecast")}
            />
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
          {page === "history" && (
            <History
              transactionRows={transactionRows}
              dailyAggregated={dailyAggregated}
              onExport={() => handleExport("history")}
            />
          )}
        </div>
      </div>
    </div>
  );
}