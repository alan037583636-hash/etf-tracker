import React, { useState } from 'react';
import { PortfolioHolding } from '../types/etf';
import { Plus, Trash2, CheckCircle2, AlertCircle, Save, RotateCcw, Sparkles } from 'lucide-react';

interface PortfolioManagerProps {
  holdings: PortfolioHolding[];
  onUpdateHoldings: (holdings: PortfolioHolding[]) => void;
  onResetDefault: () => void;
}

// 預設指定持股：2454.TW (40%), 2308.TW (25%), 3711.TW (25%), 2356.TW (10%)
export const DEFAULT_HOLDINGS: PortfolioHolding[] = [
  { id: '1', symbol: '2454.TW', name: '聯發科', weight: 40, sector: 'IC 設計', color: '#8b5cf6' },
  { id: '2', symbol: '2308.TW', name: '台達電', weight: 25, sector: '電源供應與綠能', color: '#10b981' },
  { id: '3', symbol: '3711.TW', name: '日月光投控', weight: 25, sector: '半導體封測', color: '#06b6d4' },
  { id: '4', symbol: '2356.TW', name: '英業達', weight: 10, sector: 'AI 伺服器/代工', color: '#f59e0b' },
];

const PRESET_STOCK_OPTIONS = [
  { symbol: '2454.TW', name: '聯發科' },
  { symbol: '2308.TW', name: '台達電' },
  { symbol: '3711.TW', name: '日月光投控' },
  { symbol: '2356.TW', name: '英業達' },
  { symbol: '2330.TW', name: '台積電' },
  { symbol: '2317.TW', name: '鴻海' },
  { symbol: '2382.TW', name: '廣達' },
  { symbol: '0050.TW', name: '元大台灣50' },
  { symbol: 'NVDA', name: '輝達 (NVIDIA)' },
  { symbol: 'AAPL', name: '蘋果 (Apple)' },
  { symbol: 'MSFT', name: '微軟 (Microsoft)' },
];

