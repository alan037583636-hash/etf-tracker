import {
  PortfolioHolding,
  DailyNavPoint,
  PerformanceMetrics,
  RebalanceMode,
  RealDataApiResponse,
  IpoNotice,
} from '../types/etf';
import { getTradingDates, getStockPriceHistory } from './mockStockData';

// Helper to determine calendar quarter (1..4)
function getCalendarQuarter(dateStr: string): number {
  const month = parseInt(dateStr.slice(5, 7), 10);
  return Math.floor((month - 1) / 3) + 1;
}

/**
 * 核心計算引擎：
 * 支援「買進持有 (Buy and Hold)」與「每季再平衡 (Quarterly Rebalancing)」
 * 強制發行基準價為 10.00 元
 * 抓取並使用 Adj Close 還原權息價進行真實加權回測
 */
export function calculateEtfNavWithRebalancing(
  holdings: PortfolioHolding[],
  mode: RebalanceMode,
  realData: RealDataApiResponse | null,
  benchmarkSymbol: string = '0050.TW'
): { navPoints: DailyNavPoint[]; ipoNotices: IpoNotice[] } {
  // If realData is provided and has quotes, use it; otherwise fallback to synthetic
  if (realData && realData.tradingDates && realData.tradingDates.length > 0) {
    return calculateFromRealMarketData(holdings, mode, realData, benchmarkSymbol);
  } else {
    return calculateFromSyntheticData(holdings, mode, benchmarkSymbol);
  }
}

