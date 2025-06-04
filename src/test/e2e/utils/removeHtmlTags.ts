import { t } from './initializeLocalization';

const htmlTagsPattern: RegExp = /\s*<\/?[^>]+(>|$)\s*/g;

export const removeHtmlTags: (key: string) => string = key =>
  t(key).replaceAll(htmlTagsPattern, ' ');
