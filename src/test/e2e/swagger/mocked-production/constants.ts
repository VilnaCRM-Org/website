interface MockUser {
  id: number;
  name: string;
}

interface UsersResponse {
  page: number;
  itemsPerPage: number;
  data: MockUser[];
}

interface ErrorResponse {
  type: string;
  title: string;
  detail: string;
  status: number;
}

export const mockUsersSuccess: UsersResponse = {
  page: 2,
  itemsPerPage: 10,
  data: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ],
};

export const mockUsersError: ErrorResponse = {
  type: '/errors/500',
  title: 'An error occurred',
  detail: 'Internal server error',
  status: 500,
};