function calculateFromRealMarketData(
  holdings: PortfolioHolding[],
  mode: RebalanceMode,
  realData: RealDataApiResponse,
  benchmarkSymbol: string
): { navPoints: DailyNavPoint[]; ipoNotices: IpoNotice[] } {
  const dates = realData.tradingDates;
  const ipoNotices: IpoNotice[] = [];

  if (dates.length === 0 || holdings.length === 0) {
    return {
      navPoints: dates.map((date) => ({
        date,
        nav: 10.0,
        dailyReturn: 0,
        cumulativeReturn: 0,
        benchmarkPrice: 10.0,
      })),
      ipoNotices: [],
    };
  }

  // Pre-build date -> adjClose lookup maps
  const priceMaps = new Map<string, Map<string, number>>();
  for (const h of holdings) {
    const stock = realData.stocks[h.symbol] || realData.stocks[`${h.symbol}.TW`];
    const map = new Map<string, number>();

    if (stock && stock.quotes) {
      for (const q of stock.quotes) {
        // Must use adjClose
        map.set(q.date, q.adjClose ?? q.close);
      }

      if (!stock.hasFullFiveYears && stock.firstAvailableDate) {
        ipoNotices.push({
          symbol: h.symbol,
          firstDate: stock.firstAvailableDate,
          message: `股票 ${h.symbol} 上市未滿 5 年（首次收盤日：${stock.firstAvailableDate}），前期權重已自動重分配。`,
        });
      }
    }
    priceMaps.set(h.symbol, map);
  }

  // Benchmark price map
  const benchmarkMap = new Map<string, number>();
  const cleanBm = benchmarkSymbol.trim().toUpperCase();
  const bmData = realData.stocks[cleanBm] || realData.stocks[`${cleanBm}.TW`];
  if (bmData && bmData.quotes) {
    for (const q of bmData.quotes) {
      benchmarkMap.set(q.date, q.adjClose ?? q.close);
    }
  }

  const navPoints: DailyNavPoint[] = [];

  // Track shares held for each stock: Map<symbol, number>
  let sharesHeld = new Map<string, number>();
  let currentNav = 10.0; // Inception price = 10.00
  let lastQuarter = getCalendarQuarter(dates[0]);

  // Initial setup at Day 0:
  // Allocate 10.00 to actively trading stocks on Day 0
  const day0 = dates[0];
  const activeDay0: { symbol: string; weight: number; price: number }[] = [];

  for (const h of holdings) {
    const p0 = priceMaps.get(h.symbol)?.get(day0);
    if (typeof p0 === 'number' && p0 > 0) {
      activeDay0.push({ symbol: h.symbol, weight: h.weight, price: p0 });
    }
  }

  const sumWeightDay0 = activeDay0.reduce((sum, item) => sum + item.weight, 0) || 100;
  for (const item of activeDay0) {
    const normalizedW = item.weight / sumWeightDay0; // fraction summing to 1.0
    const allocValue = 10.0 * normalizedW;
    sharesHeld.set(item.symbol, allocValue / item.price);
  }

  const bmInitialPrice = benchmarkMap.get(day0) || 10.0;

  navPoints.push({
    date: day0,
    nav: 10.0,
    dailyReturn: 0,
    cumulativeReturn: 0,
    benchmarkPrice: bmInitialPrice,
    rebalancedToday: false,
  });

  // Calculate day by day
  for (let t = 1; t < dates.length; t++) {
    const date = dates[t];
    const prevDate = dates[t - 1];
    const quarter = getCalendarQuarter(date);
    const isNewQuarter = quarter !== lastQuarter;
    let didRebalance = false;

    // Check currently available prices for all holdings
    const currentPrices = new Map<string, number>();
    for (const h of holdings) {
      const p = priceMaps.get(h.symbol)?.get(date);
      if (typeof p === 'number' && p > 0) {
        currentPrices.set(h.symbol, p);
      }
    }

    // 1. Calculate unadjusted NAV today based on shares currently held
    let dayNav = 0;
    for (const [sym, shares] of sharesHeld.entries()) {
      const p = currentPrices.get(sym) || priceMaps.get(sym)?.get(prevDate) || 0;
      dayNav += shares * p;
    }

    if (dayNav <= 0) dayNav = currentNav;

    // 2. Check if newly listed stock appeared today (entered after IPO)
    for (const h of holdings) {
      if (!sharesHeld.has(h.symbol) && currentPrices.has(h.symbol)) {
        // New stock just listed today! Rebalance to include it
        isNewQuarter || (didRebalance = true);
      }
    }

    // 3. Perform Rebalancing if Mode B and New Quarter (or if a newly listed stock entered)
    if (mode === 'quarterly_rebalance' && isNewQuarter) {
      didRebalance = true;
      lastQuarter = quarter;

      // Rebalance back to target weights:
      const activeNow: { symbol: string; targetWeight: number; price: number }[] = [];
      for (const h of holdings) {
        const p = currentPrices.get(h.symbol);
        if (typeof p === 'number' && p > 0) {
          activeNow.push({ symbol: h.symbol, targetWeight: h.weight, price: p });
        }
      }

      const totalActiveWeight = activeNow.reduce((sum, item) => sum + item.targetWeight, 0) || 100;
      const newShares = new Map<string, number>();

      for (const item of activeNow) {
        const weightFrac = item.targetWeight / totalActiveWeight;
        const targetCapital = dayNav * weightFrac;
        newShares.set(item.symbol, targetCapital / item.price);
      }
      sharesHeld = newShares;
    } else if (didRebalance) {
      // One-off rebalance for new stock in Buy-and-Hold
      const activeNow: { symbol: string; targetWeight: number; price: number }[] = [];
      for (const h of holdings) {
        const p = currentPrices.get(h.symbol);
        if (typeof p === 'number' && p > 0) {
          activeNow.push({ symbol: h.symbol, targetWeight: h.weight, price: p });
        }
      }
      const totalActiveWeight = activeNow.reduce((sum, item) => sum + item.targetWeight, 0) || 100;
      const newShares = new Map<string, number>();

      for (const item of activeNow) {
        const weightFrac = item.targetWeight / totalActiveWeight;
        const targetCapital = dayNav * weightFrac;
        newShares.set(item.symbol, targetCapital / item.price);
      }
      sharesHeld = newShares;
    }

    currentNav = dayNav;
    const roundedNav = Math.round(currentNav * 1000) / 1000;
    const prevNav = navPoints[t - 1].nav;
    const dailyReturnPct = ((roundedNav - prevNav) / prevNav) * 100;
    const cumulativeReturnPct = ((roundedNav - 10.0) / 10.0) * 100;

    const bmPrice = benchmarkMap.get(date) || benchmarkMap.get(prevDate) || bmInitialPrice;

    navPoints.push({
      date,
      nav: roundedNav,
      dailyReturn: Math.round(dailyReturnPct * 100) / 100,
      cumulativeReturn: Math.round(cumulativeReturnPct * 100) / 100,
      benchmarkPrice: bmPrice,
      rebalancedToday: didRebalance,
    });
  }

  return { navPoints, ipoNotices };
}

