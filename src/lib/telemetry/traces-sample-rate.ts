export const PRODUCTION_TRACES_SAMPLE_RATE: number = 0.1;

export const DEVELOPMENT_TRACES_SAMPLE_RATE: number = 1;

export function resolveTracesSampleRate(configured: number | '', environment: string): number {
  if (configured !== '') return configured;
  return environment === 'production'
    ? PRODUCTION_TRACES_SAMPLE_RATE
    : DEVELOPMENT_TRACES_SAMPLE_RATE;
}
