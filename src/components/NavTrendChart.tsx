import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { DailyNavPoint, RangePreset, RebalanceMode, YAxisMode } from '../types/etf';
import {
  Calendar,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  GitCompare,
  RotateCw,
  Percent,
  DollarSign,
} from 'lucide-react';

interface NavTrendChartProps {
  allData: DailyNavPoint[];
  startIndex: number;
  endIndex: number;
  onRangeChange: (startIdx: number, endIdx: number, preset: RangePreset) => void;
  selectedPreset: RangePreset;
  rebalanceMode: RebalanceMode;
  onToggleRebalanceMode: (mode: RebalanceMode) => void;
  benchmarkSymbol: string;
  onChangeBenchmark: (symbol: string) => void;
}

export const NavTrendChart: React.FC<NavTrendChartProps> = ({
  allData,
  startIndex,
  endIndex,
  onRangeChange,
  selectedPreset,
  rebalanceMode,
  onToggleRebalanceMode,
  benchmarkSymbol,
  onChangeBenchmark,
}) => {
  const [bmInput, setBmInput] = useState(benchmarkSymbol);
  // 1. Y 軸動態切換：顯示淨值 ('nav') vs 顯示報酬率 ('return')
  const [yAxisMode, setYAxisMode] = useState<YAxisMode>('nav');

  const totalPoints = allData.length;
  const startDateStr = allData[startIndex]?.date || '';
  const endDateStr = allData[endIndex]?.date || '';
  const minAvailableDate = allData[0]?.date || '';
  const maxAvailableDate = allData[allData.length - 1]?.date || '';

  // 區間正規化計算 (支援淨值以 10 元起算，或報酬率以 0% 起算)
  const visibleData = useMemo(() => {
    if (!allData || allData.length === 0) return [];
    const start = Math.max(0, Math.min(startIndex, allData.length - 1));
    const end = Math.max(start, Math.min(endIndex, allData.length - 1));
    const slice = allData.slice(start, end + 1);
    if (slice.length === 0) return [];

    const startNav = slice[0].nav > 0 ? slice[0].nav : 10.0;
    const startBm = (slice[0].benchmarkPrice && slice[0].benchmarkPrice > 0) ? slice[0].benchmarkPrice : 10.0;

    return slice.map((d) => {
      // 模式 A：以 10.00 元起算的正規化淨值
      const normNav = (d.nav / startNav) * 10.0;
      const curBm = (d.benchmarkPrice && d.benchmarkPrice > 0) ? d.benchmarkPrice : startBm;
      const normBm = (curBm / startBm) * 10.0;

      // 模式 B：以 0.00% 起算的區間相對報酬率
      const retEtf = ((d.nav - startNav) / startNav) * 100;
      const retBm = ((curBm - startBm) / startBm) * 100;

      return {
        ...d,
        normalizedNav: Math.round(normNav * 1000) / 1000,
        normalizedBenchmark: Math.round(normBm * 1000) / 1000,
        normalizedReturnEtf: Math.round(retEtf * 100) / 100,
        normalizedReturnBenchmark: Math.round(retBm * 100) / 100,
      };
    });
  }, [allData, startIndex, endIndex]);

  // 區間內最終正規化數值
  const lastItem = visibleData[visibleData.length - 1];
  const rangeReturnEtf = lastItem?.normalizedReturnEtf ?? 0;
  const rangeReturnBm = lastItem?.normalizedReturnBenchmark ?? 0;

  // Y 軸範圍計算 (根據當前 yAxisMode 進行動態 Min/Max Padding)
  const yDomain = useMemo(() => {
    if (visibleData.length === 0) {
      return yAxisMode === 'return' ? [-10, 10] : [8, 12];
    }
    let min = Infinity;
    let max = -Infinity;

    for (const d of visibleData) {
      if (yAxisMode === 'return') {
        const valEtf = d.normalizedReturnEtf ?? 0;
        const valBm = d.normalizedReturnBenchmark ?? 0;
        min = Math.min(min, valEtf, valBm);
        max = Math.max(max, valEtf, valBm);
      } else {
        const valEtf = d.normalizedNav ?? 10.0;
        const valBm = d.normalizedBenchmark ?? 10.0;
        min = Math.min(min, valEtf, valBm);
        max = Math.max(max, valEtf, valBm);
      }
    }

    if (yAxisMode === 'return') {
      min = Math.min(min, 0.0);
      max = Math.max(max, 0.0);
      const padding = Math.max(2.0, (max - min) * 0.1);
      return [Math.floor(min - padding), Math.ceil(max + padding)];
    } else {
      min = Math.min(min, 10.0);
      max = Math.max(max, 10.0);
      const padding = Math.max(0.5, (max - min) * 0.08);
      return [Math.max(0, Math.floor((min - padding) * 10) / 10), Math.ceil((max + padding) * 10) / 10];
    }
  }, [visibleData, yAxisMode]);

  // 區間預設快速切換
  const handlePresetSelect = (preset: RangePreset) => {
    if (totalPoints === 0) return;
    const end = totalPoints - 1;
    let start = 0;

    switch (preset) {
      case '1M':
        start = Math.max(0, end - 21);
        break;
      case '6M':
        start = Math.max(0, end - 126);
        break;
      case '1Y':
        start = Math.max(0, end - 252);
        break;
      case '3Y':
        start = Math.max(0, end - 756);
        break;
      case '5Y':
        start = 0;
        break;
      case 'CUSTOM':
        return;
    }
    onRangeChange(start, end, preset);
  };

  // 自訂開始/結束日期選擇
  const handleCustomStartDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputDate = e.target.value;
    let newStartIdx = allData.findIndex((d) => d.date >= inputDate);
    if (newStartIdx === -1) newStartIdx = 0;
    if (newStartIdx > endIndex) newStartIdx = Math.max(0, endIndex - 5);
    onRangeChange(newStartIdx, endIndex, 'CUSTOM');
  };

  const handleCustomEndDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputDate = e.target.value;
    let newEndIdx = -1;
    for (let i = allData.length - 1; i >= 0; i--) {
      if (allData[i].date <= inputDate) {
        newEndIdx = i;
        break;
      }
    }
    if (newEndIdx === -1) newEndIdx = totalPoints - 1;
    if (newEndIdx < startIndex) newEndIdx = Math.min(totalPoints - 1, startIndex + 5);
    onRangeChange(startIndex, newEndIdx, 'CUSTOM');
  };

  // 對比標的輸入提交
  const handleBenchmarkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bmInput.trim()) return;
    let clean = bmInput.trim().toUpperCase();
    if (/^\d{4,6}$/.test(clean)) {
      clean = `${clean}.TW`;
    }
    onChangeBenchmark(clean);
  };

  // 迷你時間軸滑桿拖曳實作
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'left' | 'right' | 'window' | null>(null);
  const dragStartRef = useRef<{ clientX: number; startIdx: number; endIdx: number }>({
    clientX: 0,
    startIdx: 0,
    endIdx: 0,
  });

  const handleMouseDown = (type: 'left' | 'right' | 'window', e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(type);
    dragStartRef.current = {
      clientX: e.clientX,
      startIdx: startIndex,
      endIdx: endIndex,
    };
  };

  const handleTouchStart = (type: 'left' | 'right' | 'window', e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    setIsDragging(type);
    dragStartRef.current = {
      clientX: e.touches[0].clientX,
      startIdx: startIndex,
      endIdx: endIndex,
    };
  };

  const handleDragDelta = useCallback(
    (clientX: number) => {
      if (!isDragging || !sliderTrackRef.current) return;
      const rect = sliderTrackRef.current.getBoundingClientRect();
      const trackWidth = rect.width;
      if (trackWidth <= 0) return;

      const deltaX = clientX - dragStartRef.current.clientX;
      const pointsPerPixel = totalPoints / trackWidth;
      const deltaPoints = Math.round(deltaX * pointsPerPixel);

      if (isDragging === 'left') {
        const newStart = Math.max(
          0,
          Math.min(dragStartRef.current.startIdx + deltaPoints, dragStartRef.current.endIdx - 5)
        );
        onRangeChange(newStart, dragStartRef.current.endIdx, 'CUSTOM');
      } else if (isDragging === 'right') {
        const newEnd = Math.min(
          totalPoints - 1,
          Math.max(dragStartRef.current.endIdx + deltaPoints, dragStartRef.current.startIdx + 5)
        );
        onRangeChange(dragStartRef.current.startIdx, newEnd, 'CUSTOM');
      } else if (isDragging === 'window') {
        const windowSize = dragStartRef.current.endIdx - dragStartRef.current.startIdx;
        let newStart = dragStartRef.current.startIdx + deltaPoints;
        let newEnd = dragStartRef.current.endIdx + deltaPoints;

        if (newStart < 0) {
          newStart = 0;
          newEnd = windowSize;
        } else if (newEnd >= totalPoints) {
          newEnd = totalPoints - 1;
          newStart = Math.max(0, newEnd - windowSize);
        }
        onRangeChange(newStart, newEnd, 'CUSTOM');
      }
    },
    [isDragging, totalPoints, onRangeChange]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      handleDragDelta(e.clientX);
    },
    [handleDragDelta]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length > 0) {
          handleDragDelta(e.touches[0].clientX);
        }
      };
      const onTouchEnd = () => setIsDragging(null);

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('touchend', onTouchEnd);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleDragDelta]);

  // 迷你趨勢圖 SVG Path
  const miniChartSvgPath = useMemo(() => {
    if (totalPoints === 0) return '';
    let min = Infinity;
    let max = -Infinity;
    for (const d of allData) {
      if (d.nav < min) min = d.nav;
      if (d.nav > max) max = d.nav;
    }
    const range = max - min || 1;
    const width = 1000;
    const height = 48;

    const points = allData.map((d, i) => {
      const x = (i / (totalPoints - 1)) * width;
      const y = height - ((d.nav - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M ${points.join(' L ')}`;
  }, [allData, totalPoints]);

  const leftPercent = totalPoints > 1 ? (startIndex / (totalPoints - 1)) * 100 : 0;
  const rightPercent = totalPoints > 1 ? (endIndex / (totalPoints - 1)) * 100 : 100;
  const windowWidthPercent = Math.max(1.5, rightPercent - leftPercent);

  // 懸浮提示內容 (依據 yAxisMode 轉換數值呈現)
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: DailyNavPoint = payload[0].payload;
      const isReturn = yAxisMode === 'return';
      const etfRet = data.normalizedReturnEtf ?? 0;
      const bmRet = data.normalizedReturnBenchmark ?? 0;
      const etfNorm = data.normalizedNav ?? 10.0;
      const bmNorm = data.normalizedBenchmark ?? 10.0;

      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-lg shadow-xl border border-slate-700/80 text-xs flex flex-col gap-1.5 pointer-events-none min-w-[215px]">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-1">
            <span className="font-semibold text-slate-300 font-mono">{data.date}</span>
            {data.rebalancedToday && (
              <span className="text-[10px] bg-red-900/80 text-red-200 px-1.5 py-0.2 rounded font-medium">
                每季再平衡日
              </span>
            )}
          </div>

          {/* 自組 ETF (紅色) */}
          <div className="flex items-baseline justify-between gap-3 pt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-300 font-medium">
                自組 ETF ({isReturn ? '累積報酬' : '起始10元淨值'}):
              </span>
            </div>
            <span className="font-bold text-sm font-mono text-red-400 tabular-nums">
              {isReturn ? (
                `${etfRet >= 0 ? '+' : ''}${etfRet.toFixed(2)}%`
              ) : (
                `${etfNorm.toFixed(3)} 元`
              )}
            </span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 pl-3.5">
            <span>{isReturn ? '對應淨值' : '區間報酬'}:</span>
            <span className="font-mono text-white">
              {isReturn ? `${data.nav.toFixed(2)} 元` : `${etfRet >= 0 ? '+' : ''}${etfRet.toFixed(2)}%`}
            </span>
          </div>

          {/* 對比標的 (藍色) */}
          <div className="flex items-baseline justify-between gap-3 pt-1 border-t border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-slate-300 font-medium">
                {benchmarkSymbol} ({isReturn ? '累積報酬' : '起始10元淨值'}):
              </span>
            </div>
            <span className="font-bold text-sm font-mono text-blue-400 tabular-nums">
              {isReturn ? (
                `${bmRet >= 0 ? '+' : ''}${bmRet.toFixed(2)}%`
              ) : (
                `${bmNorm.toFixed(3)} 元`
              )}
            </span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 pl-3.5">
            <span>{isReturn ? '還原收盤價' : '區間報酬'}:</span>
            <span className="font-mono text-white">
              {isReturn ? `${data.benchmarkPrice?.toFixed(2)} 元` : `${bmRet >= 0 ? '+' : ''}${bmRet.toFixed(2)}%`}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col gap-4">
      {/* 標題欄與再平衡模式切換 Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-6 bg-red-600 rounded-xs" />
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              淨值走勢與對比
              <span className="text-xs font-normal text-slate-500 font-sans hidden sm:inline">
                NAV & Benchmark
              </span>
            </h1>
          </div>
        </div>

        {/* 右側：再平衡機制 Toggle 開關 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700 whitespace-nowrap flex items-center gap-1">
            <RotateCw className="w-3.5 h-3.5 text-slate-500" />
            回測模式:
          </span>
          <div className="inline-flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => onToggleRebalanceMode('buy_and_hold')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                rebalanceMode === 'buy_and_hold'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              買進持有 (Buy & Hold)
            </button>
            <button
              type="button"
              onClick={() => onToggleRebalanceMode('quarterly_rebalance')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                rebalanceMode === 'quarterly_rebalance'
                  ? 'bg-red-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              每季再平衡 (Quarterly)
            </button>
          </div>
        </div>
      </div>

      {/* 控制列：查詢區間選單 + 自訂起訖日期 + Y軸切換 + 基準對比輸入框 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-lg border border-slate-200/60">
        {/* 查詢區間快速按鈕 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            查詢區間:
          </span>

          <div className="relative inline-block">
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetSelect(e.target.value as RangePreset)}
              className="appearance-none bg-white border border-slate-300 rounded-md pl-3 pr-8 py-1.5 text-xs font-medium text-slate-800 shadow-2xs hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
            >
              <option value="1M">一個月 (1M)</option>
              <option value="6M">半年 (6M)</option>
              <option value="1Y">一年 (1Y)</option>
              <option value="3Y">三年 (3Y)</option>
              <option value="5Y">五年 (5Y 全歷史)</option>
              <option value="CUSTOM">自訂區間 (Custom)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="hidden sm:flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-md">
            {(['1M', '6M', '1Y', '3Y', '5Y'] as RangePreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePresetSelect(p)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  selectedPreset === p
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* 控制項目右側群組：自訂日期 + Y軸切換按鈕 + 對比標的輸入框 */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 自訂區間日期 */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDateStr}
              min={minAvailableDate}
              max={endDateStr || maxAvailableDate}
              onChange={handleCustomStartDate}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <span className="text-slate-400 text-xs">至</span>
            <input
              type="date"
              value={endDateStr}
              min={startDateStr || minAvailableDate}
              max={maxAvailableDate}
              onChange={handleCustomEndDate}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          {/* 1. 【Y 軸動態切換按鈕】：顯示淨值 / 顯示報酬率 (%) */}
          <div className="inline-flex bg-slate-200/70 p-0.5 rounded-md border border-slate-300/70">
            <button
              type="button"
              onClick={() => setYAxisMode('nav')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 whitespace-nowrap ${
                yAxisMode === 'nav'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Y軸以起始日 10.00 元淨值呈現"
            >
              <DollarSign className="w-3 h-3" />
              <span>顯示淨值</span>
            </button>
            <button
              type="button"
              onClick={() => setYAxisMode('return')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 whitespace-nowrap ${
                yAxisMode === 'return'
                  ? 'bg-red-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Y軸以起始日 0.00% 報酬率呈現"
            >
              <Percent className="w-3 h-3" />
              <span>顯示報酬率 (%)</span>
            </button>
          </div>

          {/* 基準對比標的輸入框 (預設 0050.TW) */}
          <form onSubmit={handleBenchmarkSubmit} className="flex items-center gap-1.5 ml-auto lg:ml-0">
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <GitCompare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="hidden sm:inline">對比標的:</span>
            </div>
            <div className="relative flex items-center">
              <input
                type="text"
                value={bmInput}
                onChange={(e) => setBmInput(e.target.value)}
                onBlur={handleBenchmarkSubmit}
                placeholder="例如 0050.TW"
                className="bg-white border border-slate-300 rounded-l px-2 py-1 text-xs font-mono font-bold text-blue-700 w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-r text-xs font-medium"
                title="套用對比標的"
              >
                套用
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 走勢基準與報酬摘要 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs px-1 text-slate-600 gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">
            基準座標說明：
          </span>
          <span className="text-slate-500">
            {yAxisMode === 'return' ? (
              <>以區間起始日（{startDateStr}）強制作為 <strong className="text-slate-800">0.00%</strong> 報酬率起算對比。</>
            ) : (
              <>以區間起始日（{startDateStr}）強制作為 <strong className="text-slate-800">10.00 元</strong> 淨值起算對比。</>
            )}
          </span>
        </div>

        <div className="flex items-center gap-4 font-mono font-semibold">
          <div className="flex items-center gap-1.5 text-red-600">
            <span className="w-3 h-0.5 bg-red-600" />
            <span>自組 ETF: {rangeReturnEtf >= 0 ? '+' : ''}{rangeReturnEtf.toFixed(2)}%</span>
          </div>
          <div className="flex items-center gap-1.5 text-blue-600">
            <span className="w-3 h-0.5 bg-blue-600 border-b border-dashed border-blue-600" />
            <span>{benchmarkSymbol}: {rangeReturnBm >= 0 ? '+' : ''}{rangeReturnBm.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* 主折線圖表 */}
      <div className="relative w-full h-[280px] sm:h-[360px] lg:h-[420px] pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={visibleData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
              tickFormatter={(val) => {
                if (!val) return '';
                const parts = val.split('-');
                return `${parts[0].slice(2)}/${parts[1]}`;
              }}
              minTickGap={45}
            />

            <YAxis
              domain={yDomain}
              orientation="right"
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
              tickFormatter={(v) => {
                if (yAxisMode === 'return') {
                  return `${v >= 0 ? '+' : ''}${Number(v).toFixed(0)}%`;
                }
                return Number(v).toFixed(1);
              }}
              width={yAxisMode === 'return' ? 48 : 42}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* 起始基準參考線 (0.0% 或 10.00元) */}
            <ReferenceLine
              y={yAxisMode === 'return' ? 0.0 : 10.0}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{
                value: yAxisMode === 'return' ? '基準 0.0%' : '區間起始 10.00 元',
                position: 'left',
                fill: '#94a3b8',
                fontSize: 10,
                offset: 5,
              }}
            />

            {/* 對比標的 (藍色虛線) */}
            <Line
              type="monotone"
              dataKey={yAxisMode === 'return' ? 'normalizedReturnBenchmark' : 'normalizedBenchmark'}
              name={benchmarkSymbol}
              stroke="#2563eb"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4, fill: '#2563eb', stroke: '#fff', strokeWidth: 1.5 }}
              isAnimationActive={false}
            />

            {/* 自組 ETF (主要紅色折線) */}
            <Line
              type="monotone"
              dataKey={yAxisMode === 'return' ? 'normalizedReturnEtf' : 'normalizedNav'}
              name="自組 ETF"
              stroke="#dc2626"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: '#dc2626', stroke: '#ffffff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 2. 【迷你時間軸視覺強化 (Enhanced Timeline Slider)】 */}
      <div className="pt-2 flex flex-col gap-1.5 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-700">時間軸縮放視窗 (Timeline Slider)</span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              · 被選取範圍維持明亮清晰，兩側灰色遮罩可拖曳調整
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-600">
            {startDateStr} ~ {endDateStr} ({visibleData.length} 個交易日)
          </div>
        </div>

        {/* 強化後的迷你軌道容器：高度增為 48px (h-12)，具備高度視覺對比 */}
        <div
          ref={sliderTrackRef}
          className="relative w-full h-12 bg-slate-100 rounded-lg overflow-hidden select-none border border-slate-200/90 shadow-2xs"
        >
          {/* 迷你全歷史折線 SVG (5年走勢) */}
          <svg
            viewBox="0 0 1000 48"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full opacity-50 pointer-events-none"
          >
            <path d={miniChartSvgPath} fill="none" stroke="#dc2626" strokeWidth="2" />
          </svg>

          {/* 未選取左側半透明灰色遮罩 (高對比強化) */}
          <div
            style={{ width: `${leftPercent}%` }}
            className="absolute top-0 bottom-0 left-0 bg-slate-400/50 backdrop-blur-[1.5px] border-r border-slate-400/40"
          />

          {/* 未選取右側半透明灰色遮罩 (高對比強化) */}
          <div
            style={{ left: `${rightPercent}%`, right: 0 }}
            className="absolute top-0 bottom-0 bg-slate-400/50 backdrop-blur-[1.5px] border-l border-slate-400/40"
          />

          {/* 被選取的活躍視窗：極淺紅色強調色背景 + 上下鮮明紅色邊框 + 可拖曳平移 */}
          <div
            style={{
              left: `${leftPercent}%`,
              width: `${windowWidthPercent}%`,
            }}
            onMouseDown={(e) => handleMouseDown('window', e)}
            onTouchStart={(e) => handleTouchStart('window', e)}
            className="absolute top-0 bottom-0 border-y-2 border-red-600 bg-red-600/10 cursor-grab active:cursor-grabbing flex items-center justify-between group transition-colors shadow-sm"
            title="拖曳以平移選取區間"
          >
            {/* 左側拉桿 (清晰搶眼的雙槽握把) */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                handleMouseDown('left', e);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleTouchStart('left', e);
              }}
              className="absolute -left-2 top-0 bottom-0 w-4 bg-red-600 hover:bg-red-700 rounded-sm cursor-ew-resize flex items-center justify-center shadow-md transition-colors z-10"
              title="拉動調整開始日期"
            >
              <div className="flex gap-0.5">
                <div className="w-0.5 h-3.5 bg-white rounded-full opacity-90" />
                <div className="w-0.5 h-3.5 bg-white rounded-full opacity-90" />
              </div>
            </div>

            {/* 中央抓手握把提示 */}
            <div className="mx-auto flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="w-0.5 h-3 bg-red-700 rounded-full" />
              <div className="w-0.5 h-3 bg-red-700 rounded-full" />
              <div className="w-0.5 h-3 bg-red-700 rounded-full" />
            </div>

            {/* 右側拉桿 (清晰搶眼的雙槽握把) */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                handleMouseDown('right', e);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleTouchStart('right', e);
              }}
              className="absolute -right-2 top-0 bottom-0 w-4 bg-red-600 hover:bg-red-700 rounded-sm cursor-ew-resize flex items-center justify-center shadow-md transition-colors z-10"
              title="拉動調整結束日期"
            >
              <div className="flex gap-0.5">
                <div className="w-0.5 h-3.5 bg-white rounded-full opacity-90" />
                <div className="w-0.5 h-3.5 bg-white rounded-full opacity-90" />
              </div>
            </div>
          </div>
        </div>

        {/* 軌道下方端點標示 */}
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
          <span>{minAvailableDate} (5年前)</span>
          <span>{maxAvailableDate} (最新交易日)</span>
        </div>
      </div>
    </div>
  );
};
