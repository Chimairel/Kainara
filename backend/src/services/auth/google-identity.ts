export type GoogleAuthIntent = 'LOGIN' | 'REGISTER' | 'CONTINUE';
export type VerifiedGoogleIdentity = {
  email: string;
  sub: string;
  emailAuthoritative?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
};
export class GoogleAuthFlowError extends Error {
  constructor(
    public readonly code: 'ACCOUNT_NOT_FOUND' | 'ACCOUNT_EXISTS' | 'GOOGLE_IDENTITY_MISMATCH' | 'GOOGLE_LINK_REQUIRED',
    public readonly status: 404 | 409,
    message: string
  ) {
    super(message);
    this.name = 'GoogleAuthFlowError';
  }
}
