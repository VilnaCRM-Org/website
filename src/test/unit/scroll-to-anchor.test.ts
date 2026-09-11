/**
 * @jest-environment jsdom
 */
/**
 * Client-layer coverage for the landing `scrollToAnchor` helpers.
 *
 * The behaviour was previously asserted only by the integration layer
 * (`tests/integration/coverage/landing-helpers`), which the mutation runner
 * does not execute; the client specs that import the helper mock it, so
 * Stryker found "related" tests that killed nothing and scored the file at 0%.
 * This spec is the same behavioural contract in the layer Stryker runs: every
 * branch of `scrollToElement`, the observe/timeout/cleanup paths of
 * `waitForElement`, and the hash handling of `scrollToAnchor`.
 *
 * jsdom is declared per file because `src/test/unit` also runs under the node
 * (server) layer, where there is no `document`.
 *
 * Loading / error — Not applicable: synchronous DOM helper with a timer fallback,
 * which is exercised. Permission / auth — Not applicable.
 */
import scrollToAnchor, {
  scrollToElement,
  waitForElement,
} from '../../features/landing/helpers/scrollToAnchor';

type ObserverCallback = () => void;

describe('scrollToAnchor helpers', () => {
  let scrollIntoViewMock: jest.Mock;
  let observerCallbacks: ObserverCallback[];
  let observeMock: jest.Mock;
  let disconnectMock: jest.Mock;
  let originalMutationObserver: typeof MutationObserver;

  function flushObservers(): void {
    observerCallbacks.forEach(cb => cb());
  }

  beforeEach(() => {
    jest.useFakeTimers();
    scrollIntoViewMock = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    observerCallbacks = [];
    observeMock = jest.fn();
    disconnectMock = jest.fn();
    originalMutationObserver = window.MutationObserver;

    const fakeMutationObserver: jest.Mock = jest.fn((cb: ObserverCallback) => {
      observerCallbacks.push(cb);

      return { observe: observeMock, disconnect: disconnectMock, takeRecords: (): [] => [] };
    });

    window.MutationObserver = fakeMutationObserver as unknown as typeof MutationObserver;
  });

  afterEach(() => {
    window.MutationObserver = originalMutationObserver;
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  describe('scrollToElement', () => {
    it('scrolls and returns true when the element exists', () => {
      const el: HTMLDivElement = document.createElement('div');
      el.id = 'present';
      document.body.appendChild(el);

      expect(scrollToElement('present')).toBe(true);
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('returns false when the element is missing', () => {
      expect(scrollToElement('missing')).toBe(false);
      expect(scrollIntoViewMock).not.toHaveBeenCalled();
    });
  });

  describe('waitForElement', () => {
    it('scrolls immediately and sets up no observer when the element exists', () => {
      const el: HTMLDivElement = document.createElement('div');
      el.id = 'ready';
      document.body.appendChild(el);

      waitForElement('ready');

      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
      expect(observeMock).not.toHaveBeenCalled();
    });

    it('observes the DOM and scrolls once the element appears, then cleans up', () => {
      waitForElement('later');

      expect(scrollIntoViewMock).not.toHaveBeenCalled();
      expect(observeMock).toHaveBeenCalledWith(document.body, {
        childList: true,
        subtree: true,
      });

      const el: HTMLDivElement = document.createElement('div');
      el.id = 'later';
      document.body.appendChild(el);

      flushObservers();

      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
      expect(disconnectMock).toHaveBeenCalledTimes(1);
    });

    it('keeps observing when a mutation fires but the element is still absent', () => {
      waitForElement('never');

      flushObservers();

      expect(scrollIntoViewMock).not.toHaveBeenCalled();
      expect(disconnectMock).not.toHaveBeenCalled();
    });

    it('disconnects the observer when the 10s timeout fallback fires, and not before', () => {
      waitForElement('timed-out');

      jest.advanceTimersByTime(9999);
      expect(disconnectMock).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);

      expect(disconnectMock).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewMock).not.toHaveBeenCalled();
    });

    it('does not clear an unscheduled timeout (observer fires during observe)', () => {
      const clearTimeoutSpy: jest.SpyInstance = jest.spyOn(window, 'clearTimeout');

      // The element is absent when waitForElement runs (so the immediate
      // scrollToElement check fails and the observer is created), then appears
      // and the observer fires synchronously *during* observe() — before the
      // source assigns timeoutId. This exercises the `timeoutId === undefined`
      // guard branch in waitForElement.
      observeMock.mockImplementationOnce(() => {
        const el: HTMLDivElement = document.createElement('div');
        el.id = 'sync';
        document.body.appendChild(el);
        flushObservers();
      });

      waitForElement('sync');

      expect(scrollIntoViewMock).toHaveBeenCalled();
      expect(clearTimeoutSpy).not.toHaveBeenCalled();
      expect(disconnectMock).toHaveBeenCalled();
    });

    it('clears the pending timeout once the element appears via the observer', () => {
      const clearTimeoutSpy: jest.SpyInstance = jest.spyOn(window, 'clearTimeout');

      waitForElement('eventual');

      const el: HTMLDivElement = document.createElement('div');
      el.id = 'eventual';
      document.body.appendChild(el);

      flushObservers();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('scrollToAnchor', () => {
    it('returns early without observing when the id is empty after stripping the hash', () => {
      scrollToAnchor('#');

      expect(observeMock).not.toHaveBeenCalled();
      expect(scrollIntoViewMock).not.toHaveBeenCalled();
    });

    it('strips a leading hash before resolving the element', () => {
      const el: HTMLDivElement = document.createElement('div');
      el.id = 'Contacts';
      document.body.appendChild(el);

      scrollToAnchor('#Contacts');

      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    });

    it('accepts a bare id without a leading hash', () => {
      const el: HTMLDivElement = document.createElement('div');
      el.id = 'Advantages';
      document.body.appendChild(el);

      scrollToAnchor('Advantages');

      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    });
  });
});
