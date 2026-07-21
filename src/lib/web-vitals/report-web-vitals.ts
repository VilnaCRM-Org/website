import * as Sentry from '@sentry/react';
import type { NextWebVitalsMetric } from 'next/app';

import { isProductionBuild } from '@/config/env';

/**
 * Real-user (field) Core Web Vitals forwarding for the pages-router
 * `reportWebVitals` hook. Next.js invokes the hook for every metric it records;
 * this module decides which to forward and ships a strictly PII-free payload
 * (metric `name`, `id`, and numeric `value` only) to GA4 and Sentry.
 *
 * See `.claude/skills/observability-instrumentation/reference/web-vitals.md` for
 * the wiring and PII contract. Sentry only records once the DSN is set (#322) and
 * GA only once a real measurement id replaces the placeholder; landing the hook
 * now means telemetry is live the moment those keys are fixed.
 */

// The field vitals we forward. Next.js reports these with `label: 'web-vital'`;
// it also emits framework timings (hydration, route-change, render) with
// `label: 'custom'`, which are dropped so only true field vitals reach analytics.
const FORWARDED_VITALS: ReadonlySet<string> = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);

// Field data is statistical, so a 10% sample keeps analytics volume (and cost)
// bounded while still yielding a representative distribution.
const VITALS_SAMPLE_RATE = 0.1;

// GA4's `gtag` is injected onto `window` by the <GoogleAnalytics /> tag in
// `_app`. Reading it off the global (rather than importing the dev-only
// `@next/third-parties` helper into runtime code) keeps `src` free of
// devDependency imports and lets the forward no-op gracefully before the GA
// script has loaded.
type GtagEvent = (command: 'event', name: string, params: Record<string, unknown>) => void;

function getGtag(): GtagEvent | undefined {
  return (globalThis as typeof globalThis & { gtag?: GtagEvent }).gtag;
}

// CLS is a unitless layout-shift ratio; every other forwarded vital is a
// millisecond duration.
function unitForVital(name: string): 'millisecond' | '' {
  return name === 'CLS' ? '' : 'millisecond';
}

// GA4 event values must be integers. CLS is a small fraction, so it is scaled by
// 1000 (the conventional web-vitals→GA transform); durations are rounded to ms.
function gaValueForVital(metric: NextWebVitalsMetric): number {
  return metric.name === 'CLS' ? Math.round(metric.value * 1000) : Math.round(metric.value);
}

/**
 * Pure gate: a metric is forwarded only when it is a sampled field vital in a
 * production build. Taking `isProduction` and `sample` as arguments keeps the
 * decision deterministic and fully unit-testable.
 */
export function shouldForwardWebVital(
  metric: NextWebVitalsMetric,
  isProduction: boolean,
  sample: number
): boolean {
  return (
    metric.label === 'web-vital' &&
    FORWARDED_VITALS.has(metric.name) &&
    isProduction &&
    sample < VITALS_SAMPLE_RATE
  );
}

/**
 * Ship the metric to GA4 (as a named event) and Sentry (as a measurement). Only
 * `name`, `id`, and `value` leave the browser — the payload is inherently
 * PII-free by construction.
 */
export function forwardWebVital(metric: NextWebVitalsMetric): void {
  getGtag()?.('event', metric.name, {
    metric_id: metric.id,
    value: gaValueForVital(metric),
    metric_value: metric.value,
  });
  Sentry.setMeasurement(metric.name, metric.value, unitForVital(metric.name));
}

/**
 * Orchestrator wired into `pages/_app.tsx`. Reads the two ambient inputs
 * (build mode and the per-call sample) and forwards when the gate passes.
 */
export function handleWebVitalsMetric(metric: NextWebVitalsMetric): void {
  if (!shouldForwardWebVital(metric, isProductionBuild(), Math.random())) {
    return;
  }
  forwardWebVital(metric);
}
