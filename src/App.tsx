/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  PortfolioHolding,
  RangePreset,
  RebalanceMode,
  RealDataApiResponse,
  IpoNotice,
} from './types/etf';
import {
  calculateEtfNavWithRebalancing,
  calculateRangeMetrics,
} from './utils/etfCalculator';
import { exportNavHistoryToCsv } from './utils/exportCsv';
import { Header } from './components/Header';
import { MetricsCards } from './components/MetricsCards';
import { NavTrendChart } from './components/NavTrendChart';
import { PortfolioManager, DEFAULT_HOLDINGS } from './components/PortfolioManager';
import { HoldingsBreakdown } from './components/HoldingsBreakdown';
import { Database, RefreshCw, AlertCircle, CheckCircle2, Check, Share2, Sparkles } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'custom_etf_holdings_v2';

// 4. 【URL 狀態分享機制】：解析與編碼輔助函式
function parsePortfolioFromUrl(): PortfolioHolding[] | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const portfolioStr = params.get('portfolio');
  if (!portfolioStr) return null;

  try {
    const fallbackColors = ['#8b5cf6', '#10b981', '#06b6d4', '#f59e0b', '#3b82f6', '#ec4899', '#6366f1'];
    const nameMap: Record<string, string> = {
      '2454': '聯發科',
      '2308': '台達電',
      '3711': '日月光投控',
      '2356': '英業達',
      '2330': '台積電',
      '2317': '鴻海',
      '2382': '廣達',
      '0050': '元大台灣50',
      'NVDA': '輝達 (NVIDIA)',
      'AAPL': '蘋果 (Apple)',
      'MSFT': '微軟 (Microsoft)',
    };

    const chunks = portfolioStr.split(',').map((c) => c.trim()).filter(Boolean);
    const result: PortfolioHolding[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const parts = chunks[i].split(':');
      if (parts.length !== 2) continue;
      const rawSymbol = parts[0].trim().toUpperCase();
      const weight = parseInt(parts[1].trim(), 10);
      if (isNaN(weight) || weight <= 0) continue;

      let fullSymbol = rawSymbol;
      if (/^\d{4,6}$/.test(rawSymbol)) {
        fullSymbol = `${rawSymbol}.TW`;
      }
      const baseCode = rawSymbol.replace(/\.TW$/i, '');
      const stockName = nameMap[baseCode] || fullSymbol;

      result.push({
        id: `url_${i}_${Date.now()}`,
        symbol: fullSymbol,
        name: stockName,
        weight,
        color: fallbackColors[i % fallbackColors.length],
      });
    }

    if (result.length > 0) {
      return result;
    }
  } catch (err) {
    console.warn('解析 URL portfolio 參數失敗:', err);
  }
  return null;
}

function encodePortfolioToParam(holdings: PortfolioHolding[]): string {
  return holdings
    .map((h) => `${h.symbol.replace(/\.TW$/i, '')}:${Math.round(h.weight)}`)
    .join(',');
}

