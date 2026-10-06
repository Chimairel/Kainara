import { register } from './auth/registration';
import { verifyGoogleIdentity, completeGoogleAuth } from './auth/google-auth';
import { verifyEmail, resendVerification } from './auth/email-verification';
import { login, forgotPassword, resetPassword } from './auth/password-auth';
import { refreshToken, logout, logoutWithRefreshToken } from './auth/sessions';
export { GoogleAuthFlowError, type GoogleAuthIntent, type VerifiedGoogleIdentity } from './auth/google-identity';
/** Stable authentication API; workflows own their implementation and transaction boundaries. */
export class AuthService {
  static register = register;
  static verifyGoogleIdentity = verifyGoogleIdentity;
  static completeGoogleAuth = completeGoogleAuth;
  static verifyEmail = verifyEmail;
  static resendVerification = resendVerification;
  static login = login;
  static forgotPassword = forgotPassword;
  static resetPassword = resetPassword;
  static refreshToken = refreshToken;
  static logout = logout;
  static logoutWithRefreshToken = logoutWithRefreshToken;

  /**
   * Authenticates an existing Google user. This endpoint never provisions a
   * missing KAINARA account; account creation is an explicit registration act.
   */
  static async googleLogin(idToken: string) {
    const payload = await this.verifyGoogleIdentity(idToken);
    return this.completeGoogleAuth(payload, 'LOGIN');
  }

  /**
   * Creates a new KAINARA account from a verified Google identity. Google has
   * already verified the email, so the new user can continue to onboarding.
   */
  static async googleRegister(idToken: string) {
    const payload = await this.verifyGoogleIdentity(idToken);
    return this.completeGoogleAuth(payload, 'REGISTER');
  }

  /** Sign in or create a regular account after verifying the Google credential. */
  static async googleContinue(idToken: string, beforeCreate?: () => Promise<void>) {
    const payload = await this.verifyGoogleIdentity(idToken);
    let creationAdmitted = false;
    const admitCreation = async () => {
      if (creationAdmitted) return;
      await beforeCreate?.();
      creationAdmitted = true;
    };
    try {
      return await this.completeGoogleAuth(payload, 'CONTINUE', admitCreation);
    } catch (error) {
      // A concurrent request may have created this user/link after our lookup.
      // Re-read once and apply all identity/access checks to the winning record.
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') throw error;
      return this.completeGoogleAuth(payload, 'CONTINUE', admitCreation);
    }
  }
}
export default AuthService;
