# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite)
npm run build      # Production build (outputs to dist/)
npm run preview    # Preview production build locally
npm run deploy     # Build and deploy to GitHub Pages
```

No test or lint scripts are configured.

## Architecture

This is a single-page PWA for physical inventory counting. The entire application lives in **`src/App.tsx`** (~1000+ lines) — a monolithic component managing all views, state, and business logic. There is no routing library; view switching is done via a `View` state union type (`"start" | "import" | "create-template" | "count" | "view-counts"`).

**Data persistence** is entirely via `localStorage`:
- `productCounter_templates` — saved form templates (`FormTemplate[]`)
- `productCounter_counts` — completed count history (`SavedCount[]`)
- `productCounter_session` — active counting session for resume on reload

**Build output** uses `vite-plugin-singlefile` to bundle everything into a single `index.html`, making offline use and sharing trivial. The `base` path is `product-inventory-tracking-pwa` for GitHub Pages hosting.

## Key Data Models

```typescript
interface Product { id: string; name: string; packagingSize: number; sortIndex?: number; }
interface CountItem { productId: string; productName: string; packagingSize: number; packageCount: number; singleCount: number; }
interface SavedCount { id: string; formName: string; timestamp: string; items: CountItem[]; }
interface FormTemplate { id: string; name: string; products: Product[]; createdAt: string; }
```

## CSV Format

The app imports product templates via CSV with columns: `Product ID, Name, Packaging Size, Sort Index`. Products are sorted by `sortIndex` descending, then alphabetically by name.

## Path Alias

`@/` maps to `src/` (configured in both `vite.config.ts` and `tsconfig.json`).
