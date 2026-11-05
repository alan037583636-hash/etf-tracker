import { DailyNavPoint, PortfolioHolding } from '../types/etf';

export function exportNavHistoryToCsv(
  holdings: PortfolioHolding[],
  navData: DailyNavPoint[],
  filename: string = 'custom_etf_nav_history.csv'
) {
  // Construct CSV Header
  const headers = ['日期(Date)', 'ETF淨值(NAV)', '單日報酬率(DailyReturn%)', '累積報酬率(CumulativeReturn%)', '大盤基準淨值(BenchmarkNAV)'];
  
  const holdingInfo = holdings.map((h) => `${h.symbol}(${h.name}): ${h.weight}%`).join('; ');
  
  const metaRows = [
    `# 個人專屬 ETF 追蹤儀表板 - 淨值走勢匯出`,
    `# 初始發行價: 10.00 元`,
    `# 持股配置: ${holdingInfo}`,
    `# 總筆數: ${navData.length} 交易日`,
    '',
  ];

  const dataRows = navData.map((d) => [
    d.date,
    d.nav.toFixed(3),
    d.dailyReturn.toFixed(2) + '%',
    d.cumulativeReturn.toFixed(2) + '%',
    (d.benchmarkPrice ? d.benchmarkPrice.toFixed(3) : d.nav.toFixed(3)),
  ].join(','));

  const csvContent = [...metaRows, headers.join(','), ...dataRows].join('\n');
  
  // Use UTF-8 BOM so Excel on Windows / Mac displays Traditional Chinese correctly without garbled text
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
