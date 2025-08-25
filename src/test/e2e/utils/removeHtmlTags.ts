import { t } from './initializeLocalization';

const htmlTagsPattern: RegExp = /\s*<\/?[^>]+(>|$)\s*/g;

 const removeHtmlTags: (key: string) => string = key =>
  t(key).replaceAll(htmlTagsPattern, ' ');

export default removeHtmlTags;