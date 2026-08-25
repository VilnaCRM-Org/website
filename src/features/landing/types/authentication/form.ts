export interface RegisterItem {
  FullName: string;
  Email: string;
  Password: string;
  // Client-side typo guard only — never part of the signup mutation input.
  ConfirmPassword: string;
  Privacy: boolean;
}
