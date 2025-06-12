import { Route, Request } from '@playwright/test';

export type GraphQLRequestPayload = {
  query: string;
  operationName?: string;
  variables: {
    input: {
      initials?: string;
      email?: string;
      password?: string;
      clientMutationId?: string;
    };
  };
};

export const successResponse: (route: Route, status: number) => Promise<void> = async (
  route: Route,
  status: number
): Promise<void> => {
  const request: Request = route.request();
  let postData: GraphQLRequestPayload;
  try {
    postData = await request.postDataJSON();
  } catch {       
    await route.continue();
    return;
  }

  if (postData?.query?.includes('mutation AddUser')) {
    await route.fulfill({
      contentType: 'application/json',
      status,
      body: JSON.stringify({
        data: {
          createUser: {
            user: {
              id: '12345',
              email: postData.variables?.input?.email || 'default@example.com',
              initials: postData.variables?.input?.initials || 'Default User',
              confirmed: true,
              __typename: 'User',
            },
            clientMutationId: postData.variables?.input?.clientMutationId || 'default-client-id',
          },
        },
      }),
    });
  } else {
    await route.continue();
  }
};

interface GraphQLErrorRequestPayload {
  operationName?: string;
  variables?: Record<string, unknown>;
  query?: string;
}
export interface ErrorResponseProps {
  status: number;
  message: string;
  code: string;
}

export const errorResponse: (
  route: Route,
  { status, message, code }: ErrorResponseProps
) => Promise<void> = async (route: Route, { status, message, code }): Promise<void> => {
  const request: Request = route.request();
  let postData: GraphQLErrorRequestPayload;
  try {
    postData = await request.postDataJSON();
  } catch {    
    await route.continue();
    return;
  }

  const operationToMatch: string = 'mutation AddUser';
  if (postData?.query?.includes(operationToMatch)) {
    await route.fulfill({
      contentType: 'application/json',
      status,
      body: JSON.stringify({
        errors: [
          {
            message,
            extensions: { code },
          },
        ],
      }),
    });
  } else {
    await route.continue();
  }
};
