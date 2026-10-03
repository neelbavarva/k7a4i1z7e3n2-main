# KAIZEN Screener

> Advanced Macroeconomic Dataset Screener, Market Valuation Analyzer, & Historical Comparison Engine.

KAIZEN Screener is a high-performance macro financial analytics application built with Next.js 15, React 19, and Lightweight Charts. It provides multi-dataset timeline exploration, market valuation baselines (Buffett Indicator rolling bands), OECD AI capital intensity tracking, historical bubble benchmark libraries, and modular insight/comparison engines.

---

## Key Features

- **Multi-Dataset Screener:** Simultaneous multi-dataset timeline analysis (GDP, Market Cap, Buffett Indicator, GDP Growth, AI Capital Intensity, Bubble Benchmarks).
- **Valuation Flow Equilibrium:** Rolling 10-year Buffett average $\pm$ 2 standard deviation envelopes with adaptive baselines.
- **AI Capital Flow Tracker:** OECD-backed annual AI venture capital intensity normalized by GDP.
- **Historical Bubble Library:** Peak-normalized historical bubble reference data (Dot-com 2000, Japan 1989, US Housing 2006, Crypto 2021).
- **Pure Analytical Engines:** Framework-independent calculation engines for dataset compatibility, statistical distribution, rules-based insights, and multi-period historical comparisons.

---

## Tech Stack

- **Framework:** Next.js 15.5 (App Router)
- **UI & Logic:** React 19, TypeScript 5.7, plain CSS (`app/globals.css`, the FX Fundamental Bias design system)
- **Charting:** Lightweight Charts 5.2, Canvas API
- **Type & Icons:** Young Serif + Instrument Sans (self-hosted via @fontsource), inline SVG icons, round flags from country-flag-icons (MIT)

---

## Prerequisites

- **Node.js:** `>= 18.0.0` (Recommended: `20.x`)
- **npm:** `>= 9.0.0`

---

## Getting Started

### 1. Installation

```bash
npm install
```

### 2. Development Server

Start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build

Compile and generate an optimized production build:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

---

## Project Structure

```
├── app/                  # Next.js App Router pages and API routes
├── components/           # React UI components
│   ├── dashboard/        # Main screener dashboard & Lightweight Chart wrapper
│   ├── historical/       # Timeline overlay & event hover cards
│   └── ui/               # Reusable UI primitives (Card, Button, Dialog)
├── lib/                  # Pure TypeScript domain & engine layers
│   ├── analysis/         # Statistical & market metric engines
│   ├── comparison/       # Phase 5A Historical Comparison Engine & strategies
│   ├── datasets/         # Dataset registry & Compatibility Engine
│   ├── historical/       # Event index, density filter, & Timeline Renderer
│   ├── insights/         # Phase 4A/4B Insight Engine & providers
│   └── worldbank/        # Macro dataset API providers
└── public/               # Static assets
```

---

## License

This project is licensed under the [MIT License](LICENSE).
