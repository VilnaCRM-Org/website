export default function scrollToAnchor(link: string): void {
  const id: string = link.startsWith('#') ? link.slice(1) : link;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}
