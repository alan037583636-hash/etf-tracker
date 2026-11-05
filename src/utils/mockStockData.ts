import { StockInfo, DailyPricePoint } from '../types/etf';

// Pre-defined list of popular stocks for ETF creation
export const POPULAR_STOCKS: StockInfo[] = [
  {
    symbol: '2330',
    name: '台積電',
    sector: '半導體製造',
    market: 'TW',
    basePrice: 590,
    currentPrice: 1040,
    fiveYearReturn: 76.27,
    color: '#3b82f6', // blue
  },
  {
    symbol: '2454',
    name: '聯發科',
    sector: 'IC 設計',
    market: 'TW',
    basePrice: 940,
    currentPrice: 1290,
    fiveYearReturn: 37.23,
    color: '#8b5cf6', // purple
  },
  {
    symbol: '2317',
    name: '鴻海',
    sector: '電子代工/電動車',
    market: 'TW',
    basePrice: 108,
    currentPrice: 215,
    fiveYearReturn: 99.07,
    color: '#06b6d4', // cyan
  },
  {
    symbol: '2382',
    name: '廣達',
    sector: 'AI 伺服器/電腦週邊',
    market: 'TW',
    basePrice: 78,
    currentPrice: 310,
    fiveYearReturn: 297.44,
    color: '#f59e0b', // amber
  },
  {
    symbol: '2308',
    name: '台達電',
    sector: '電源供應與綠能',
    market: 'TW',
    basePrice: 245,
    currentPrice: 395,
    fiveYearReturn: 61.22,
    color: '#10b981', // emerald
  },
  {
    symbol: '2881',
    name: '富邦金',
    sector: '金控金融',
    market: 'TW',
    basePrice: 72,
    currentPrice: 91,
    fiveYearReturn: 26.39,
    color: '#ec4899', // pink
  },
  {
    symbol: '3231',
    name: '緯創',
    sector: 'AI 伺服器代工',
    market: 'TW',
    basePrice: 29,
    currentPrice: 118,
    fiveYearReturn: 306.90,
    color: '#6366f1', // indigo
  },
  {
    symbol: '3017',
    name: '奇鋐',
    sector: '散熱模組',
    market: 'TW',
    basePrice: 85,
    currentPrice: 620,
    fiveYearReturn: 629.41,
    color: '#14b8a6', // teal
  },
  {
    symbol: 'NVDA',
    name: '輝達 (NVIDIA)',
    sector: 'AI 晶片與算力',
    market: 'US',
    basePrice: 29.8,
    currentPrice: 142.5,
    fiveYearReturn: 378.19,
    color: '#76b900', // nvidia green
  },
  {
    symbol: 'AAPL',
    name: '蘋果 (Apple)',
    sector: '消費電子與生態系',
    market: 'US',
    basePrice: 151.2,
    currentPrice: 228.4,
    fiveYearReturn: 51.06,
    color: '#64748b', // slate
  },
  {
    symbol: 'MSFT',
    name: '微軟 (Microsoft)',
    sector: '雲端與企業軟體',
    market: 'US',
    basePrice: 336.0,
    currentPrice: 432.5,
    fiveYearReturn: 28.72,
    color: '#0284c7', // light blue
  },
];

// Seeded pseudo-random number generator for deterministic smooth series
function createSeededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 12345;
}

