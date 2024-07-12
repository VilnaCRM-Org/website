import * as fs from 'node:fs';

type TranslationNode = {
  [key: string]: string | TranslationNode;
};

type LocaleTranslation = {
  translation: TranslationNode;
};

type Translations = {
  [locale: string]: LocaleTranslation;
};

export type TranslationFunctionType = (translationKey: string) => string;

const localizationFileName: string = 'localization.json';
const language: string = process.env.NEXT_PUBLIC_MAIN_LANGUAGE as string;

function getAllTranslations(localizationPath: string): Translations {
  const translationsJSON: string = fs.readFileSync(
    `${localizationPath}/${localizationFileName}`,
    'utf8'
  );
  return JSON.parse(translationsJSON);
}

function findTranslation(translationKey: string, translationNode: TranslationNode): string {
  const keySegments: string[] = translationKey.split('.');
  let currentNode: TranslationNode | string = translationNode;

  for (const keySegment of keySegments) {
    if (!currentNode) break;
    if (typeof currentNode === 'object') currentNode = currentNode[keySegment];
  }

  if (typeof currentNode !== 'string')
    throw new Error(`No translation key found: ${translationKey}`);

  return currentNode;
}

export function createTranslation(localizationPath: string): TranslationFunctionType {
  const allTranslations: Translations = getAllTranslations(localizationPath);

  return translationKey => {
    const currentLanguageTranslation: TranslationNode = allTranslations[language].translation;

    return findTranslation(translationKey, currentLanguageTranslation);
  };
}
