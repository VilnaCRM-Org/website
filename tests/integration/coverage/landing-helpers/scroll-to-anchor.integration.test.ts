import scrollToAnchor, {
  scrollToElement,
  waitForElement,
} from '../../../../src/features/landing/helpers/scrollToAnchor';

type ObserverCallback = () => void;

describe('integration: scrollToAnchor helpers', () => {
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

    class FakeMutationObserver {
      constructor(cb: ObserverCallback) {
        observerCallbacks.push(cb);
      }

      observe: jest.Mock = observeMock;

      disconnect: jest.Mock = disconnectMock;

      takeRecords: () => [] = () => [];
    }

    window.MutationObserver = FakeMutationObserver as unknown as typeof MutationObserver;
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

    it('disconnects the observer when the timeout fallback fires', () => {
      waitForElement('timed-out');

      jest.advanceTimersByTime(10000);

      expect(disconnectMock).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewMock).not.toHaveBeenCalled();
    });

    it('does not clear a timeout that has not been scheduled yet (observer fires during observe)', () => {
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
