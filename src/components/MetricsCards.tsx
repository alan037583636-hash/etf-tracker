import React from 'react';
import { PerformanceMetrics, RangePreset, RebalanceMode } from '../types/etf';
import { ArrowUpRight, ArrowDownRight, TrendingUp, ShieldAlert, Award, Info } from 'lucide-react';

interface MetricsCardsProps {
  metrics: PerformanceMetrics;
  selectedPreset: RangePreset;
  rangeLabel: string;
  rebalanceMode: RebalanceMode;
  benchmarkSymbol: string;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  metrics,
  selectedPreset,
  rangeLabel,
  rebalanceMode,
  benchmarkSymbol,
}) => {
  const isRangePositive = metrics.rangeReturn >= 0;
  const isCagrPositive = metrics.cagr >= 0;
  const is5YearPositive = metrics.allTimeReturn >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      {/* 1. 最新淨值 (Current NAV) */}
      <div className="p-3.5 sm:p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 truncate">最新淨值 (NAV)</span>
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono">基期 10.00 元</span>
        </div>

        <div className="my-1.5 sm:my-2 flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 font-mono tracking-tight tabular-nums">
            {metrics.currentNav.toFixed(2)}
          </span>
          <span className="text-[11px] sm:text-xs font-medium text-slate-500">元</span>
        </div>

        <div className="flex items-center justify-between text-[11px] sm:text-xs pt-1 border-t border-slate-100">
          <span className="text-slate-400 truncate">5年總報酬:</span>
          <span
            className={`font-mono font-bold tabular-nums flex items-center shrink-0 ${
              is5YearPositive ? 'text-red-600' : 'text-emerald-600'
            }`}
          >
            {is5YearPositive ? (
              <ArrowUpRight className="w-3.5 h-3.5 inline" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 inline" />
            )}
            {is5YearPositive ? '+' : ''}
            {metrics.allTimeReturn.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 2. 累積報酬率 (Total Return, %) */}
      <div className="p-3.5 sm:p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 truncate" title={`${rangeLabel} 累積報酬率`}>
            {rangeLabel} 累積報酬
          </span>
          <Award className="w-4 h-4 text-amber-500 shrink-0" />
        </div>

        <div className="my-1.5 sm:my-2">
          <div
            className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold font-mono tracking-tight tabular-nums flex items-baseline gap-1 ${
              isRangePositive ? 'text-red-600' : 'text-emerald-600'
            }`}
          >
            {isRangePositive ? (
              <ArrowUpRight className="w-5 h-5 sm:w-6 sm:h-6 inline stroke-[2.5]" />
            ) : (
              <ArrowDownRight className="w-5 h-5 sm:w-6 sm:h-6 inline stroke-[2.5]" />
            )}
            <span>
              {isRangePositive ? '+' : ''}
              {metrics.rangeReturn.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] sm:text-xs pt-1 border-t border-slate-100">
          <span className="text-slate-400 truncate">對比 {benchmarkSymbol}:</span>
          <span className="font-mono font-semibold text-slate-700 tabular-nums shrink-0">
            {metrics.benchmarkRangeReturn !== undefined && metrics.benchmarkRangeReturn >= 0 ? '+' : ''}
            {metrics.benchmarkRangeReturn !== undefined ? metrics.benchmarkRangeReturn.toFixed(2) : '0.00'}%
          </span>
        </div>
      </div>

      {/* 3. 年化報酬率 (CAGR, %) 帶有專業 Tooltip */}
      <div className="p-3.5 sm:p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 truncate" title={`${rangeLabel} 年化報酬率 (CAGR)`}>
              {rangeLabel} CAGR
            </span>
            {/* 專業財經 Tooltip: CAGR */}
            <div className="relative group inline-flex items-center">
              <button
                type="button"
                aria-label="查看 CAGR 說明"
                className="text-slate-400 hover:text-slate-600 cursor-help transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 w-48 sm:w-56 p-2 bg-slate-900 text-white text-[11px] leading-relaxed rounded-md shadow-lg pointer-events-none">
                <div className="font-semibold text-amber-300 mb-0.5">年化報酬率 (CAGR)</div>
                衡量每年平均的複利增長率
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
              </div>
            </div>
          </div>
          <TrendingUp className="w-4 h-4 text-blue-500 shrink-0" />
        </div>

        <div className="my-1.5 sm:my-2">
          <div
            className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold font-mono tracking-tight tabular-nums flex items-baseline gap-1 ${
              isCagrPositive ? 'text-red-600' : 'text-emerald-600'
            }`}
          >
            <span>
              {isCagrPositive ? '+' : ''}
              {metrics.cagr.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] sm:text-xs pt-1 border-t border-slate-100">
          <span className="text-slate-400 truncate">模式:</span>
          <span className="font-semibold text-slate-700 shrink-0">
            {rebalanceMode === 'quarterly_rebalance' ? '每季再平衡' : '買進持有'}
          </span>
        </div>
      </div>

      {/* 4. 最大回撤 (Max Drawdown, MDD, %) 帶有專業 Tooltip */}
      <div className="p-3.5 sm:p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 truncate" title={`${rangeLabel} 最大回撤 (MDD)`}>
              {rangeLabel} MDD
            </span>
            {/* 專業財經 Tooltip: MDD */}
            <div className="relative group inline-flex items-center">
              <button
                type="button"
                aria-label="查看 MDD 說明"
                className="text-slate-400 hover:text-slate-600 cursor-help transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-full right-0 sm:left-1/2 sm:-translate-x-1/2 mb-1.5 hidden group-hover:block z-30 w-52 sm:w-60 p-2 bg-slate-900 text-white text-[11px] leading-relaxed rounded-md shadow-lg pointer-events-none">
                <div className="font-semibold text-red-300 mb-0.5">最大回撤 (Max Drawdown)</div>
                這段期間內淨值從最高點跌至最低點的最大跌幅，衡量下檔風險
                <div className="absolute top-full right-2 sm:left-1/2 sm:-translate-x-1/2 border-4 border-transparent border-t-slate-900" />
              </div>
            </div>
          </div>
          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
        </div>

        <div className="my-1.5 sm:my-2">
          <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-mono tracking-tight tabular-nums text-red-600">
            -{metrics.maxDrawdown.toFixed(2)}%
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] sm:text-xs pt-1 border-t border-slate-100">
          <span className="text-slate-400 truncate">區間最低價:</span>
          <span className="font-mono font-semibold text-slate-700 tabular-nums shrink-0">
            {metrics.rangeLow.toFixed(2)} 元
          </span>
        </div>
      </div>
    </div>
  );
};
