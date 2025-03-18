import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { render,  waitFor } from '@testing-library/react';
import userEvent, {UserEvent} from '@testing-library/user-event';
import {t} from 'i18next';
import React from 'react';
import {useForm} from 'react-hook-form';

import SIGNUP_MUTATION from '../../features/landing/api/service/userService';
import AuthForm from '../../features/landing/components/AuthSection/AuthForm/AuthForm';
import { RegisterItem } from '../../features/landing/types/authentication/form';

import { testInitials, testEmail, testPassword } from './constants';
import {
  checkElementsInDocument,
  fillForm,
  getFormElements,
  mockInternalServerErrorResponse
} from './utils';


const fulfilledMockResponse: MockedResponse = {
  request: {
    query: SIGNUP_MUTATION,
  },
  variableMatcher: () => true,
  result: variables => {
    const { input } = variables;
    const { initials, email, password, clientMutationId } = input;

    expect(input).not.toBeUndefined();
    expect(initials).toBe(testInitials);
    expect(email).toBe(testEmail);
    expect(password).toBe(testPassword);
    expect(clientMutationId).toBe('132');

    return {
      data: {
        createUser: {
          user: {
            email,
            initials,
            id: 0,
            confirmed: true,
          },
          clientMutationId: '132',
        },
      },
    };
  },
};

const formTitleText: string = t('sign_up.form.heading_main');

const nameInputText: string = t('sign_up.form.name_input.label');
const emailInputText: string = t('sign_up.form.email_input.label');
const passwordInputText: string = t('sign_up.form.password_input.label');

const requiredText: string = t('sign_up.form.email_input.required');
const passwordTipAltText: string = t('sign_up.form.password_tip.alt');

const statusRole: string = 'status';
const alertRole: string = 'alert';

const authFormSelector: string = '.MuiBox-root';


interface AuthFormWrapperProps {
  onSubmit: (data: RegisterItem) => Promise<void>;
  errorDetails: string;
}

