import i18n from 'i18next';

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
  });

  it('should return correct Ukrainian translation', () => {
    i18n.changeLanguage('uk');

    expect(i18n.t(contactsKey)).toBe(contactsUkrainianText);
    expect(i18n.t(advantagesKey)).toBe(advantagesUkrainianText);
    expect(i18n.t(forWhoKey)).toBe(forWhoUkrainianText);
  });

  it('should return key if translation is missing', () => {
    expect(i18n.t(nonExistingKey)).toBe(nonExistingKey);
  });
});