// Generate business days between start date and end date
function generateTradingDays(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// Global cached trading days and market daily regimes
let cachedDates: string[] | null = null;
let cachedMarketReturns: number[] | null = null;
const stockPriceCache: Map<string, number[]> = new Map();

export function getTradingDates(): string[] {
  if (cachedDates) return cachedDates;
  const endDate = new Date('2026-11-05');
  const startDate = new Date('2021-11-05');
  cachedDates = generateTradingDays(startDate, endDate);
  return cachedDates;
}

// Generate realistic macro cycles across 5 years
function getMarketRegimeReturns(dates: string[]): number[] {
  if (cachedMarketReturns) return cachedMarketReturns;

  const totalDays = dates.length;
  const rng = createSeededRandom(8888);
  const returns: number[] = [0]; // day 0 has 0 return

  for (let i = 1; i < totalDays; i++) {
    const progress = i / totalDays;
    const dateStr = dates[i];
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(5, 7), 10);

    // Realistic market regimes:
    let dailyDrift = 0.00035; // baseline positive drift (~9% annualized)
    let dailyVol = 0.010;

    if (year === 2022) {
      // 2022 bear market (Fed rate hikes)
      dailyDrift = -0.0009;
      dailyVol = 0.014;
    } else if (year === 2023) {
      // 2023 AI recovery
      dailyDrift = 0.0008;
      dailyVol = 0.011;
    } else if (year === 2024) {
      // 2024 AI bull market
      dailyDrift = 0.0011;
      dailyVol = 0.012;
    } else if (year === 2025) {
      // 2025 consolidation & growth
      dailyDrift = 0.0005;
      dailyVol = 0.009;
    } else if (year === 2026) {
      dailyDrift = 0.0006;
      dailyVol = 0.010;
    }

    // Normal distribution approximation (Box-Muller)
    const u1 = Math.max(0.000001, rng());
    const u2 = rng();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    const r = dailyDrift + z * dailyVol;
    // Cap extreme daily market shocks between -5% and +5%
    returns.push(Math.max(-0.05, Math.min(0.05, r)));
  }

  cachedMarketReturns = returns;
  return returns;
}

// Generate or retrieve deterministic 5-year price history for a given stock symbol
export function getStockPriceHistory(symbol: string): { prices: number[]; returns: number[] } {
  const dates = getTradingDates();
  const totalDays = dates.length;
  const marketReturns = getMarketRegimeReturns(dates);

  const predefined = POPULAR_STOCKS.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
  const seed = stringToSeed(symbol.toUpperCase());
  const rng = createSeededRandom(seed);

  let basePrice = predefined?.basePrice || 100;
  let targetEndPrice = predefined?.currentPrice || (basePrice * (1.2 + rng() * 1.5));
  let beta = 1.0;
  let idiosyncraticVol = 0.015;

  // Specific profiles for known stocks
  if (symbol === '2330') {
    beta = 1.15;
    idiosyncraticVol = 0.012;
  } else if (symbol === '2454') {
    beta = 1.25;
    idiosyncraticVol = 0.018;
  } else if (symbol === '2317') {
    beta = 0.95;
    idiosyncraticVol = 0.013;
  } else if (symbol === '2382' || symbol === '3231' || symbol === '3017') {
    beta = 1.40;
    idiosyncraticVol = 0.022;
  } else if (symbol === '2881') {
    beta = 0.65;
    idiosyncraticVol = 0.009;
  } else if (symbol === 'NVDA') {
    beta = 1.70;
    idiosyncraticVol = 0.025;
  }

  // Pre-generate raw paths
  const prices: number[] = [basePrice];
  const returns: number[] = [0];

  let currentPrice = basePrice;
  for (let i = 1; i < totalDays; i++) {
    const mkt = marketReturns[i];
    const u1 = Math.max(0.000001, rng());
    const u2 = rng();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    // CAPM return formula: R = alpha + beta * Rm + epsilon
    let r = beta * mkt + z * idiosyncraticVol;

    // Additional momentum boost for AI leaders in 2023-2024
    const dateStr = dates[i];
    const year = parseInt(dateStr.slice(0, 4), 10);
    if ((symbol === '2382' || symbol === '3231' || symbol === '3017' || symbol === 'NVDA') && (year === 2023 || year === 2024)) {
      r += 0.0008;
    }

    // Limit single day moves to +/- 10% (standard Taiwan stock daily circuit breaker limit)
    r = Math.max(-0.10, Math.min(0.10, r));

    currentPrice = Math.max(1, currentPrice * (1 + r));
    prices.push(Math.round(currentPrice * 100) / 100);
    returns.push(r);
  }

  // Rescale gently to match target currentPrice closely on the last day for predefined stocks
  if (predefined) {
    const endRatio = targetEndPrice / prices[prices.length - 1];
    for (let i = 1; i < totalDays; i++) {
      const weight = i / (totalDays - 1);
      const adjustment = Math.pow(endRatio, weight);
      prices[i] = Math.round(prices[i] * adjustment * 100) / 100;
      returns[i] = (prices[i] - prices[i - 1]) / prices[i - 1];
    }
    prices[prices.length - 1] = targetEndPrice;
  }

  return { prices, returns };
}

