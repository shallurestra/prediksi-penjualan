import { useState, useEffect, useCallback } from "react";
import { getMe, getToken, removeToken } from "../api/client";
import { getFullData, getDatasetInfo, analyze, getForecast } from "../api/dataService";
import { uploadFile } from "../api/uploadService";
import { exportHistory, exportReport, exportForecast, exportTemplate } from "../api/exportService";
import { buildProductSupportInsights, loadStoredAppState, clearStoredAppState } from "../components/shared/helpers";
import { STORAGE_KEY, STORAGE_VERSION } from "../components/shared/constants";

export function useAppData() {
  const [storedState] = useState(() => loadStoredAppState());

  // Auth
  const [isLogin, setIsLogin]       = useState(storedState?.isLogin ?? false);
  const [loggedUser, setLoggedUser] = useState(null);
  const [page, setPage]             = useState(storedState?.page ?? "dashboard");

  // Data
  const [preprocessSummary, setPreprocessSummary] = useState(storedState?.preprocessSummary ?? null);
  const [transactionRows, setTransactionRows]       = useState(storedState?.transactionRows ?? []);
  const [dailyAggregated, setDailyAggregated]       = useState(storedState?.dailyAggregated ?? []);
  const [elbowData, setElbowData]                   = useState(storedState?.elbowData ?? []);
  const [result, setResult]                         = useState(storedState?.result ?? null);
  const [futureForecasts, setFutureForecasts]       = useState(storedState?.futureForecasts ?? []);
  const [needsReanalysis, setNeedsReanalysis]       = useState(storedState?.needsReanalysis ?? false);

  // UI
  const [errorMsg, setErrorMsg]     = useState("");
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError]     = useState("");
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMsg, setUploadMsg]   = useState("");

  // ── Persist to localStorage ─────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION, isLogin, page, preprocessSummary,
      transactionRows, dailyAggregated, elbowData, result, futureForecasts,
    }));
  }, [isLogin, page, preprocessSummary, transactionRows, dailyAggregated, elbowData, result, futureForecasts]);

  // ── Logout ──────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    setIsLogin(false); setPage("dashboard"); setLoggedUser(null);
    setPreprocessSummary(null); setTransactionRows([]); setDailyAggregated([]);
    setElbowData([]); setResult(null); setFutureForecasts([]);
    setNeedsReanalysis(false); setErrorMsg(""); setApiError("");
    setDatasetInfo(null); setUploadMsg("");
    removeToken(); clearStoredAppState();
  }, []);

  // ── Fetch all data from API ─────────────────────────────────────────────────
  const fetchFromAPI = useCallback(async () => {
    setApiLoading(true); setApiError(""); setErrorMsg("");
    try {
      const [fullData, info, analyzeResult, forecastResult] = await Promise.all([
        getFullData(), getDatasetInfo(), analyze(), getForecast(),
      ]);
      setDatasetInfo(info);
      setPreprocessSummary(fullData.preprocessSummary);
      setDailyAggregated(fullData.dailyAggregated);
      const productRows = analyzeResult.transactionRows || fullData.transactionRows;
      setTransactionRows(productRows);
      setElbowData(analyzeResult.elbowData || []);
      setResult({
        clusteredData:   analyzeResult.clusteredData,
        stats:           analyzeResult.stats,
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
  }, [handleLogout]);

  // ── Restore session on mount ────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (token && !isLogin) {
      import("../api/authService").then(({ getMe }) =>
        getMe()
          .then((user) => { setLoggedUser(user); setIsLogin(true); })
          .catch(() => removeToken())
      );
    }
  }, []);

  // ── Auto-fetch on login if no data ──────────────────────────────────────────
  useEffect(() => {
    if (isLogin && dailyAggregated.length === 0) fetchFromAPI();
  }, [isLogin]);

  // ── Re-analyze if needed ────────────────────────────────────────────────────
  useEffect(() => {
    if (needsReanalysis && dailyAggregated.length > 0) {
      analyze().then((r) => {
        setElbowData(r.elbowData || []);
        setResult({
          clusteredData: r.clusteredData,
          stats: r.stats,
          productInsights: buildProductSupportInsights(r.transactionRows || transactionRows, r.clusteredData || []),
        });
        setNeedsReanalysis(false);
      }).catch(() => setNeedsReanalysis(false));
    }
  }, [needsReanalysis, dailyAggregated]);

  // ── Upload file ─────────────────────────────────────────────────────────────
  const handleFileUpload = useCallback(async (file) => {
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
  }, [fetchFromAPI]);

  // ── Export handlers ─────────────────────────────────────────────────────────
  const handleExport = useCallback(async (type) => {
    try {
      const map = { history: exportHistory, report: exportReport, forecast: exportForecast, template: exportTemplate };
      await map[type]?.();
    } catch (err) {
      setErrorMsg(err.message || `Gagal export ${type}.`);
    }
  }, []);

  return {
    // auth
    isLogin, setIsLogin, loggedUser, setLoggedUser, handleLogout,
    // navigation
    page, setPage,
    // data
    preprocessSummary, transactionRows, dailyAggregated,
    elbowData, result, futureForecasts, datasetInfo,
    // ui state
    errorMsg, setErrorMsg, apiLoading, apiError,
    uploadLoading, uploadMsg,
    // actions
    fetchFromAPI, handleFileUpload, handleExport,
  };
}