function calculateFromSyntheticData(
  holdings: PortfolioHolding[],
  mode: RebalanceMode,
  benchmarkSymbol: string
): { navPoints: DailyNavPoint[]; ipoNotices: IpoNotice[] } {
  const dates = getTradingDates();
  const totalDays = dates.length;

  if (holdings.length === 0) {
    return {
      navPoints: dates.map((date) => ({
        date,
        nav: 10.0,
        dailyReturn: 0,
        cumulativeReturn: 0,
        benchmarkPrice: 10.0,
      })),
      ipoNotices: [],
    };
  }

  // Pre-fetch synthetic prices
  const stockPrices = holdings.map((h) => ({
    symbol: h.symbol,
    weight: h.weight,
    prices: getStockPriceHistory(h.symbol).prices,
  }));

  const bmHistory = getStockPriceHistory('0050.TW').prices;

  const navPoints: DailyNavPoint[] = [];
  let currentNav = 10.0;
  let sharesHeld = new Map<string, number>();
  let lastQuarter = getCalendarQuarter(dates[0]);

  // Initial shares at Day 0
  const totalWeight = holdings.reduce((sum, h) => sum + h.weight, 0) || 100;
  for (const s of stockPrices) {
    const p0 = s.prices[0];
    const weightFrac = s.weight / totalWeight;
    sharesHeld.set(s.symbol, (10.0 * weightFrac) / p0);
  }

  navPoints.push({
    date: dates[0],
    nav: 10.0,
    dailyReturn: 0,
    cumulativeReturn: 0,
    benchmarkPrice: bmHistory[0] || 10.0,
  });

  for (let t = 1; t < totalDays; t++) {
    const date = dates[t];
    const quarter = getCalendarQuarter(date);
    const isNewQuarter = quarter !== lastQuarter;
    let didRebalance = false;

    let dayNav = 0;
    for (const s of stockPrices) {
      const shares = sharesHeld.get(s.symbol) || 0;
      dayNav += shares * s.prices[t];
    }

    if (mode === 'quarterly_rebalance' && isNewQuarter) {
      didRebalance = true;
      lastQuarter = quarter;
      const newShares = new Map<string, number>();
      for (const s of stockPrices) {
        const weightFrac = s.weight / totalWeight;
        newShares.set(s.symbol, (dayNav * weightFrac) / s.prices[t]);
      }
      sharesHeld = newShares;
    }

    currentNav = dayNav;
    const roundedNav = Math.round(currentNav * 1000) / 1000;
    const prevNav = navPoints[t - 1].nav;
    const dailyReturnPct = ((roundedNav - prevNav) / prevNav) * 100;
    const cumulativeReturnPct = ((roundedNav - 10.0) / 10.0) * 100;

    navPoints.push({
      date,
      nav: roundedNav,
      dailyReturn: Math.round(dailyReturnPct * 100) / 100,
      cumulativeReturn: Math.round(cumulativeReturnPct * 100) / 100,
      benchmarkPrice: bmHistory[t] || 10.0,
      rebalancedToday: didRebalance,
    });
  }

  return { navPoints, ipoNotices: [] };
}

/**
 * 依可視區間起始日將「自組 ETF」與「對比標的」強制作為 10 元起算進行歸一化
 */
