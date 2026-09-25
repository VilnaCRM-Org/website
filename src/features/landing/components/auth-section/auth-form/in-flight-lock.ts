import { BaseSyntheticEvent } from 'react';

export interface InFlightLock {
  tryAcquire: () => boolean;
  release: () => void;
}

export type SubmitEventHandler = (event?: BaseSyntheticEvent) => Promise<void>;

export function createInFlightLock(): InFlightLock {
  let held: boolean = false;

  return {
    tryAcquire: (): boolean => {
      if (held) return false;
      held = true;
      return true;
    },
    release: (): void => {
      held = false;
    },
  };
}

function ignoreSubmission(event?: BaseSyntheticEvent): Promise<void> {
  event?.preventDefault();
  return Promise.resolve();
}

async function runLocked(
  lock: InFlightLock,
  submit: SubmitEventHandler,
  event?: BaseSyntheticEvent
): Promise<void> {
  try {
    await submit(event);
  } finally {
    lock.release();
  }
}

export function lockSubmission(lock: InFlightLock, submit: SubmitEventHandler): SubmitEventHandler {
  return (event?: BaseSyntheticEvent): Promise<void> =>
    lock.tryAcquire() ? runLocked(lock, submit, event) : ignoreSubmission(event);
}
