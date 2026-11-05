import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-Memory Cache
interface CacheEntry {
  timestamp: number;
  data: any;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 小時快取

function normalizeSymbol(symbol: string): { original: string; yahooSymbol: string } {
  const clean = symbol.trim().toUpperCase();
  // 若為純數字 (例如 2454, 2308, 3711, 2356, 0050)，自動加上 .TW
  if (/^\d{4,6}$/.test(clean)) {
    return { original: clean, yahooSymbol: `${clean}.TW` };
  }
  return { original: clean, yahooSymbol: clean };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API: /api/historical-prices
  app.get('/api/historical-prices', async (req, res) => {
    try {
      const symbolsParam = (req.query.symbols as string) || '2454.TW,2308.TW,3711.TW,2356.TW,0050.TW';
      const rawSymbols = symbolsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (rawSymbols.length === 0) {
        return res.status(400).json({ success: false, error: '請提供至少一個股票代號 (symbols 參數)' });
      }

      const symbolMap = rawSymbols.map(normalizeSymbol);
      const cacheKey = symbolMap.map((s) => s.yahooSymbol).sort().join(',');

      const cached = cache.get(cacheKey);
      const now = Date.now();
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        res.setHeader('X-Cache-Status', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.json(cached.data);
      }

      // 5 年前
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const period1 = fiveYearsAgo.toISOString().split('T')[0];

      const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });
      const stockResults: Record<string, any> = {};
      const allDatesSet = new Set<string>();
      const warnings: string[] = [];

      await Promise.all(
        symbolMap.map(async ({ original, yahooSymbol }) => {
          try {
            const chartResult = await yf.chart(yahooSymbol, {
              period1,
              interval: '1d',
            });

            const rawQuotes = chartResult.quotes || [];
            const validQuotes: any[] = [];

            for (const q of rawQuotes) {
              if (q.date && typeof q.close === 'number' && !isNaN(q.close)) {
                const dateStr = q.date instanceof Date 
                  ? q.date.toISOString().split('T')[0] 
                  : new Date(q.date).toISOString().split('T')[0];

                // 優先使用 Adj Close (還原權息收盤價)，確保包含配息與拆權息之真實總報酬
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

            validQuotes.sort((a, b) => a.date.localeCompare(b.date));

            const firstDate = validQuotes[0]?.date || '';
            const lastDate = validQuotes[validQuotes.length - 1]?.date || '';

            const expectedStartDate = new Date(period1);
            const actualFirstDate = new Date(firstDate || period1);
            const diffDays = (actualFirstDate.getTime() - expectedStartDate.getTime()) / (1000 * 3600 * 24);
            const hasFullFiveYears = diffDays <= 90;

            if (!hasFullFiveYears && firstDate) {
              warnings.push(`股票 ${original} 上市未滿 5 年（首次交易日: ${firstDate}），前期將依已上市標的動態權重重算。`);
            }

            // 使用 original 與 yahooSymbol 同時作為索引鍵，方便前端依代號取用
            const resultPayload = {
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

            stockResults[original] = resultPayload;
            stockResults[yahooSymbol] = resultPayload;
          } catch (err: any) {
            console.error(`抓取 ${yahooSymbol} 失敗:`, err?.message);
            warnings.push(`無法取得代號 ${original} (${yahooSymbol}) 的歷史股價，請檢查代號是否正確。`);
          }
        })
      );

      const sortedTradingDates = Array.from(allDatesSet).sort();

      const responsePayload = {
        success: true,
        tradingDates: sortedTradingDates,
        stocks: stockResults,
        warning: warnings.length > 0 ? warnings.join('\n') : undefined,
        fetchedAt: new Date().toISOString(),
      };

      cache.set(cacheKey, { timestamp: now, data: responsePayload });

      res.setHeader('X-Cache-Status', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.json(responsePayload);
    } catch (error: any) {
      console.error('API /api/historical-prices error:', error);
      return res.status(500).json({ success: false, error: error?.message || '內部伺服器錯誤' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
