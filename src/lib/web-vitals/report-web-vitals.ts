import * as Sentry from '@sentry/react';
import type { NextWebVitalsMetric } from 'next/app';

import { isProductionBuild } from '@/config/env';

const FORWARDED_VITALS: ReadonlySet<string> = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);

const VITALS_SAMPLE_RATE = 0.1;

type GtagEvent = (command: 'event', name: string, params: Record<string, unknown>) => void;

function getGtag(): GtagEvent | undefined {
  return (globalThis as typeof globalThis & { gtag?: GtagEvent }).gtag;
}

function unitForVital(name: string): 'millisecond' | '' {
  return name === 'CLS' ? '' : 'millisecond';
}

function gaValueForVital(metric: NextWebVitalsMetric): number {
  return metric.name === 'CLS' ? Math.round(metric.value * 1000) : Math.round(metric.value);
}

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

export function forwardWebVital(metric: NextWebVitalsMetric): void {
  getGtag()?.('event', metric.name, {
    metric_id: metric.id,
    value: gaValueForVital(metric),
    metric_value: metric.value,
  });
  Sentry.setMeasurement(metric.name, metric.value, unitForVital(metric.name));
}

export function handleWebVitalsMetric(metric: NextWebVitalsMetric): void {
  if (!shouldForwardWebVital(metric, isProductionBuild(), Math.random())) {
    return;
  }
  forwardWebVital(metric);
}