export default function App() {
  // 1. 初始化持股：URL 參數優先 > LocalStorage > 預設組合
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(() => {
    // 優先解析網址列的 portfolio 參數
    const fromUrl = parsePortfolioFromUrl();
    if (fromUrl && fromUrl.length > 0) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fromUrl));
      } catch (e) {}
      return fromUrl;
    }

    // 其次讀取 LocalStorage
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('讀取 LocalStorage 失敗，使用預設投資組合:', e);
    }

    return DEFAULT_HOLDINGS;
  });

  // 2. 回測模式狀態：買進持有 (buy_and_hold) vs 每季再平衡 (quarterly_rebalance)
  const [rebalanceMode, setRebalanceMode] = useState<RebalanceMode>('buy_and_hold');

  // 3. 基準對比標的 (預設 0050.TW)
  const [benchmarkSymbol, setBenchmarkSymbol] = useState<string>('0050.TW');

  // 4. 真實 Yahoo Finance API 資料狀態
  const [useRealData, setUseRealData] = useState<boolean>(true);
  const [realData, setRealData] = useState<RealDataApiResponse | null>(null);
  const [isLoadingRealData, setIsLoadingRealData] = useState<boolean>(false);
  const [realDataError, setRealDataError] = useState<string | null>(null);
  const [lastFetchedTime, setLastFetchedTime] = useState<string | null>(null);

  // 分享複製提示狀態
  const [shareToast, setShareToast] = useState<boolean>(false);

  // 總權重計算與 URL / LocalStorage 同步
  const totalWeight = useMemo(() => {
    return holdings.reduce((sum, h) => sum + Math.round(Number(h.weight) || 0), 0);
  }, [holdings]);

  useEffect(() => {
    if (totalWeight === 100 && typeof window !== 'undefined') {
      try {
        // 同步存入 LocalStorage
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(holdings));

        // 動態將當前投資組合編碼到網址 Query 參數中 (?portfolio=2454:40,2308:25,...)
        const param = encodePortfolioToParam(holdings);
        const url = new URL(window.location.href);
        url.searchParams.set('portfolio', param);
        window.history.replaceState({}, '', url.toString());
      } catch (err) {
        console.error('更新 URL 與 LocalStorage 失敗:', err);
      }
    }
  }, [holdings, totalWeight]);

  // 需要抓取的代號列表 (含持股與對比標的)
  const querySymbolsString = useMemo(() => {
    const list = holdings.map((h) => h.symbol.trim()).filter(Boolean);
    if (benchmarkSymbol.trim()) {
      list.push(benchmarkSymbol.trim());
    }
    return Array.from(new Set(list)).sort().join(',');
  }, [holdings, benchmarkSymbol]);

  // 向 API 獲取 5 年每日 Adj Close 資料
  const fetchRealStockPrices = useCallback(async () => {
    if (!querySymbolsString) return;
    setIsLoadingRealData(true);
    setRealDataError(null);

    try {
      const response = await fetch(`/api/historical-prices?symbols=${encodeURIComponent(querySymbolsString)}`);
      if (!response.ok) {
        throw new Error(`API 伺服器狀態碼 ${response.status}`);
      }
      const json: RealDataApiResponse = await response.json();
      if (!json.success) {
        throw new Error(json.warning || '無法獲取股票資料');
      }
      setRealData(json);
      setLastFetchedTime(new Date().toLocaleTimeString('zh-TW', { hour12: false }));
    } catch (err: any) {
      console.warn('API 連線問題，啟用備援回測資料:', err?.message);
      setRealDataError(err?.message || '暫時無法連線至外部 API');
    } finally {
      setIsLoadingRealData(false);
    }
  }, [querySymbolsString]);

  useEffect(() => {
    if (useRealData) {
      fetchRealStockPrices();
    }
  }, [useRealData, fetchRealStockPrices]);

  // 5. 核心淨值計算（依據使用者選擇之買進持有或每季再平衡模式）
  const { navPoints: allNavData, ipoNotices } = useMemo(() => {
    return calculateEtfNavWithRebalancing(
      holdings,
      rebalanceMode,
      useRealData ? realData : null,
      benchmarkSymbol
    );
  }, [holdings, rebalanceMode, useRealData, realData, benchmarkSymbol]);

  const totalPoints = allNavData.length;

  // 6. 查詢區間狀態 (預設 5Y)
  const [selectedPreset, setSelectedPreset] = useState<RangePreset>('5Y');
  const [startIndex, setStartIndex] = useState<number>(0);
  const [endIndex, setEndIndex] = useState<number>(Math.max(0, totalPoints - 1));

  useEffect(() => {
    if (totalPoints > 0) {
      setEndIndex(totalPoints - 1);
    }
  }, [totalPoints]);

  // 7. 區間績效指標計算
  const metrics = useMemo(() => {
    return calculateRangeMetrics(allNavData, startIndex, endIndex);
  }, [allNavData, startIndex, endIndex]);

  const handleRangeChange = useCallback(
    (newStart: number, newEnd: number, preset: RangePreset) => {
      setStartIndex(newStart);
      setEndIndex(newEnd);
      setSelectedPreset(preset);
    },
    []
  );

  const rangeLabel = useMemo(() => {
    switch (selectedPreset) {
      case '1M':
        return '近 1 個月';
      case '6M':
        return '近 6 個月';
      case '1Y':
        return '近 1 年';
      case '3Y':
        return '近 3 年';
      case '5Y':
        return '5 年全期';
      case 'CUSTOM':
        return '自訂區間';
    }
  }, [selectedPreset]);

  // 重設為預設持股
  const handleResetDefault = () => {
    setHoldings(DEFAULT_HOLDINGS);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_HOLDINGS));
      const param = encodePortfolioToParam(DEFAULT_HOLDINGS);
      const url = new URL(window.location.href);
      url.searchParams.set('portfolio', param);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      console.error(e);
    }
    setStartIndex(0);
    setEndIndex(totalPoints - 1);
    setSelectedPreset('5Y');
  };

  const handleExportCsv = () => {
    exportNavHistoryToCsv(holdings, allNavData);
  };

  // 複製帶有 portfolio 參數之分享連結
  const handleShareUrl = () => {
    if (typeof window === 'undefined') return;
    const param = encodePortfolioToParam(holdings);
    const url = new URL(window.location.href);
    url.searchParams.set('portfolio', param);
    const fullShareUrl = url.toString();

    navigator.clipboard
      .writeText(fullShareUrl)
      .then(() => {
        setShareToast(true);
        setTimeout(() => setShareToast(false), 3000);
      })
      .catch(() => {
        // Fallback for sandboxed frames
        prompt('請手動複製此專屬分享連結：', fullShareUrl);
      });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-red-100 selection:text-red-900 relative">
      {/* 浮動提示 Toast (成功複製分享網址) */}
      {shareToast && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>已複製專屬 ETF 投資組合分享連結至剪貼簿！</span>
        </div>
      )}

      {/* 頁首導航 */}
      <Header
        onSelectPreset={(newHoldings) => {
          setHoldings(newHoldings);
        }}
        onReset={handleResetDefault}
        onExportCsv={handleExportCsv}
        onShare={handleShareUrl}
        copiedToast={shareToast}
      />

      {/* 主儀表板視窗 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
        {/* 數據來源狀態與重新整理列 */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Database className="w-4 h-4 text-red-600" />
              <span>股價數據:</span>
            </div>

            {useRealData && realData && !isLoadingRealData ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Yahoo Finance 真實 Adj Close 還原權息收盤價 ({realData.tradingDates.length} 交易日)
              </span>
            ) : isLoadingRealData ? (
              <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 font-medium animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                正在自 Yahoo Finance 獲取 5 年還原權息行情...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                5年模擬回測模式
              </span>
            )}

            {lastFetchedTime && useRealData && (
              <span className="text-slate-400 font-mono text-[11px] hidden md:inline">
                更新: {lastFetchedTime} (伺服器快取 1小時)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {useRealData && (
              <button
                type="button"
                onClick={fetchRealStockPrices}
                disabled={isLoadingRealData}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
                title="重新取得最新行情"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingRealData ? 'animate-spin' : ''}`} />
                <span>重新獲取</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setUseRealData(!useRealData)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                useRealData
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {useRealData ? '切換為模擬' : '切換為 Yahoo Finance'}
            </button>
          </div>
        </div>

        {/* 上市不足 5 年警告提示 */}
        {ipoNotices.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-900 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-bold text-amber-950">
                部分成分股上市未滿 5 年提示
              </span>
              <div className="text-amber-800 leading-relaxed">
                {ipoNotices.map((n) => (
                  <div key={n.symbol}>• {n.message}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. 績效與風險指標面板 (Performance Metrics: 最新淨值, 累積報酬率, 年化報酬率, 最大回撤) */}
        <MetricsCards
          metrics={metrics}
          selectedPreset={selectedPreset}
          rangeLabel={rangeLabel}
          rebalanceMode={rebalanceMode}
          benchmarkSymbol={benchmarkSymbol}
        />

        {/* 5. 互動式淨值走勢與對比圖表 (含百分比 Y 軸切換、強化迷你時間軸滑桿、起始日歸一) */}
        <NavTrendChart
          allData={allNavData}
          startIndex={startIndex}
          endIndex={endIndex}
          onRangeChange={handleRangeChange}
          selectedPreset={selectedPreset}
          rebalanceMode={rebalanceMode}
          onToggleRebalanceMode={setRebalanceMode}
          benchmarkSymbol={benchmarkSymbol}
          onChangeBenchmark={setBenchmarkSymbol}
        />

        {/* 1. 投資組合與權重管理區塊 (Portfolio Builder & LocalStorage & 1% 整數權重) */}
        <PortfolioManager
          holdings={holdings}
          onUpdateHoldings={setHoldings}
          onResetDefault={handleResetDefault}
        />

        {/* 3. 產業分佈與成分股微型趨勢圖 (Sparklines) */}
        <HoldingsBreakdown holdings={holdings} realData={realData} />
      </main>

      {/* 頁尾版權與免責聲明 */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-700">個人專屬 ETF 追蹤儀表板</span>
            <span className="mx-2">·</span>
            <span>支援 Adj Close 還原權息、百分比 Y 軸、URL 分享與 LocalStorage 持久化</span>
          </div>
          <div className="text-slate-400">
            免責聲明：本儀表板數據僅供策略回測與試算參考，非屬任何形式之投資建議。
          </div>
        </div>
      </footer>
    </div>
  );
}
