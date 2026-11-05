export type RebalanceMode = 'buy_and_hold' | 'quarterly_rebalance';

export interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
  market: 'TW' | 'US';
  basePrice: number;
  currentPrice: number;
  fiveYearReturn: number;
  color: string;
}

export interface PortfolioHolding {
  id: string;
  symbol: string;
  name: string;
  weight: number; // Integer percentage, step=1, 0-100
  sector?: string;
  market?: 'TW' | 'US';
  color?: string;
}

export interface DailyPricePoint {
  date: string;
  prices: Record<string, number>;
  returns: Record<string, number>;
  benchmarkPrice: number;
  benchmarkReturn: number;
}

export interface HistoricalQuote {
  date: string; // YYYY-MM-DD
  close: number;
  adjClose: number; // 還原權息收盤價 (包含配息與拆分割之真實報酬)
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export type YAxisMode = 'nav' | 'return';

export interface DailyNavPoint {
  date: string; // YYYY-MM-DD
  nav: number; // 絕對自組 ETF 淨值 (發行價 10.00 元起算)
  dailyReturn: number; // 單日漲跌幅 %
  cumulativeReturn: number; // 累積報酬率 %
  benchmarkPrice?: number; // 原始對比標的 Adj Close
  normalizedNav?: number; // 當前可視區間起始日強制 10 元起算之淨值
  normalizedBenchmark?: number; // 當前可視區間起始日強制 10 元起算之對比標的淨值
  normalizedReturnEtf?: number; // 當前可視區間起始日為 0.00% 起算之相對報酬率 (%)
  normalizedReturnBenchmark?: number; // 當前可視區間起始日為 0.00% 起算之對比標的相對報酬率 (%)
  rebalancedToday?: boolean; // 當日是否進行了每季再平衡
}

export type RangePreset = '1M' | '6M' | '1Y' | '3Y' | '5Y' | 'CUSTOM';

export interface PerformanceMetrics {
  currentNav: number;
  baseNav: number;
  rangeReturn: number; // 查詢區間累積報酬率 (%)
  cagr: number; // 查詢區間年化報酬率 (CAGR, %)
  maxDrawdown: number; // 查詢區間最大回撤 (MDD, %)
  allTimeReturn: number; // 5年累計總報酬率 (%)
  rangeHigh: number;
  rangeLow: number;
  benchmarkRangeReturn?: number;
}

export interface RealStockResult {
  symbol: string;
  querySymbol: string;
  name?: string;
  currency?: string;
  firstAvailableDate: string;
  latestDate: string;
  hasFullFiveYears: boolean;
  totalDays: number;
  quotes: HistoricalQuote[];
}

export interface RealDataApiResponse {
  success: boolean;
  tradingDates: string[];
  stocks: Record<string, RealStockResult>;
  warning?: string;
  fetchedAt: string;
}

export interface IpoNotice {
  symbol: string;
  firstDate: string;
  message: string;
}
