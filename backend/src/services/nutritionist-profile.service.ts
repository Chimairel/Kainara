import prisma from '@/lib/prisma';

export class NutritionistProfileService {
  static async getProfile(userId: string) {
    return prisma.nutritionistProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        prcLicenseNumber: true,
        prcLicenseExpiry: true,
        specialization: true,
        acceptingReviews: true,
        verifiedExpertise: true,
        verifiedExperienceYears: true,
        expertiseEvidence: true,
        expertiseVerifiedAt: true,
        yearsOfExperience: true,
        university: true,
        bio: true,
        officialHeadshot: true,
        isVerified: true,
        totalVerified: true,
        verifiedAt: true,
      },
    });
  }

  /**
   * Updates the nutritionist's profile.
   */
  static async updateProfile(userId: string, data: { bio?: string; specialization?: string }) {
    return prisma.nutritionistProfile.update({
      where: { userId },
      data: { bio: data.bio, specialization: data.specialization },
      select: {
        id: true,
        prcLicenseNumber: true,
        prcLicenseExpiry: true,
        specialization: true,
        acceptingReviews: true,
        verifiedExpertise: true,
        verifiedExperienceYears: true,
        expertiseEvidence: true,
        expertiseVerifiedAt: true,
        yearsOfExperience: true,
        university: true,
        bio: true,
        officialHeadshot: true,
        isVerified: true,
        totalVerified: true,
        verifiedAt: true,
      },
    });
  }
}
