import {Locator} from '@playwright/test';

import {fillInput} from '@/test/e2e/utils/fillInput';

import {userData} from '../register-form/constants';

import {checkCheckbox} from './checkCheckbox';


interface FillFormProps {
  initialsInput: Locator;
  emailInput:Locator;
  passwordInput:Locator;
  policyTextCheckbox:Locator;
}
type FillFormFunction  = (params: FillFormProps) => Promise<void>;

const  fillForm: FillFormFunction= async ({initialsInput, emailInput,  passwordInput,policyTextCheckbox}: FillFormProps): Promise<void> => {
  await fillInput(initialsInput, userData.fullName);
  await fillInput(emailInput, userData.email);
  await fillInput(passwordInput, userData.password);
  await checkCheckbox(policyTextCheckbox);
};

export default fillForm;
