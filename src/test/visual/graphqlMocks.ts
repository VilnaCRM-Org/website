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

export const successResponse: (route: Route) => void = async (route: Route): Promise<void> => {
  const request: Request = route.request();
  const postData: GraphQLRequestPayload = await request.postDataJSON();

  if (postData?.query?.includes('mutation AddUser')) {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          createUser: {
            user: {
              id: '12345',
              email: postData.variables.input.email,
              initials: postData.variables.input.initials,
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

export const errorResponse: (route: Route) => void = async (route: Route) => {
  const request: Request = route.request();
  const postData: GraphQLErrorRequestPayload = await request.postDataJSON();

  if (postData?.query?.includes('mutation AddUser')) {
    await route.fulfill({
      contentType: 'application/json',
      status: 500,
      body: JSON.stringify({
        errors: [
          {
            message: 'Internal Server Error',
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          },
        ],
      }),
    });
  } else {
    await route.continue();
  }
};
