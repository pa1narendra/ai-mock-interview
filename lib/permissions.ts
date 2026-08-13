import "server-only";

// Two-tier model. A user is Pro when they've earned it (a referral converted)
// or an admin flipped their isPro override; everyone else is Normal. The owner
// (OWNER_EMAIL) is a superset of Pro for testing/administration. Pro is earned,
// never bought.
export interface Permissions {
  isPro: boolean; // for the PRO badge
  canPreviewQuestions: boolean; // see the generated questions before taking it
  canEditQuestions: boolean; // edit them (owner-only)
  canChooseVoice: boolean; // pick the interviewer voice (else a fixed default)
  canCustomizeCommunity: boolean; // tweak a community template when personalizing
  maxAttempts: number; // attempts per interview
  maxInterviews: number; // interviews a user may own
}

const NORMAL: Permissions = {
  isPro: false,
  canPreviewQuestions: false,
  canEditQuestions: false,
  canChooseVoice: false,
  canCustomizeCommunity: false,
  maxAttempts: 3,
  maxInterviews: 5,
};

const PRO: Permissions = {
  isPro: true,
  canPreviewQuestions: true,
  canEditQuestions: false,
  canChooseVoice: true,
  canCustomizeCommunity: true,
  maxAttempts: 5,
  maxInterviews: 20,
};

const OWNER: Permissions = {
  isPro: true,
  canPreviewQuestions: true,
  canEditQuestions: true,
  canChooseVoice: true,
  canCustomizeCommunity: true,
  maxAttempts: 99,
  maxInterviews: 999,
};

export function isOwner(email: string | null | undefined): boolean {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return !!owner && !!email && email.trim().toLowerCase() === owner;
}

export function getPermissions(
  user: { email: string; isPro?: boolean } | null | undefined
): Permissions {
  if (!user) return NORMAL;
  if (isOwner(user.email)) return OWNER;
  return user.isPro ? PRO : NORMAL;
}
