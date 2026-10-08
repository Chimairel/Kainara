import { describe, expect, it } from 'vitest';
import { applicantCredentialSchema, applicantIdentitySchema, issuesToFields } from './nutritionist-application.schemas';

describe('RND application schema validation', () => {
  describe('applicantIdentitySchema', () => {
    it('requires a recent uploaded photo and attestation', () => {
      const result = applicantIdentitySchema.safeParse({
        fullName: 'Maria Santos',
        email: 'maria.santos@rnd.ph',
        phoneNumber: '+63 917 123 4567',
        officialHeadshot: '',
        photoRecentAttested: false,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(issuesToFields(result.error).officialHeadshot).toMatch(/Upload a recent photo/i);
        expect(issuesToFields(result.error).photoRecentAttested).toMatch(/past 30 days/i);
      }
    });

    it('passes when a photo and recency attestation are present', () => {
      const result = applicantIdentitySchema.safeParse({
        fullName: 'Maria Santos',
        email: 'maria.santos@rnd.ph',
        phoneNumber: '+63 917 123 4567',
        officialHeadshot: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD=',
        photoRecentAttested: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('applicantCredentialSchema', () => {
    it('accepts valid professional credentials without a signature', () => {
      const result = applicantCredentialSchema.safeParse({
        prcLicenseNumber: '0098765',
        prcLicenseExpiry: '2029-12-31',
        specialization: 'Clinical Renal Nutrition',
      });

      expect(result.success).toBe(true);
    });

    it('does not require biometric signature data', () => {
      const result = applicantCredentialSchema.safeParse({
        prcLicenseNumber: '0098765',
        prcLicenseExpiry: '2029-12-31',
        specialization: 'Clinical Renal Nutrition',
      });

      expect(result.success).toBe(true);
    });
  });
});
