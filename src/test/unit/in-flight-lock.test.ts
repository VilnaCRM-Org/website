import { BaseSyntheticEvent } from 'react';

import {
  createInFlightLock,
  InFlightLock,
  lockSubmission,
  SubmitEventHandler,
} from '../../features/landing/components/auth-section/auth-form/in-flight-lock';

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}

function defer(): Deferred {
  let resolve: () => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise: Promise<void> = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function submitEvent(): BaseSyntheticEvent & { preventDefault: jest.Mock } {
  return { preventDefault: jest.fn() } as unknown as BaseSyntheticEvent & {
    preventDefault: jest.Mock;
  };
}

describe('lockSubmission', () => {
  let lock: InFlightLock;
  let pending: Deferred;
  let submit: jest.Mock<ReturnType<SubmitEventHandler>, Parameters<SubmitEventHandler>>;

  beforeEach(() => {
    lock = createInFlightLock();
    pending = defer();
    submit = jest.fn(() => pending.promise);
  });

  it('runs the submission with its event and holds the lock until it settles', async () => {
    const event = submitEvent();
    const run: Promise<void> = lockSubmission(lock, submit)(event);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(event);
    expect(lock.tryAcquire()).toBe(false);

    pending.resolve();
    await run;

    expect(lock.tryAcquire()).toBe(true);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('ignores a second submission while the first is in flight', async () => {
    const guarded: SubmitEventHandler = lockSubmission(lock, submit);
    const first = submitEvent();
    const second = submitEvent();

    const firstRun: Promise<void> = guarded(first);
    await expect(guarded(second)).resolves.toBeUndefined();

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(first);
    expect(second.preventDefault).toHaveBeenCalledTimes(1);
    expect(first.preventDefault).not.toHaveBeenCalled();

    pending.resolve();
    await firstRun;
  });

  it('ignores an event-less retry while a submission is in flight', async () => {
    const firstRun: Promise<void> = lockSubmission(lock, submit)(submitEvent());

    await expect(lockSubmission(lock, submit)()).resolves.toBeUndefined();

    expect(submit).toHaveBeenCalledTimes(1);
    pending.resolve();
    await firstRun;
  });

  it('shares one lock between the submit and the retry handlers', async () => {
    const retry: jest.Mock<ReturnType<SubmitEventHandler>, []> = jest.fn(() => Promise.resolve());
    const firstRun: Promise<void> = lockSubmission(lock, submit)(submitEvent());

    await lockSubmission(lock, retry)();

    expect(retry).not.toHaveBeenCalled();
    pending.resolve();
    await firstRun;

    await lockSubmission(lock, retry)();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('accepts a new submission once the previous one has resolved', async () => {
    const guarded: SubmitEventHandler = lockSubmission(lock, submit);

    const firstRun: Promise<void> = guarded(submitEvent());
    pending.resolve();
    await firstRun;
    await guarded(submitEvent());

    expect(submit).toHaveBeenCalledTimes(2);
    expect(lock.tryAcquire()).toBe(true);
  });

  it('releases the lock and rethrows when the submission rejects', async () => {
    const guarded: SubmitEventHandler = lockSubmission(lock, submit);
    const failure: Error = new Error('submission failed');

    const firstRun: Promise<void> = guarded(submitEvent());
    pending.reject(failure);

    await expect(firstRun).rejects.toBe(failure);

    submit.mockResolvedValueOnce(undefined);
    await guarded(submitEvent());
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('ignores every submission while the lock is already held', async () => {
    expect(lock.tryAcquire()).toBe(true);
    const event = submitEvent();

    await lockSubmission(lock, submit)(event);

    expect(submit).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(lock.tryAcquire()).toBe(false);
  });

  it('frees a lock only through release', () => {
    expect(lock.tryAcquire()).toBe(true);
    expect(lock.tryAcquire()).toBe(false);

    lock.release();

    expect(lock.tryAcquire()).toBe(true);
  });

  it('keeps separate locks independent', async () => {
    const other: InFlightLock = createInFlightLock();
    const firstRun: Promise<void> = lockSubmission(lock, submit)(submitEvent());

    expect(other.tryAcquire()).toBe(true);
    pending.resolve();
    await firstRun;
  });
});
