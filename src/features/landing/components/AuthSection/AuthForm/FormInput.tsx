import React from 'react';
import { RegisterOptions, FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { UiTextFieldForm, UiTypography } from '@/components';

import { AuthFormProps } from './types';

interface FormInputProps {
  inputTitle: React.CSSProperties;
  control: AuthFormProps['control'];
  id: string;
  name: 'FullName' | 'Email' | 'Password' | 'Privacy';
  rules: RegisterOptions<FieldValues, string> | null;
  placeholder: string;
  type: string;
  htmlFor: string;
  component?:
    | 'a'
    | 'div'
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'label'
    | 'p'
    | 'section'
    | 'span';
}

function FormInput({
  inputTitle,
  control,
  id,
  name,
  rules,
  placeholder,
  type,
  htmlFor,
  component,
}: FormInputProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div>
      <UiTypography variant="medium14" sx={inputTitle} component={component} htmlFor={htmlFor}>
        {t('sign_up.form.name_input.label')}
      </UiTypography>
      <UiTextFieldForm
        id={id}
        control={control}
        name={name}
        rules={rules ?? {}}
        placeholder={placeholder}
        type={type}
      />
    </div>
  );
}
FormInput.defaultProps = {
  component: 'label',
};

export default FormInput;
