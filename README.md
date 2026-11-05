# Personal ETF Tracker (個人專屬 ETF 追蹤與回測儀表板)

> A modern, responsive financial web application for constructing custom ETF portfolios, backtesting 5-year total returns using real adjusted close market data, simulating rebalancing strategies, and analyzing drawdown and compound growth.

[![Next.js](https://img.shields.io/badge/Next.js-15+-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=flat&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-3178c6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-red.svg)](https://opensource.org/licenses/Apache-2.0)

---

## 🌐 Live Demo

- **Production Deployment (Vercel)**: `https://your-portfolio-tracker.vercel.app` *(Replace with your deployed Vercel domain)*
- **Preview Environment**: Fully functional interactive preview supporting client and server-side route caching.

---

## ✨ Features

- **Real Market Total Return (`Adj Close`)**: Fetches 5 years of historical stock prices via Yahoo Finance (`yahoo-finance2`), utilizing **Adjusted Close** prices to faithfully reflect dividends, splits, and total shareholder return.
- **Dynamic Rebalancing Simulation Engine**:
  - **Buy and Hold Mode**: Initial target allocation established at inception ($10.00 base NAV), with weights naturally drifting according to relative asset price appreciation.
  - **Quarterly Rebalancing Mode**: Periodically resets accumulated portfolio value back to user-defined target percentages at each calendar quarter boundary.
- **Normalized 10.00 Base & Dynamic Y-Axis**:
  - **NAV Mode**: Inception base forced to 10.00 NTD/USD at the start of any selected query interval, allowing fair, direct comparison with benchmark indexes (e.g. `0050.TW` or `SPY`).
  - **Return Mode (%)**: Toggles Y-axis and hover tooltips to relative percentage gain/loss starting from `0.00%`.
- **Interactive Dual-Line Chart & Timeline Slider**:
  - Built with Recharts and customized SVG brushes.
  - Features an enhanced **48px Timeline Slider** with frosted inactive masks, dual draggable handles, and center-window panning across 5 years of daily trading sessions.
  - Desktop mouse drag and mobile touch-screen drag support.
- **Component Sparklines (3-Month Trends)**:
  - Clean, zero-grid micro sparkline curves embedded in the holdings breakdown table illustrating each constituent's recent 3-month momentum.
- **Integer Weight & 100% Strict Validation**:
  - 1% step integer inputs with real-time colored visual allocation progress bar.
  - Submit/Apply buttons automatically gray out and lock with red warnings if aggregate allocation does not equal 100%.
- **Shareable URL State & LocalStorage Persistence**:
  - Serializes portfolio configuration into query parameters (e.g., `?portfolio=2454:40,2308:25,3711:25,2356:10`).
  - Automatic URL state sync and instant one-click clipboard link sharing with toast confirmation.
  - Automatic LocalStorage persistence across browser sessions.
- **Professional Performance Metrics**:
  - Real-time computation of **Current NAV**, **Total Return (%)**, **CAGR (Compound Annual Growth Rate)**, and **MDD (Max Drawdown)**, accompanied by explanatory educational tooltips.
- **Mobile-First Responsive Layout**:
  - Seamless layout folding and 2x2 / single-column responsive grids optimized for mobile viewports down to 320px.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework & Runtimes** | React 19, Next.js (App Router compatible), Node.js, Express / tsx |
| **Styling & Design System** | Tailwind CSS v4, Plus Jakarta Sans, JetBrains Mono (`tabular-nums`) |
| **Data Visualization** | Recharts, Custom Responsive SVG Sparklines & Timeline Brush |
| **Financial Data Source** | Yahoo Finance API (`yahoo-finance2`), Server Route Handlers with In-Memory Caching |
| **Icons & Micro-Interactions** | Lucide React |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.17.0 or higher
- **npm** or **pnpm** / **yarn**

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/personal-etf-tracker.git
cd personal-etf-tracker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to launch the dashboard.

### 4. Build for Production

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```text
├── app/
│   └── api/
│       └── historical-prices/
│           └── route.ts            # Next.js App Router Route Handler (Yahoo Finance & Caching)
├── src/
│   ├── components/
│   │   ├── Header.tsx              # Top bar, preset selector, and URL share button
│   │   ├── MetricsCards.tsx        # 4 Core KPI cards with financial tooltips (CAGR, MDD)
│   │   ├── NavTrendChart.tsx       # Main chart, % / NAV toggle, and enhanced timeline slider
│   │   ├── PortfolioManager.tsx    # Weight builder, 100% progress indicator, and validation
│   │   └── HoldingsBreakdown.tsx   # Sector allocation and 3-Month individual Sparklines
│   ├── types/
│   │   └── etf.ts                  # TypeScript models and interfaces
│   ├── utils/
│   │   ├── etfCalculator.ts        # Rebalancing engine, NAV compounding, and metrics math
│   │   ├── mockStockData.ts        # Preset portfolios and high-fidelity fallback generator
│   │   └── exportCsv.ts            # UTF-8 BOM CSV export helper
│   ├── App.tsx                     # Top-level state orchestration and URL synchronization
│   ├── index.css                   # Tailwind CSS v4 theme and font configurations
│   └── main.tsx                    # React client entry point
├── server.ts                       # Express full-stack proxy server with Vite middlewares
├── package.json
└── tsconfig.json
```

---

## ⚖️ Rebalancing Mathematical Model

### Inception ($t = 0$)
Given initial portfolio target weights $w_i \in [1, 100]$ such that $\sum w_i = 100$:

$$\text{NAV}_0 = 10.00$$

$$\text{Shares}_i = \frac{\text{NAV}_0 \times (w_i / 100)}{P_{i, 0}}$$

Where $P_{i, t}$ represents the Adjusted Close price of asset $i$ on trading day $t$.

### Mode A: Buy and Hold
$$\text{NAV}_t = \sum_{i} \text{Shares}_i \times P_{i, t}$$

### Mode B: Quarterly Rebalancing
At the opening of each calendar quarter $t_{\text{rebal}}$ (Q1, Q2, Q3, Q4):

$$\text{Shares}_{i, \text{new}} = \frac{\text{NAV}_{t_{\text{rebal}}} \times (w_i / 100)}{P_{i, t_{\text{rebal}}}}$$

---

## 🚢 Deployment on Vercel

1. Push your repository to **GitHub**.
2. Go to [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import your repository.
4. Framework Preset: **Next.js** (or Other if deploying the Express-Vite full-stack server).
5. Click **Deploy**. Vercel will build and assign a production URL.

---

## 📄 License

This project is open-sourced under the [Apache-2.0 License](LICENSE).
