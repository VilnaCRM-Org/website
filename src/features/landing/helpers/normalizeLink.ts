function normalizeLink(link: string): string {
  return link.replace(/^#/, '').toLowerCase();
}

export default normalizeLink;