export const PortfolioManager: React.FC<PortfolioManagerProps> = ({
  holdings,
  onUpdateHoldings,
  onResetDefault,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [newWeight, setNewWeight] = useState<number>(10);
  const [saveToast, setSaveToast] = useState(false);

  // 計算總權重（純整數）
  const totalWeight = holdings.reduce((sum, h) => sum + Math.round(Number(h.weight) || 0), 0);
  const isExact100 = totalWeight === 100;
  const isOver100 = totalWeight > 100;
  const isUnder100 = totalWeight < 100;

  // 權重變動處理 (限整數，step=1)
  const handleWeightChange = (id: string, value: number) => {
    const intVal = Math.max(0, Math.min(100, Math.round(value)));
    const updated = holdings.map((h) => (h.id === id ? { ...h, weight: intVal } : h));
    onUpdateHoldings(updated);
  };

  const handleNudge = (id: string, delta: number) => {
    const item = holdings.find((h) => h.id === id);
    if (!item) return;
    handleWeightChange(id, item.weight + delta);
  };

  const handleDelete = (id: string) => {
    const updated = holdings.filter((h) => h.id !== id);
    onUpdateHoldings(updated);
  };

  // 一鍵平均分配 (整數分配)
  const handleEqualWeight = () => {
    if (holdings.length === 0) return;
    const base = Math.floor(100 / holdings.length);
    const remainder = 100 - base * holdings.length;
    const updated = holdings.map((h, idx) => ({
      ...h,
      weight: idx === 0 ? base + remainder : base,
    }));
    onUpdateHoldings(updated);
  };

  // 依比例整數標準化至 100%
  const handleNormalize = () => {
    if (totalWeight <= 0 || holdings.length === 0) return;
    let sumNormalized = 0;
    const updated = holdings.map((h, idx) => {
      if (idx === holdings.length - 1) {
        return { ...h, weight: Math.max(0, 100 - sumNormalized) };
      }
      const val = Math.round((h.weight / totalWeight) * 100);
      sumNormalized += val;
      return { ...h, weight: val };
    });
    onUpdateHoldings(updated);
  };

  // 新增持股表單提交
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;

    let symbolClean = newSymbol.trim().toUpperCase();
    if (/^\d{4,6}$/.test(symbolClean)) {
      symbolClean = `${symbolClean}.TW`;
    }

    const matchedOption = PRESET_STOCK_OPTIONS.find((s) => s.symbol === symbolClean);
    const stockName = newName.trim() || matchedOption?.name || symbolClean;
    const cleanWeight = Math.max(1, Math.min(100, Math.round(newWeight)));

    const existingIdx = holdings.findIndex((h) => h.symbol.toUpperCase() === symbolClean);
    if (existingIdx >= 0) {
      const updated = [...holdings];
      updated[existingIdx].weight = Math.min(100, updated[existingIdx].weight + cleanWeight);
      onUpdateHoldings(updated);
    } else {
      const fallbackColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#6366f1'];
      const newHolding: PortfolioHolding = {
        id: `h_${Date.now()}`,
        symbol: symbolClean,
        name: stockName,
        weight: cleanWeight,
        color: fallbackColors[holdings.length % fallbackColors.length],
      };
      onUpdateHoldings([...holdings, newHolding]);
    }

    setNewSymbol('');
    setNewName('');
    setNewWeight(10);
    setShowAddForm(false);
  };

  // 手動儲存回饋提示
  const handleManualSave = () => {
    if (!isExact100) return;
    try {
      localStorage.setItem('custom_etf_holdings_v2', JSON.stringify(holdings));
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2500);
    } catch (err) {
      console.error('LocalStorage 儲存失敗:', err);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col gap-4">
      {/* 區塊標題與快速功能 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              投資組合與權重管理 (Portfolio Builder)
            </h2>
            <span className="text-xs font-medium text-slate-500">
              {holdings.length} 檔持股 · LocalStorage 持久化儲存
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            設定成分股與整數權重（最小單位 1%）。總權重須剛好等於 100% 才能進行標準回測。
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleEqualWeight}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
            title="平分權重為整數"
          >
            平均分配
          </button>

          <button
            type="button"
            onClick={handleNormalize}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
            title="比例放大/縮小至 100%"
          >
            整數標準化至 100%
          </button>

          <button
            type="button"
            onClick={onResetDefault}
            className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap"
            title="還原為預設持股 (聯發科40%、台達電25%、日月光25%、英業達10%)"
          >
            <RotateCcw className="w-3 h-3" />
            <span>預設持股</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-xs transition-colors flex items-center gap-1 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新增持股</span>
          </button>
        </div>
      </div>

      {/* 總權重指示器 (Progress Bar) 與警示文字 */}
      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/80 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">總權重指示器:</span>
            <span
              className={`font-mono font-bold text-sm tabular-nums ${
                isExact100
                  ? 'text-emerald-700'
                  : 'text-red-600 font-extrabold'
              }`}
            >
              {totalWeight}%
            </span>
          </div>

          <div>
            {isExact100 ? (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                總權重已符合 100% (已自動儲存至 LocalStorage)
              </span>
            ) : (
              <span className="text-xs font-bold text-red-600 flex items-center gap-1 animate-pulse">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                警告：總和目前為 {totalWeight}%，必須剛好等於 100%！
                {isUnder100 && ` (尚缺 ${100 - totalWeight}%)`}
                {isOver100 && ` (超出 ${totalWeight - 100}%)`}
              </span>
            )}
          </div>
        </div>

        {/* 權重進度條 */}
        <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
          {holdings.map((h) => {
            const widthPct = Math.max(0, h.weight);
            return (
              <div
                key={h.id}
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: h.color || '#3b82f6',
                }}
                className="h-full transition-all duration-200 relative group cursor-pointer"
                title={`${h.name} (${h.symbol}): ${h.weight}%`}
              />
            );
          })}
        </div>

        {/* 標籤圖例 */}
        <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap text-xs text-slate-600 pt-1">
          {holdings.map((h) => (
            <div key={h.id} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: h.color || '#3b82f6' }}
              />
              <span className="font-semibold text-slate-900 font-mono">{h.symbol}</span>
              <span className="text-slate-500">{h.name}</span>
              <span className="font-mono font-bold text-slate-800 tabular-nums">
                {h.weight}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 新增持股表單 */}
      {showAddForm && (
        <form
          onSubmit={handleAddSubmit}
          className="p-3.5 bg-slate-50/90 rounded-lg border border-slate-200 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">
              新增自訂持股至 ETF
            </span>
            <span className="text-[11px] text-slate-500">
              支援台股 (自動補 .TW) 與美股代號 (如 NVDA, AAPL)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                股票代號 (Symbol)
              </label>
              <input
                type="text"
                placeholder="例如 2330.TW, 2454, NVDA"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                股票名稱 (選填)
              </label>
              <input
                type="text"
                placeholder="例如 台積電"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                配置權重 (整數 %, step=1)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={newWeight}
                  onChange={(e) => setNewWeight(Math.round(Number(e.target.value)))}
                  className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                  required
                />
                <span className="text-xs text-slate-500 font-mono">%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-xs transition-colors"
            >
              加入投資組合
            </button>
          </div>
        </form>
      )}

      {/* 持股清單表格 */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="py-2.5 px-3 font-semibold">股票代號 (Symbol)</th>
              <th className="py-2.5 px-3 font-semibold">名稱 / 產業</th>
              <th className="py-2.5 px-3 font-semibold text-right">權重 (整數 %, step=1)</th>
              <th className="py-2.5 px-3 font-semibold text-center w-36">微調滑桿</th>
              <th className="py-2.5 px-3 font-semibold text-center w-16">刪除</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {holdings.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  尚未新增任何持股，請點擊上方「預設持股」或「新增持股」。
                </td>
              </tr>
            ) : (
              holdings.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: h.color || '#3b82f6' }}
                      />
                      <span className="font-mono font-bold text-slate-900">{h.symbol}</span>
                    </div>
                  </td>

                  <td className="py-2.5 px-3 text-slate-700">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">{h.name}</span>
                      <span className="text-[11px] text-slate-400">{h.sector || '核心成分股'}</span>
                    </div>
                  </td>

                  <td className="py-2.5 px-3 text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      <button
                        type="button"
                        onClick={() => handleNudge(h.id, -1)}
                        className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                        title="-1%"
                      >
                        -
                      </button>

                      <div className="relative inline-block w-14">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={h.weight}
                          onChange={(e) => handleWeightChange(h.id, parseInt(e.target.value, 10) || 0)}
                          className="w-full text-right font-mono font-bold text-slate-900 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-red-500 tabular-nums"
                        />
                      </div>
                      <span className="text-slate-500 font-mono">%</span>

                      <button
                        type="button"
                        onClick={() => handleNudge(h.id, 1)}
                        className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                        title="+1%"
                      >
                        +
                      </button>
                    </div>
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={h.weight}
                      onChange={(e) => handleWeightChange(h.id, parseInt(e.target.value, 10) || 0)}
                      className="w-28 sm:w-32 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleDelete(h.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                      title="刪除此持股"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 底部操作與提交按鈕：若總和 != 100%，提交按鈕需反灰禁用，並顯示紅色警告文字 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="text-xs">
          {!isExact100 ? (
            <p className="font-bold text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>總權重必須為 100%（目前 {totalWeight}%）。請點擊「整數標準化至 100%」或微調各股以解除限制。</span>
            </p>
          ) : (
            <p className="text-emerald-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>投資組合已就緒，各股權重與最新行情將自動保存至瀏覽器 LocalStorage。</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {saveToast && (
            <span className="text-xs font-semibold text-emerald-600 transition-opacity">
              已成功儲存！
            </span>
          )}

          <button
            type="button"
            onClick={handleManualSave}
            disabled={!isExact100}
            className={`px-4 py-2 text-xs font-medium rounded-lg shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap ${
              isExact100
                ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
            }`}
            title={!isExact100 ? '總權重不等於 100% 時禁用' : '儲存目前持股與權重設定'}
          >
            <Save className="w-3.5 h-3.5" />
            <span>套用設定 (LocalStorage)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
