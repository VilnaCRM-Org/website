import { t } from 'i18next';

const MAX_INITIALS_LENGTH: number = 255;

type ValidationMessageKey = 'formatError' | 'lettersOnlyError' | 'required';

export const validationMessages: Record<ValidationMessageKey, string> = {
  formatError: t('sign_up.form.name_input.full_name_format_error'),
  lettersOnlyError: t('sign_up.form.name_input.special_characters_error'),
  required: t('sign_up.form.name_input.required'),
};

type ValidationFunction = (value: string) => boolean;
type ValidationKeys = 'isLettersOnly' | 'isFormatted' | 'isEmpty';

export const validators: Record<ValidationKeys, ValidationFunction> = {
  isLettersOnly: value => /^[A-Za-zА-Яа-яІіЇїЄєҐґ\s'’-]+$/.test(value),
  isFormatted: value =>
    /^[A-Za-zА-Яа-яІіЇїЄєҐґ]+\s[A-Za-zА-Яа-яІіЇїЄєҐґ]+$/.test(value) &&
    value.length >= 2 &&
    value.length <= MAX_INITIALS_LENGTH,
  isEmpty: value => value.trim().length === 0,
};

type FullNameRule = { isInvalid: (value: string) => boolean; message: string };

const FULL_NAME_RULES: readonly FullNameRule[] = [
  { isInvalid: value => validators.isEmpty(value), message: validationMessages.required },
  { isInvalid: value => !validators.isLettersOnly(value), message: validationMessages.lettersOnlyError },
  { isInvalid: value => !validators.isFormatted(value), message: validationMessages.formatError },
];

const validateFullName: (fullName: string) => string | null = (
  fullName: string
): string | null => {
  const trimmedFullName: string = fullName.trim();
  const failedRule: FullNameRule | undefined = FULL_NAME_RULES.find(rule =>
    rule.isInvalid(trimmedFullName)
  );
  return failedRule ? failedRule.message : null;
};

export default validateFullName;
