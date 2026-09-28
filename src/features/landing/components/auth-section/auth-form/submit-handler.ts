import { v4 as uuidv4 } from 'uuid';

import { reportHandledError } from '@/lib/telemetry/report-error';

import { SignUpInput } from '../../../api/service/types';
import { handleApolloError } from '../../../helpers/handleApolloError';
import { RegisterItem } from '../../../types/authentication/form';
import { NotificationStatus } from '../../notification/types';

import { SignupVariables } from './types';

export interface NotificationState {
  setNotificationType: (type: NotificationStatus) => void;
  setIsNotificationOpen: (isOpen: boolean) => void;
  setErrorText: (text: string) => void;
}

export type SignupMutate = (options: { variables: SignupVariables }) => Promise<unknown>;

function buildSignupInput(userData: RegisterItem, clientID: string): SignUpInput {
  return {
    email: userData.Email.toLowerCase(),
    initials: userData.FullName,
    password: userData.Password,
    clientMutationId: clientID,
  };
}

function onSignupSuccess(notif: NotificationState): void {
  notif.setIsNotificationOpen(true);
  notif.setNotificationType(NotificationStatus.SUCCESS);
}

function onSignupError(notif: NotificationState, error: unknown): void {
  reportHandledError(error, { feature: 'landing', action: 'signup' });
  notif.setErrorText(handleApolloError({ error }));
  notif.setNotificationType(NotificationStatus.ERROR);
  notif.setIsNotificationOpen(true);
}

function isAutomatedSubmission(userData: RegisterItem): boolean {
  return Boolean(userData.Referral);
}

function onHoneypotTripped(notif: NotificationState): void {
  reportHandledError(new Error('sign-up honeypot tripped'), {
    feature: 'landing',
    action: 'signup-honeypot',
  });
  onSignupSuccess(notif);
}

async function submitSignup(
  signupMutation: SignupMutate,
  notif: NotificationState,
  userData: RegisterItem
): Promise<void> {
  try {
    await signupMutation({ variables: { input: buildSignupInput(userData, uuidv4()) } });
    onSignupSuccess(notif);
  } catch (error) {
    onSignupError(notif, error);
  }
}

export function buildSubmitHandler(
  signupMutation: SignupMutate,
  notif: NotificationState
): (userData: RegisterItem) => Promise<void> {
  return async (userData: RegisterItem): Promise<void> => {
    if (isAutomatedSubmission(userData)) {
      onHoneypotTripped(notif);
      return;
    }
    await submitSignup(signupMutation, notif, userData);
  };
}
