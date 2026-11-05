import React from 'react';
import { TrendingUp, RotateCcw, Download, Sparkles, Share2, Check } from 'lucide-react';
import { PRESET_PORTFOLIOS } from '../utils/mockStockData';
import { PortfolioHolding } from '../types/etf';

interface HeaderProps {
  onSelectPreset: (holdings: PortfolioHolding[]) => void;
  onReset: () => void;
  onExportCsv: () => void;
  onShare: () => void;
  copiedToast: boolean;
  currentPresetId?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectPreset,
  onReset,
  onExportCsv,
  onShare,
  copiedToast,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-sm">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 whitespace-nowrap">
                ETF TRACKER
              </span>
              <span className="text-xs font-medium text-slate-500 hidden sm:inline whitespace-nowrap">
                個人專屬 ETF 追蹤儀表板
              </span>
            </div>
          </div>
        </div>

        {/* Zone 2: Preset Selector */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            快速載入範本:
          </span>
          <div className="flex items-center gap-1.5">
            {PRESET_PORTFOLIOS.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectPreset(p.holdings)}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded transition-colors whitespace-nowrap"
                title={p.description}
              >
                {p.name.replace(' (預設)', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Zone 3: Actions (Share, Reset, Export CSV) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Share Button */}
          <button
            onClick={onShare}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 whitespace-nowrap ${
              copiedToast
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-300'
            }`}
            title="複製此投資組合分享網址"
          >
            {copiedToast ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-semibold text-emerald-700">已複製連結！</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-slate-500" />
                <span>分享 (Share)</span>
              </>
            )}
          </button>

          <button
            onClick={onReset}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
            title="重設為預設持股"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">重設持股</span>
          </button>

          <button
            onClick={onExportCsv}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">匯出淨值 CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>
        </div>
      </div>
    </header>
  );
};
