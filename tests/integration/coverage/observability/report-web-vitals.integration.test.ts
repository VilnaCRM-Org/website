/**
 * Integration: field web-vitals forwarding
 * (`src/lib/web-vitals/report-web-vitals.ts`).
 *
 * Exercises the pure gate, the GA4/Sentry forwarder, and the orchestrator wired
 * into `pages/_app.tsx`. GA (`window.gtag`) and Sentry (`setMeasurement`) are
 * stubbed so the test asserts the exact PII-free payload without a live analytics
 * or Sentry client.
 */
import * as Sentry from '@sentry/react';
import type { NextWebVitalsMetric } from 'next/app';

import {
  forwardWebVital,
  handleWebVitalsMetric,
  shouldForwardWebVital,
} from '@/lib/web-vitals/report-web-vitals';

jest.mock('@sentry/react', () => ({ setMeasurement: jest.fn() }));

const mockedSetMeasurement = Sentry.setMeasurement as jest.MockedFunction<typeof Sentry.setMeasurement>;

type TestGlobal = typeof globalThis & { gtag?: jest.Mock };
const testGlobal = globalThis as TestGlobal;

function stubGtag(): jest.Mock {
  const gtag = jest.fn();
  testGlobal.gtag = gtag;
  return gtag;
}

function makeMetric(overrides: Partial<NextWebVitalsMetric> = {}): NextWebVitalsMetric {
  return {
    id: 'v1-1699999999999-1234',
    name: 'LCP',
    label: 'web-vital',
    startTime: 0,
    value: 1234.56,
    ...overrides,
  } as NextWebVitalsMetric;
}

afterEach(() => {
  delete testGlobal.gtag;
});

describe('shouldForwardWebVital', () => {
  it('drops framework custom timings (label !== web-vital)', () => {
    const custom = makeMetric({
      label: 'custom',
      name: 'Next.js-hydration',
    } as Partial<NextWebVitalsMetric>);
    expect(shouldForwardWebVital(custom, true, 0)).toBe(false);
  });

  it('drops web-vitals outside the forwarded set (e.g. FID)', () => {
    expect(shouldForwardWebVital(makeMetric({ name: 'FID' }), true, 0)).toBe(false);
  });

  it('drops everything outside a production build', () => {
    expect(shouldForwardWebVital(makeMetric(), false, 0)).toBe(false);
  });

  it('drops samples at or above the sample rate', () => {
    expect(shouldForwardWebVital(makeMetric(), true, 0.5)).toBe(false);
  });

  it.each(['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const)(
    'forwards the field vital %s when sampled in production',
    name => {
      expect(shouldForwardWebVital(makeMetric({ name }), true, 0.05)).toBe(true);
    }
  );
});

describe('forwardWebVital', () => {
  it('forwards a duration vital to GA and Sentry with a PII-free payload', () => {
    const gtag = stubGtag();
    forwardWebVital(makeMetric({ name: 'LCP', value: 1234.56, id: 'lcp-1' }));

    expect(gtag).toHaveBeenCalledWith('event', 'LCP', {
      metric_id: 'lcp-1',
      value: 1235,
      metric_value: 1234.56,
    });
    expect(mockedSetMeasurement).toHaveBeenCalledWith('LCP', 1234.56, 'millisecond');
  });

  it('scales and rounds CLS as a unitless ratio', () => {
    const gtag = stubGtag();
    forwardWebVital(makeMetric({ name: 'CLS', value: 0.05123, id: 'cls-1' }));

    expect(gtag).toHaveBeenCalledWith('event', 'CLS', {
      metric_id: 'cls-1',
      value: 51,
      metric_value: 0.05123,
    });
    expect(mockedSetMeasurement).toHaveBeenCalledWith('CLS', 0.05123, '');
  });

  it('still records to Sentry when GA (gtag) has not loaded', () => {
    // No stubGtag(): window.gtag is undefined, so the GA forward short-circuits.
    forwardWebVital(makeMetric({ name: 'TTFB', value: 120, id: 'ttfb-1' }));

    expect(mockedSetMeasurement).toHaveBeenCalledWith('TTFB', 120, 'millisecond');
  });
});

describe('handleWebVitalsMetric', () => {
  it('does not forward outside a production build', () => {
    const gtag = stubGtag();
    // Jest runs with NODE_ENV=test, so the production gate rejects the metric.
    handleWebVitalsMetric(makeMetric());

    expect(gtag).not.toHaveBeenCalled();
    expect(mockedSetMeasurement).not.toHaveBeenCalled();
  });

  it('forwards a sampled field vital in a production build', () => {
    const gtag = stubGtag();
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const originalNodeEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });

    try {
      handleWebVitalsMetric(makeMetric({ name: 'INP', value: 200, id: 'inp-1' }));

      expect(gtag).toHaveBeenCalledTimes(1);
      expect(mockedSetMeasurement).toHaveBeenCalledWith('INP', 200, 'millisecond');
    } finally {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalNodeEnv,
        configurable: true,
      });
      randomSpy.mockRestore();
    }
  });
});
