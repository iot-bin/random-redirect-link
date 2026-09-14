export class AuthError extends Error {
  constructor(public code: string, public status = 401) { super(code); }
}
