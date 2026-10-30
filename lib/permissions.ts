import "server-only";

// Two-tier model. A user is Pro when they've earned it (a referral converted)
// or an admin flipped their isPro override; everyone else is Normal. The owner
// (OWNER_EMAIL) is a superset of Pro for testing/administration. Demo accounts
// (DEMO_EMAILS) are Pro with no usage caps, for live pitches - but no admin.
// Pro is earned, never bought.
export interface Permissions {
  isPro: boolean; // for the PRO badge
  canPreviewQuestions: boolean; // see the generated questions before taking it
  canEditQuestions: boolean; // edit them (owner-only)
  canChooseVoice: boolean; // pick the interviewer voice (else a fixed default)
  canCustomizeCommunity: boolean; // tweak a community template when personalizing
  maxAttempts: number; // attempts per interview
  maxInterviews: number; // interviews a user may own
  unlimitedUsage: boolean; // skip the hourly/daily rate limits (owner + demo)
}

const NORMAL: Permissions = {
  isPro: false,
  canPreviewQuestions: false,
  canEditQuestions: false,
  canChooseVoice: false,
  canCustomizeCommunity: false,
  maxAttempts: 3,
  maxInterviews: 5,
  unlimitedUsage: false,
};

const PRO: Permissions = {
  isPro: true,
  canPreviewQuestions: true,
  canEditQuestions: false,
  canChooseVoice: true,
  canCustomizeCommunity: true,
  maxAttempts: 5,
  maxInterviews: 20,
  unlimitedUsage: false,
};

const OWNER: Permissions = {
  isPro: true,
  canPreviewQuestions: true,
  canEditQuestions: true,
  canChooseVoice: true,
  canCustomizeCommunity: true,
  maxAttempts: 99,
  maxInterviews: 999,
  unlimitedUsage: true,
};

const DEMO: Permissions = { ...OWNER, canEditQuestions: false };

// The single Pro rule: an admin grant or a converted referral, unless an
// admin has explicitly turned Pro off for this user.
export function effectivePro(row: {
  isPro: boolean;
  referralCount: number | null;
  proRevoked: boolean;
}): boolean {
  if (row.proRevoked) return false;
  return row.isPro || (row.referralCount ?? 0) >= 1;
}

export function isOwner(email: string | null | undefined): boolean {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return !!owner && !!email && email.trim().toLowerCase() === owner;
}

// Comma-separated list, e.g. DEMO_EMAILS=demo@example.com,demo2@example.com
export function isDemo(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.DEMO_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

export function getPermissions(
  user: { email: string; isPro?: boolean } | null | undefined
): Permissions {
  if (!user) return NORMAL;
  if (isOwner(user.email)) return OWNER;
  if (isDemo(user.email)) return DEMO;
  return user.isPro ? PRO : NORMAL;
}
