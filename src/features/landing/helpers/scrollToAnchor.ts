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

  const observer: MutationObserver = new MutationObserver(() => {
    if (scrollToElement(id)) {
      observer.disconnect();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
};

export default function scrollToAnchor(link: string): void {
  const id: string = link.startsWith('#') ? link.slice(1) : link;

  // Prevent endless observer when no valid ID is provided
  if (!id) return;
  waitForElement(id);
}