export function normalizeDataToIntervalStart(
  allNavPoints: DailyNavPoint[],
  startIndex: number,
  endIndex: number
): DailyNavPoint[] {
  if (allNavPoints.length === 0) return [];
  const start = Math.max(0, Math.min(startIndex, allNavPoints.length - 1));
  const end = Math.max(start, Math.min(endIndex, allNavPoints.length - 1));
  const slice = allNavPoints.slice(start, end + 1);

  const startPoint = slice[0];
  const startNav = startPoint.nav > 0 ? startPoint.nav : 10.0;
  const startBm = (startPoint.benchmarkPrice && startPoint.benchmarkPrice > 0) ? startPoint.benchmarkPrice : 10.0;

  return slice.map((pt) => {
    const normNav = (pt.nav / startNav) * 10.0;
    const ptBm = pt.benchmarkPrice && pt.benchmarkPrice > 0 ? pt.benchmarkPrice : startBm;
    const normBm = (ptBm / startBm) * 10.0;

    return {
      ...pt,
      normalizedNav: Math.round(normNav * 1000) / 1000,
      normalizedBenchmark: Math.round(normBm * 1000) / 1000,
    };
  });
}

/**
 * 計算指定查詢區間內的績效與風險指標
 */
export function calculateRangeMetrics(
  allNavs: DailyNavPoint[],
  startIndex: number,
  endIndex: number
): PerformanceMetrics {
  if (allNavs.length === 0) {
    return {
      currentNav: 10.0,
      baseNav: 10.0,
      rangeReturn: 0,
      cagr: 0,
      maxDrawdown: 0,
      allTimeReturn: 0,
      rangeHigh: 10.0,
      rangeLow: 10.0,
    };
  }

  const validStart = Math.max(0, Math.min(startIndex, allNavs.length - 1));
  const validEnd = Math.max(validStart, Math.min(endIndex, allNavs.length - 1));
  const rangeSlice = allNavs.slice(validStart, validEnd + 1);

  const startNav = rangeSlice[0].nav;
  const currentNav = rangeSlice[rangeSlice.length - 1].nav;
  const allTimeCurrentNav = allNavs[allNavs.length - 1].nav;
  const allTimeReturn = ((allTimeCurrentNav - 10.0) / 10.0) * 100;

  // Range Return
  const rangeReturn = startNav > 0 ? ((currentNav - startNav) / startNav) * 100 : 0;

  // Benchmark return in this range
  const startBm = rangeSlice[0].benchmarkPrice || 10.0;
  const endBm = rangeSlice[rangeSlice.length - 1].benchmarkPrice || 10.0;
  const benchmarkRangeReturn = startBm > 0 ? ((endBm - startBm) / startBm) * 100 : 0;

  // Max Drawdown (MDD) in this interval
  let peak = -Infinity;
  let maxDrawdown = 0;
  let rangeHigh = -Infinity;
  let rangeLow = Infinity;

  for (const pt of rangeSlice) {
    if (pt.nav > rangeHigh) rangeHigh = pt.nav;
    if (pt.nav < rangeLow) rangeLow = pt.nav;

    if (pt.nav > peak) {
      peak = pt.nav;
    } else if (peak > 0) {
      const dd = ((peak - pt.nav) / peak) * 100;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
      }
    }
  }

  // CAGR calculation in the query range
  const startDate = new Date(rangeSlice[0].date);
  const endDate = new Date(rangeSlice[rangeSlice.length - 1].date);
  const diffTimeMs = Math.max(1, endDate.getTime() - startDate.getTime());
  const years = diffTimeMs / (1000 * 3600 * 24 * 365.25);

  let cagr = 0;
  if (years >= 0.08 && startNav > 0 && currentNav > 0) {
    // If at least 1 month
    cagr = (Math.pow(currentNav / startNav, 1 / years) - 1) * 100;
  } else {
    // Shorter intervals: simple annualization
    cagr = rangeReturn * (1 / (years || 1));
  }

  return {
    currentNav: Math.round(allTimeCurrentNav * 100) / 100,
    baseNav: 10.0,
    rangeReturn: Math.round(rangeReturn * 100) / 100,
    cagr: Math.round(cagr * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    allTimeReturn: Math.round(allTimeReturn * 100) / 100,
    rangeHigh: Math.round(rangeHigh * 100) / 100,
    rangeLow: Math.round(rangeLow * 100) / 100,
    benchmarkRangeReturn: Math.round(benchmarkRangeReturn * 100) / 100,
  };
}
