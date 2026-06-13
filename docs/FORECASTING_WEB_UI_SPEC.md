# Specification: React Web Forecasting Interface & UX Controls

## 1. System Placement & Role
- **Zone Role:** Single Page Application (React / Tailwind / Recharts).
- **Responsibility:** Pulls the pre-compiled forecast JSON arrays and distills raw statistical metrics into web-optimized dashboard views.

## 2. Component Architecture & Data Rendering
- **Data Fetching:** Fetch projections inside a custom React hook (e.g., `useFinancialForecast`) using Axios or Fetch with clean loading, success, and empty states.
- **Visual Mapping:**
  - **Safe to Spend Tracker:** Compare monthly fixed bills against incoming income tracking. Render as a clean metric card: *"Based on your usual bills, you have $X left to spend safely this week."*
  - **Trend Alerts:** If real-time category spending is outstripping the `predicted_amount` ceiling, inject a contextual warning bar: *"Heads up: You are trending to spend $X more on [Category] this month than usual."*

## 3. Non-Functional Requirements (NFRs) & Asynchronous Loading States
- **Target Performance API Latency:** Metric cards and data transformations must settle within < 200ms once fetched.
- **Glassmorphic Skeleton Placeholders:**
  - If the data fetch takes longer than 150ms, the UI MUST instantly display a translucent, blurred glassmorphic container layout (`backdrop-blur-md bg-white/30` or equivalent theme utility).
  - The skeleton layout must match the exact dimensions of the expected Recharts Area graph and progress bars to prevent jarring content layouts or visual shifts (CLS) when loading completes.
  - **Extensibility Hook:** Encapsulate the loading view inside an independent `<ForecastLoadingPlaceholder />` component. This architecture isolates the loading screen layout so it can be swapped later with rotating financial tips without editing the primary chart layout files.