/** Input type for creating a new user. */
export interface CreateUserInput {
  email: string;
  initials: string;
  clientMutationId: string;
}

/** Represents a user in the system. */
export interface User {
  id: string;
  confirmed: boolean;
  email: string;
  initials: string;
}
