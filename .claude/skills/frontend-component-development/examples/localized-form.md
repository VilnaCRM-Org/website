# Localized Form

Forms use `react-hook-form` for state and `react-i18next` for labels and errors.
Fields go through a `Controller` (the shared `ui-text-field-form` primitive wraps
one around `UiInput` and renders the error itself), and validation lives in small
colocated helpers.

## Validator returns a translation key

Each validator returns `true` when valid or a translation-keyed message when not.
Module-scope `t` from `i18next` is safe here because init is synchronous.

```ts
import { t } from 'i18next';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): string | boolean {
  if (!EMAIL_PATTERN.test(email)) {
    return t('contact.email.invalid');
  }
  return true;
}

export default validateEmail;
```

## Wire it into the form

`useForm` owns state; pass the validator as `rules.validate` and keep `required`
and `placeholder` as translation keys. `mode: 'onTouched'` matches the repo's
existing forms.

```tsx
import { Box } from '@mui/material';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { UiButton, UiTextFieldForm } from '@/components';

import validateEmail from './validations/email';

interface ContactFormValues {
  Email: string;
}

function ContactForm(): React.ReactElement {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<ContactFormValues>({
    mode: 'onTouched',
    defaultValues: { Email: '' },
  });

  const onSubmit = (values: ContactFormValues): void => {
    // forward values to the feature api/ layer (an Apollo mutation)
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} aria-label="ContactForm">
      <UiTextFieldForm
        id="Email"
        name="Email"
        type="email"
        control={control}
        rules={{ required: t('contact.email.required'), validate: validateEmail }}
        placeholder={t('contact.email.placeholder')}
      />
      <UiButton variant="contained" type="submit">
        {t('contact.submit')}
      </UiButton>
    </Box>
  );
}

export default ContactForm;
```

For a real feature, split this: a container/layout component owns `useForm` plus
the Apollo mutation and passes `control` and `handleSubmit` to a presentational
form (see `AuthSection/AuthForm/AuthLayout.tsx` → `AuthForm.tsx`). Validation
messages must map to translation keys, never hardcoded strings.
