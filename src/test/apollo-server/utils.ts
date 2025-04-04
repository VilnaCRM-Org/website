import { CreateUserInput, CreateUserResponse, OptionalPhoneInput } from './types';

export async function handleResponse<T extends { errors?: { message: string }[] }>(
  response: Response
): Promise<{ result: T; errors?: { message: string }[] }> {
  const result: T = await response.json();
  return { result, errors: result.errors };
}

export async function createUser(
  url: string,
  input: CreateUserInput | OptionalPhoneInput
): Promise<{
  result: CreateUserResponse;
  response: Response;
  errors?: CreateUserResponse['errors'];
}> {
  const mutation: string = `
    mutation CreateUser($input: CreateUserInput!) {
      createUser(input: $input) {
        user {
          id
          email
          initials
          confirmed
        }
        clientMutationId
      }
    }
  `;

  const response: Response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: mutation,
      variables: { input },
    }),
  });

  const result: CreateUserResponse = await response.json();

  return {
    result,
    response,
    errors: result.errors,
  };
}
