export interface CreateUserInput {
  email: string;
  initials: string;
  clientMutationId: string;
}
export interface User {
  id: string;
  confirmed: boolean;
  email: string;
  initials: string;
}
