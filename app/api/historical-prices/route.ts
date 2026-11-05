import YahooFinance from 'yahoo-finance2';

// 啟用 Next.js Route Handler 快取機制（1 小時重新驗證一次，避免頻繁請求 Yahoo Finance）
export const revalidate = 3600;

// 伺服器端記憶體快取 (In-Memory Cache Fallback)，保存 1 小時
interface CacheEntry {
  timestamp: number;
  data: StockPriceResponse;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 小時

export interface HistoricalPricePoint {
  date: string; // YYYY-MM-DD
  close: number;
  adjClose: number; // 還原權息收盤價 (包含現金股利與拆權息之真實回報)
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface StockPriceResult {
  symbol: string;
  querySymbol: string;
  name?: string;
  currency?: string;
  firstAvailableDate: string;
  latestDate: string;
  hasFullFiveYears: boolean;
  totalDays: number;
  quotes: HistoricalPricePoint[];
}

export interface StockPriceResponse {
  success: boolean;
  tradingDates: string[]; // 統一對齊後的日期列表 (YYYY-MM-DD)
  stocks: Record<string, StockPriceResult>; // symbol -> 該檔股票收盤價資料
  warning?: string;
  fetchedAt: string;
}

// 符號標準化：台股純數字 (如 2454, 2308, 3711, 2356, 0050) 自動補上 .TW
function normalizeSymbol(symbol: string): { original: string; yahooSymbol: string } {
  const clean = symbol.trim().toUpperCase();
  if (/^\d{4,6}$/.test(clean)) {
    return { original: clean, yahooSymbol: `${clean}.TW` };
  }
  return { original: clean, yahooSymbol: clean };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols') || '2454.TW,2308.TW,3711.TW,2356.TW,0050.TW';
    
    // 解析股票代號陣列並去重
    const rawSymbols = symbolsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (rawSymbols.length === 0) {
      return Response.json(
        { success: false, error: '請提供至少一個股票代號 (symbols 參數)' },
        { status: 400 }
      );
    }

    // 標準化代號對照表
    const symbolMap = rawSymbols.map(normalizeSymbol);
    const cacheKey = symbolMap.map((s) => s.yahooSymbol).sort().join(',');

    // 檢查快取
    const cached = cache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return Response.json(cached.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
          'X-Cache-Status': 'HIT',
        },
      });
    }

    // 計算 5 年前的開始日期
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const period1 = fiveYearsAgo.toISOString().split('T')[0];

    const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });
    const stockResults: Record<string, StockPriceResult> = {};
    const allDatesSet = new Set<string>();
    const warnings: string[] = [];

    // 並行抓取各檔股票之 5 年歷史收盤價
    await Promise.all(
      symbolMap.map(async ({ original, yahooSymbol }) => {
        try {
          const chartResult = await yf.chart(yahooSymbol, {
            period1,
            interval: '1d',
          });

          const rawQuotes = chartResult.quotes || [];
          const validQuotes: HistoricalPricePoint[] = [];

          for (const q of rawQuotes) {
            if (q.date && typeof q.close === 'number' && !isNaN(q.close)) {
              const dateStr = q.date instanceof Date 
                ? q.date.toISOString().split('T')[0] 
                : new Date(q.date).toISOString().split('T')[0];

              // 抓取並使用 Adj Close (還原權息收盤價)
              const adjCloseVal = typeof q.adjclose === 'number' && !isNaN(q.adjclose) ? q.adjclose : q.close;

              validQuotes.push({
                date: dateStr,
                close: Math.round(q.close * 100) / 100,
                adjClose: Math.round(adjCloseVal * 100) / 100,
                open: q.open ? Math.round(q.open * 100) / 100 : undefined,
                high: q.high ? Math.round(q.high * 100) / 100 : undefined,
                low: q.low ? Math.round(q.low * 100) / 100 : undefined,
                volume: q.volume || undefined,
              });
              allDatesSet.add(dateStr);
            }
          }

          // 排序日期
          validQuotes.sort((a, b) => a.date.localeCompare(b.date));

          const firstDate = validQuotes[0]?.date || '';
          const lastDate = validQuotes[validQuotes.length - 1]?.date || '';

          // 檢查資料長度（若首次交易日晚於 5 年前超過 90 天，標註未滿 5 年）
          const expectedStartDate = new Date(period1);
          const actualFirstDate = new Date(firstDate || period1);
          const diffDays = (actualFirstDate.getTime() - expectedStartDate.getTime()) / (1000 * 3600 * 24);
          const hasFullFiveYears = diffDays <= 90;

          if (!hasFullFiveYears && firstDate) {
            warnings.push(`股票 ${original} 上市未滿 5 年（首次收盤日: ${firstDate}），前期將按已上市標的動態重算權重。`);
          }

          const resultObj: StockPriceResult = {
            symbol: original,
            querySymbol: yahooSymbol,
            name: chartResult.meta?.shortName || chartResult.meta?.symbol || original,
            currency: chartResult.meta?.currency || 'TWD',
            firstAvailableDate: firstDate,
            latestDate: lastDate,
            hasFullFiveYears,
            totalDays: validQuotes.length,
            quotes: validQuotes,
          };

          stockResults[original] = resultObj;
          stockResults[yahooSymbol] = resultObj;
        } catch (err: any) {
          console.error(`抓取 ${yahooSymbol} 失敗:`, err?.message);
          warnings.push(`無法取得代號 ${original} (${yahooSymbol}) 的歷史股價，請檢查代號是否正確。`);
        }
      })
    );

    // 日期清單從小到大排序
    const sortedTradingDates = Array.from(allDatesSet).sort();

    const responsePayload: StockPriceResponse = {
      success: true,
      tradingDates: sortedTradingDates,
      stocks: stockResults,
      warning: warnings.length > 0 ? warnings.join('\n') : undefined,
      fetchedAt: new Date().toISOString(),
    };

    // 寫入快取
    cache.set(cacheKey, {
      timestamp: now,
      data: responsePayload,
    });

    return Response.json(responsePayload, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        'X-Cache-Status': 'MISS',
      },
    });
  } catch (error: any) {
    console.error('API /api/historical-prices 發生錯誤:', error);
    return Response.json(
      {
        success: false,
        error: error?.message || '內部伺服器錯誤',
      },
      { status: 500 }
    );
  }
}
