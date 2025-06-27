const normalizeLink: (link: string) => string = (link: string): string =>
  link.replace(/^#/, '').toLowerCase();

export default normalizeLink;
