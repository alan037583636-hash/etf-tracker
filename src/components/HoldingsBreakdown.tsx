import React, { useMemo } from 'react';
import { PortfolioHolding, RealDataApiResponse } from '../types/etf';
import { getStockPriceHistory } from '../utils/mockStockData';
import { PieChart, BookOpen, TrendingUp } from 'lucide-react';

interface HoldingsBreakdownProps {
  holdings: PortfolioHolding[];
  realData?: RealDataApiResponse | null;
}

// 【個股微型趨勢圖 (Sparkline)】組件：無座標軸、無背景格線、純 SVG 折線圖
interface SparklineProps {
  prices: number[];
  isPositive: boolean;
  color?: string;
  width?: number;
  height?: number;
}

const StockSparkline: React.FC<SparklineProps> = ({
  prices,
  isPositive,
  width = 75,
  height = 26,
}) => {
  const { linePath, areaPath } = useMemo(() => {
    if (!prices || prices.length < 2) return { linePath: '', areaPath: '' };

    // 近3個月約 63 個點，直接或每 2 點取樣繪製平滑曲線
    const step = Math.max(1, Math.floor(prices.length / 45));
    const sampled: number[] = [];
    for (let i = 0; i < prices.length; i += step) {
      sampled.push(prices[i]);
    }
    if (sampled[sampled.length - 1] !== prices[prices.length - 1]) {
      sampled.push(prices[prices.length - 1]);
    }

    let min = Infinity;
    let max = -Infinity;
    for (const p of sampled) {
      if (p < min) min = p;
      if (p > max) max = p;
    }
    const range = max - min || 1;

    const points = sampled.map((p, idx) => {
      const x = (idx / (sampled.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const lPath = `M ${points.join(' L ')}`;
    const aPath = `M ${points.join(' L ')} L ${width},${height} L 0,${height} Z`;

    return { linePath: lPath, areaPath: aPath };
  }, [prices, width, height]);

  if (!linePath) return null;

  const strokeColor = isPositive ? '#dc2626' : '#10b981';
  const gradientId = `spark_grad_${Math.random().toString(36).substring(2, 7)}`;

  return (
    <div className="relative shrink-0 overflow-hidden rounded py-0.5" title="近 3 個月還原權息收盤價走勢">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {/* 漸層微型填色 */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* 乾淨折線 */}
        <path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export const HoldingsBreakdown: React.FC<HoldingsBreakdownProps> = ({ holdings, realData }) => {
  const totalWeight = holdings.reduce((sum, h) => sum + (Number(h.weight) || 0), 0);

  // 產業權重分佈
  const sectorMap: Record<string, number> = {};
  holdings.forEach((h) => {
    const sector = h.sector || '核心成分股';
    sectorMap[sector] = (sectorMap[sector] || 0) + (Number(h.weight) || 0);
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 1. 產業配置分佈 */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">產業權重分佈</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {Object.keys(sectorMap).length} 個領域
          </span>
        </div>

        <div className="flex flex-col gap-2.5 pt-1">
          {Object.entries(sectorMap).map(([sector, weight]) => {
            const pctOfTotal = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
            return (
              <div key={sector} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{sector}</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {Math.round(weight)}%
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      ({pctOfTotal.toFixed(0)}%)
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-800 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, pctOfTotal)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. 【成分股近 3 個月表現 + 近3個月微型趨勢圖 (Sparklines)】 */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">成分股近 3 個月表現</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">近3個月 (3M) 還原權息</span>
        </div>

        <div className="flex flex-col gap-2.5 pt-1 divide-y divide-slate-100">
          {holdings.map((h) => {
            // 取得全歷史收盤價序列
            let priceSeries: number[] = [];
            const realStock = realData?.stocks[h.symbol] || realData?.stocks[`${h.symbol}.TW`];

            if (realStock && realStock.quotes && realStock.quotes.length > 0) {
              priceSeries = realStock.quotes.map((q) => q.adjClose ?? q.close);
            } else {
              priceSeries = getStockPriceHistory(h.symbol).prices;
            }

            // 【依要求取近 3 個月 (約 63 個交易日) 表現與圖形】
            const threeMonthSeries = priceSeries.length > 63 ? priceSeries.slice(-63) : priceSeries;
            const start3MPrice = threeMonthSeries[0] || 100;
            const lastPrice = threeMonthSeries[threeMonthSeries.length - 1] || 100;
            const return3M = start3MPrice > 0 ? ((lastPrice - start3MPrice) / start3MPrice) * 100 : 0;
            const isPos = return3M >= 0;

            return (
              <div key={h.id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-2 text-xs">
                {/* 股票名稱與代號 */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: h.color || '#3b82f6' }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-slate-800 truncate">{h.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{h.symbol} · {h.weight}%</span>
                  </div>
                </div>

                {/* 近3個月微型走勢圖 (Sparkline) - 手機與桌機皆適應顯示 */}
                <div className="flex items-center">
                  <StockSparkline prices={threeMonthSeries} isPositive={isPos} width={75} height={24} />
                </div>

                {/* 近3個月漲跌幅與最新價 */}
                <div className="flex flex-col items-end shrink-0">
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      isPos ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {isPos ? '+' : ''}
                    {return3M.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    最新: {lastPrice.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 核心運算與再平衡邏輯說明 */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <BookOpen className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">運算與再平衡邏輯</h3>
          </div>

          <div className="flex flex-col gap-2 pt-2 text-xs text-slate-600 leading-relaxed">
            <p>
              <strong className="text-slate-800">1. 還原權息 (Adj Close):</strong> 全面抓取包含歷年現金股利與除權息之真實總報酬價格。
            </p>
            <p>
              <strong className="text-slate-800">2. 雙回測模式:</strong>
              <span className="block mt-0.5 text-slate-500">
                • <strong>買進持有:</strong> t=0 買入後隨漲跌自然權重偏移。
              </span>
              <span className="block text-slate-500">
                • <strong>每季再平衡:</strong> 每季末強制按初始設定比例重設股數。
              </span>
            </p>
            <p>
              <strong className="text-slate-800">3. 區間 10 元起算歸一化:</strong> 無論何種查詢區間，自組 ETF 與對比標的均自該區間首日以 10.00 元起跑，精確呈現相對報酬走勢。
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
          近3個月即時動態 · LocalStorage 自動儲存 · 支援 URL 狀態分享
        </div>
      </div>
    </div>
  );
};
