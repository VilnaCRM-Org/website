export const scrollToElement: (id: string) => boolean = (id: string): boolean => {
  const element: HTMLElement | null = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
    return true;
  }
  return false;
};

const MAX_WAIT_TIME: number = 10000;

const observeUntilFound: (id: string) => void = (id: string): void => {
  let timeoutId: number | undefined;
  let observer: MutationObserver | null = null;

  observer = new MutationObserver(() => {
    if (!scrollToElement(id)) return;
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    observer?.disconnect();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  timeoutId = window.setTimeout(() => observer?.disconnect(), MAX_WAIT_TIME);
};

export const waitForElement: (id: string) => void = (id: string): void => {
  if (!scrollToElement(id)) observeUntilFound(id);
};

export default function scrollToAnchor(link: string): void {
  const id: string = link.startsWith('#') ? link.slice(1) : link;

  if (!id) return;
  waitForElement(id);
}
