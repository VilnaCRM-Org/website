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

export const successResponse: (route: Route, status: number) => void = async (
  route: Route,
  status
): Promise<void> => {
  const request: Request = route.request();
  let postData: GraphQLRequestPayload;
  try {
    postData = await request.postDataJSON();
  } catch (error) {
    await route.continue();
    return;
  }

  if (postData && postData.query && postData.query.includes('mutation AddUser')) {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status,
        data: {
          createUser: {
            user: {
              id: '12345',
              email: postData.variables?.input?.email || 'default@example.com',
              initials: postData.variables?.input?.initials || 'Default User',
              confirmed: true,
              __typename: 'User',
            },
            clientMutationId: postData.variables.input.clientMutationId || 'default-client-id',
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
) => void = async (route: Route, { status, message, code }) => {
  const request: Request = route.request();
  const postData: GraphQLErrorRequestPayload = await request.postDataJSON();

  if (postData?.query?.includes('mutation AddUser')) {
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