function AuthFormWrapper({errorDetails,onSubmit }:AuthFormWrapperProps): React.ReactElement{
  const { handleSubmit, control,  formState: { errors }} = useForm<RegisterItem>({
    mode: 'onTouched',
    defaultValues: { Email: '', FullName: '', Password: '', Privacy: false },
  });
  return (
    <AuthForm
      errorDetails={errorDetails}
      onSubmit={onSubmit}
      handleSubmit={handleSubmit}
      errors={errors}
      control={control}
    />
  );
};
describe('AuthForm', () => {
  it('renders AuthForm component', () => {
    const onSubmit: jest.Mock<Promise<void>, [RegisterItem]> =jest.fn();
    const { container, queryByRole, getByAltText, getByText, getByTestId } =
      render(
        <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
          <AuthFormWrapper errorDetails="" onSubmit={onSubmit} />
        </MockedProvider>
      );

    const authForm: HTMLElement = container.querySelector(authFormSelector) as HTMLElement;
    const formTitle: HTMLElement = getByText(formTitleText);
    const nameInputLabel: HTMLElement = getByText(nameInputText);
    const emailInputLabel: HTMLElement = getByText(emailInputText);
    const passwordInputLabel: HTMLElement = getByText(passwordInputText);
    const passwordTipImage: HTMLElement = getByAltText(passwordTipAltText);

    const serverErrorMessage: HTMLElement | null = queryByRole(alertRole);
    const loader: HTMLElement | null = queryByRole(statusRole);

    checkElementsInDocument(
      authForm,
      formTitle,
      nameInputLabel,
      emailInputLabel,
      passwordInputLabel,
      passwordTipImage
    );

    expect(getByTestId('auth-form')).toBeVisible();
    expect(loader).not.toBeInTheDocument();
    expect(serverErrorMessage).not.toBeInTheDocument();
  });
  it('renders input fields', () => {
    const onSubmit: jest.Mock<Promise<void>, [RegisterItem]> =jest.fn();
    render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthFormWrapper errorDetails="" onSubmit={onSubmit} />
      </MockedProvider>
    );

    const { fullNameInput, emailInput, passwordInput } = getFormElements();

    checkElementsInDocument(fullNameInput, emailInput, passwordInput);
  });
  it('correct linkage between inputs and values', async () => {
    const onSubmit: jest.Mock<Promise<void>, [RegisterItem]> =jest.fn();
    render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthFormWrapper errorDetails="" onSubmit={onSubmit} />
      </MockedProvider>
    );

    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = fillForm(
      testInitials,
      testEmail,
      testPassword,
      true
    );

    await waitFor(() => {
      expect(emailInput.value).toBe(testEmail);
      expect(passwordInput.value).toBe(testPassword);
      expect(fullNameInput.value).toBe(testInitials);
      expect(privacyCheckbox).toBeChecked();
    });
  });

  it('displays "required" validation message when the input fields are left empty', async () => {
    const onSubmit: jest.Mock<Promise<void>, [RegisterItem]> = jest.fn();
       const {queryByRole, getAllByText}= render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthFormWrapper errorDetails="" onSubmit={onSubmit} />
      </MockedProvider>
    );

    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = fillForm();

    await waitFor(() => {
      const serverErrorMessage: HTMLElement | null = queryByRole(alertRole);

      expect(fullNameInput.value).toBe('');
      expect(emailInput.value).toBe('');
      expect(passwordInput.value).toBe('');
      expect(privacyCheckbox).not.toBeChecked();


      const requiredError:HTMLElement[]= getAllByText(requiredText);
      expect(requiredError[0]).toBeInTheDocument();
      expect(requiredError.length).toBe(3);
      expect(serverErrorMessage).not.toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
  it('should have default values', () => {
    const onSubmit: jest.Mock<Promise<void>, [RegisterItem]> = jest.fn();
    render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthFormWrapper errorDetails="" onSubmit={onSubmit} />
      </MockedProvider>
    );

    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = getFormElements();

    expect(fullNameInput).toHaveValue('');
    expect(emailInput).toHaveValue('');
    expect(passwordInput).toHaveValue('');
    expect(privacyCheckbox).not.toBeChecked();
  });
  it('onSubmit have been called after registration', async () => {
    const onSubmit: jest.Mock<Promise<void>, [RegisterItem]> = jest.fn().mockResolvedValueOnce(undefined);
    const {queryByRole} = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthFormWrapper errorDetails="" onSubmit={onSubmit} />
      </MockedProvider>
    );
    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    expect(queryByRole('alert')).not.toBeInTheDocument();
  });
  it('should show error alert', ()=>{
    const onSubmit: jest.Mock<Promise<void>, [RegisterItem]> = jest.fn().mockResolvedValueOnce(undefined);
    const {queryByRole} = render(
      <MockedProvider mocks={[mockInternalServerErrorResponse]} addTypename={false}>
        <AuthFormWrapper errorDetails="Internal Server Error." onSubmit={onSubmit} />
      </MockedProvider>
    );
    fillForm(testInitials, testEmail, testPassword, true);

    const alert: HTMLElement | null =queryByRole('alert');

    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Internal Server Error');
  });
  it('check onTouched mode', async () => {
    const user: UserEvent = userEvent.setup();
    const onSubmit: jest.Mock<Promise<void>, [RegisterItem]> = jest.fn().mockResolvedValueOnce(undefined);
    const {getByText} = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthFormWrapper errorDetails="Internal Server Error." onSubmit={onSubmit} />
      </MockedProvider>
    );

    const { fullNameInput, emailInput } = getFormElements();

    await user.click(fullNameInput);
    await user.click(emailInput);

    await waitFor(() => {
      const requiredError: HTMLElement = getByText(requiredText);
      expect(requiredError).toBeInTheDocument();
    });
  });
  it('should render privacy policy links with the correct URLs', ()=>{
    const onSubmit: jest.Mock<Promise<void>, [RegisterItem]> = jest.fn().mockResolvedValueOnce(undefined);
    const {getAllByRole} = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthFormWrapper errorDetails="Internal Server Error." onSubmit={onSubmit} />
      </MockedProvider>
    );

    const privacyPolicyLink: HTMLElement[] = getAllByRole('link');
    expect(privacyPolicyLink[0]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');
    expect(privacyPolicyLink[1]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');
  });

});
