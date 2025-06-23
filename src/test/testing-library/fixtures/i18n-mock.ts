type I18nMock = {
  useTranslation: () => {
    t: (key: string) => string;
  };
};

const createI18nMock: (translations: Record<string, string>) => I18nMock = (
  translations: Record<string, string>
) => ({
  useTranslation: (): { t: (key: string) => string } => ({
    t: (key: string): string => translations[key] || key,
  }),
});

export default createI18nMock;
