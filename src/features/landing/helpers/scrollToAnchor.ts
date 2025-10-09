export const scrollToElement: (id: string) => boolean = (id: string): boolean => {
  const element: HTMLElement | null = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
    return true;
  }
  return false;
};
export const waitForElement: (id: string) => void = (id: string): void => {
  if (scrollToElement(id)) return;

  const MAX_WAIT_TIME: number = 10000;
  let timeoutId: number | undefined;
  let observer: MutationObserver | null = null;

  observer = new MutationObserver(() => {
    if (scrollToElement(id)) {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      observer?.disconnect();
      observer = null;
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // schedule fallback to avoid leaking the observer forever
  timeoutId = window.setTimeout(() => {
    observer?.disconnect();
    observer = null;
  }, MAX_WAIT_TIME);
};

export default function scrollToAnchor(link: string): void {
  const id: string = link.startsWith('#') ? link.slice(1) : link;

  // Prevent endless observer when no valid ID is provided
  if (!id) return;
  waitForElement(id);
}
