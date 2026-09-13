export interface SeoProps {
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly noindex?: boolean;
  readonly siteSchema?: boolean;
}

export interface SeoPageSpec {
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly path: string;
  readonly noindex?: boolean;
  readonly siteSchema?: boolean;
}

export interface SocialTagOptions {
  readonly title: string;
  readonly description: string;
  readonly url: string;
  readonly siteName: string;
  readonly locale: string;
}
