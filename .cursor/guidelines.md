# MintrAIQ Web: Coding Guidelines & Standards

## Implementation status (repository)

These rules are the **target** architecture. Current code may lag until migrated:

| Area | Status |
|------|--------|
| **`apps/ninja-react/`** | React **18** + TypeScript + Vite; **TanStack Query** for sample JSON loads; Chart.js uses **`useEffect`** only for imperative canvas lifecycle (not replaceable by Query). **`api/samples.ts`** holds fetch helpers. NZ disclaimer + **error boundary** wrap widgets (see `AiDisclaimer.tsx`, `WidgetErrorBoundary.tsx`). |
| **Portal / `web/` / `legacy/`** | Mostly vanilla JS + shared CSS (`portal/css/`); **not** Tailwind yet. Add TanStack + Zod here when those screens move into React. |
| **Zod** | **`apps/ninja-react`:** `schemas/samples.ts` validates sample payloads before render. **Portal:** add Zod on forms/API bodies bound for FastAPI. |
| **Tailwind** | **Target** for new React UI. Existing shell pages use design tokens / `portal-app.css` and inline styles in embeds until Tailwind is adopted. |

## 1. React & TypeScript Patterns

- **Strict Typing:** Never use `any`. Prefer **`interface`** over `type` for object shapes (extensibility).
- **Component Style:** Functional components with explicit return types (e.g. `JSX.Element`).
- **Hooks:** Shared logic → `hooks/`; avoid **`useEffect` for data fetching** (use TanStack Query). Keep **`useEffect`** only for DOM/chart subscriptions and similar imperative glue.
- **Naming:** Components `PascalCase`; functions/variables `camelCase`; constants `UPPER_SNAKE_CASE`.

## 2. Data Fetching & State (TanStack Query)

- **Server / async JSON:** Use **`useQuery` / `useMutation`** and a **query key factory** (see `apps/ninja-react/src/queryKeys.ts`).
- **Separation of concerns:** HTTP helpers live under **`api/`**; components use hooks or thin wrappers.

## 3. Tailwind CSS & UI Conventions

- **Utility-first** for **new** React work once Tailwind is added to the embed build.
- Until then, match **`portal-app.css`** variables (`--text-secondary`, `--accent-green`, etc.) and mobile-first layout in markup.

## 4. Component Architecture (Intent-Based UI)

- **Widgets:** Card-oriented components that accept JSON payloads from FastAPI agents.
- **Colocation:** Types + small helpers next to the widget (`ForecastApp.tsx`, `api/samples.ts`, …).

## 5. Flask Migration Specifics

- Remove Python/Jinja control flow when porting; use `.map()` + stable **`key`** props.
- Prefer **`finance-ai-dashboard` FastAPI** over legacy Flask routes for new wiring.
