import i18n from 'i18next';

import i18nConfig from '../../config/i18nConfig';

const contactsKey: string = 'header.contacts';
const contactsEnglishText: string = 'Contacts';
const contactsUkrainianText: string = 'Контакти';

const advantagesKey: string = 'header.advantages';
const advantagesEnglishText: string = 'Advantages';
const advantagesUkrainianText: string = 'Переваги';

const forWhoKey: string = 'header.for_who';
const forWhoEnglishText: string = 'For who';
const forWhoUkrainianText: string = 'Для кого';

const nonExistingKey: string = 'non_existing_key';

describe('i18n translation function', () => {
  it('should return correct English translation', () => {
    i18n.changeLanguage('en');

    expect(i18n.t(contactsKey)).toBe(contactsEnglishText);
    expect(i18n.t(advantagesKey)).toBe(advantagesEnglishText);
    expect(i18n.t(forWhoKey)).toBe(forWhoEnglishText);

    expect(i18n.t(contactsKey)).not.toBe(contactsUkrainianText);
    expect(i18n.t(advantagesKey)).not.toBe(advantagesUkrainianText);
    expect(i18n.t(forWhoKey)).not.toBe(forWhoUkrainianText);
  });

  it('should return correct Ukrainian translation', () => {
    i18n.changeLanguage('uk');

    expect(i18n.t(contactsKey)).toBe(contactsUkrainianText);
    expect(i18n.t(advantagesKey)).toBe(advantagesUkrainianText);
    expect(i18n.t(forWhoKey)).toBe(forWhoUkrainianText);

    expect(i18n.t(contactsKey)).not.toBe(contactsEnglishText);
    expect(i18n.t(advantagesKey)).not.toBe(advantagesEnglishText);
    expect(i18n.t(forWhoKey)).not.toBe(forWhoEnglishText);
  });

  it('should return key if translation is missing', () => {
    expect(i18n.t(nonExistingKey)).toBe(nonExistingKey);
  });
});

describe('Localization Configuration', () => {
  let OLD_ENV: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.resetModules(); // Clears module cache for fresh imports
    OLD_ENV = { ...process.env }; // Backup environment variables
  });

  afterEach(() => {
    Object.keys(process.env).forEach(key => delete process.env[key]); // Clear all environment variables
    Object.assign(process.env, OLD_ENV); // Restore original values
  });

  it('should throw an error if both mainLanguage and fallbackLanguage are missing', async () => {
    delete process.env.NEXT_PUBLIC_MAIN_LANGUAGE;
    delete process.env.NEXT_PUBLIC_FALLBACK_LANGUAGE;

    await expect(import('../../config/i18nConfig.js')).rejects.toThrow(
      'Missing required environment variables for localization'
    );
  });
  it('should throw an error if only fallbackLanguage is missing', async () => {
    process.env.NEXT_PUBLIC_MAIN_LANGUAGE = 'uk';
    delete process.env.NEXT_PUBLIC_FALLBACK_LANGUAGE;

    await expect(import('../../config/i18nConfig.js')).rejects.toThrow(
      'Missing required environment variables for localization'
    );
  });
  it('should throw an error if only fallbackLanguage is missing', async () => {
    process.env.NEXT_PUBLIC_MAIN_LANGUAGE = 'uk';
    delete process.env.NEXT_PUBLIC_FALLBACK_LANGUAGE;

    await expect(import('../../config/i18nConfig.js')).rejects.toThrow(
      'Missing required environment variables for localization'
    );
  });

  it('should initialize i18n without errors', () => {
    expect(() => {
      i18n.init(i18nConfig);
    }).not.toThrow();
  });

  it('should have the correct fallback language', () => {
    expect(i18nConfig.fallbackLng).toBeDefined();
    expect(i18nConfig.fallbackLng).toContain('en');
  });
  it('should throw an error if localization resources fail to load', async () => {
    jest.doMock('../../../pages/i18n/localization.json', () => {
      throw new Error('Mocked file not found');
    });

    await expect(import('../../config/i18nConfig.js')).rejects.toThrow(
      'Failed to load localization resources: Mocked file not found'
    );
  });
  it('should throw an error if localization resources fail to load', async () => {
    jest.spyOn(require, 'resolve').mockImplementation(() => {
      throw new Error('Mocked file not found');
    });

    await expect(import('../../config/i18nConfig.js')).rejects.toThrow(
      'Failed to load localization resources: Mocked file not found'
    );

    jest.restoreAllMocks();
  });
});