// Generate benchmark TAIEX (加權指數) normalized to 10.00 base NAV
let cachedBenchmarkNav: number[] | null = null;
export function getBenchmarkNavHistory(): number[] {
  if (cachedBenchmarkNav) return cachedBenchmarkNav;
  const dates = getTradingDates();
  const mktReturns = getMarketRegimeReturns(dates);
  const navs: number[] = [10.00];

  let currentNav = 10.00;
  for (let i = 1; i < dates.length; i++) {
    currentNav = currentNav * (1 + mktReturns[i]);
    navs.push(Math.round(currentNav * 1000) / 1000);
  }
  cachedBenchmarkNav = navs;
  return navs;
}

// Pre-packaged preset portfolios for quick testing and exploration
export const PRESET_PORTFOLIOS = [
  {
    id: 'tech_giants',
    name: '台灣科技領航 (預設)',
    description: '以台積電與聯發科為核心的旗艦半導體與電子代工配置',
    holdings: [
      { id: '1', symbol: '2330', name: '台積電', weight: 35, sector: '半導體製造', color: '#3b82f6' },
      { id: '2', symbol: '2454', name: '聯發科', weight: 25, sector: 'IC 設計', color: '#8b5cf6' },
      { id: '3', symbol: '2317', name: '鴻海', weight: 20, sector: '電子代工/電動車', color: '#06b6d4' },
      { id: '4', symbol: '2382', name: '廣達', weight: 20, sector: 'AI 伺服器', color: '#f59e0b' },
    ],
  },
  {
    id: 'ai_supercycle',
    name: 'AI 算力狂潮鏈',
    description: '聚焦伺服器代工、散熱模組與全球算力龍頭的高成長配置',
    holdings: [
      { id: '1', symbol: 'NVDA', name: '輝達 (NVIDIA)', weight: 30, sector: 'AI 晶片', color: '#76b900' },
      { id: '2', symbol: '2330', name: '台積電', weight: 30, sector: '先進製程', color: '#3b82f6' },
      { id: '3', symbol: '2382', name: '廣達', weight: 20, sector: 'AI 伺服器', color: '#f59e0b' },
      { id: '4', symbol: '3017', name: '奇鋐', weight: 20, sector: '散熱模組', color: '#14b8a6' },
    ],
  },
  {
    id: 'balanced_fortress',
    name: '穩健成長護城河',
    description: '半導體龍頭搭配頂級金控與綠能電源，兼具防禦與成長',
    holdings: [
      { id: '1', symbol: '2330', name: '台積電', weight: 35, sector: '半導體製造', color: '#3b82f6' },
      { id: '2', symbol: '2881', name: '富邦金', weight: 25, sector: '金控金融', color: '#ec4899' },
      { id: '3', symbol: '2308', name: '台達電', weight: 25, sector: '電源與綠能', color: '#10b981' },
      { id: '4', symbol: '2317', name: '鴻海', weight: 15, sector: '電子代工', color: '#06b6d4' },
    ],
  },
  {
    id: 'global_tech_titans',
    name: '全球科技三巨頭',
    description: '結合全球頂級科技霸權微軟、蘋果與台積電',
    holdings: [
      { id: '1', symbol: '2330', name: '台積電', weight: 40, sector: '晶圓代工', color: '#3b82f6' },
      { id: '2', symbol: 'MSFT', name: '微軟', weight: 30, sector: '雲端/AI', color: '#0284c7' },
      { id: '3', symbol: 'AAPL', name: '蘋果', weight: 30, sector: '消費終端', color: '#64748b' },
    ],
  },
];
