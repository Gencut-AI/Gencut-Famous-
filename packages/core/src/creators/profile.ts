/**
 * The creator's brand profile. Only the public name and handle are required:
 * a creator can start using GenCut at once and fill the rest in over time.
 * Completeness is shown section by section, never as a gate.
 */
export const NICHES = [
  'beauty', 'business', 'comedy', 'education', 'entertainment', 'family', 'fashion', 'finance', 'fitness', 'food',
  'gaming', 'health', 'home', 'lifestyle', 'music', 'outdoors', 'pets', 'photography', 'real_estate', 'sports',
  'tech', 'travel', 'wellness', 'other',
] as const;
export type Niche = (typeof NICHES)[number];

export const NICHE_LABELS: Readonly<Record<Niche, string>> = {
  beauty: 'Beauty', business: 'Business', comedy: 'Comedy', education: 'Education', entertainment: 'Entertainment',
  family: 'Family & parenting', fashion: 'Fashion', finance: 'Finance', fitness: 'Fitness', food: 'Food & drink',
  gaming: 'Gaming', health: 'Health', home: 'Home & design', lifestyle: 'Lifestyle', music: 'Music',
  outdoors: 'Outdoors', pets: 'Pets', photography: 'Photography', real_estate: 'Real estate', sports: 'Sports',
  tech: 'Tech', travel: 'Travel', wellness: 'Wellness', other: 'Other',
};

export const TONES = ['warm', 'playful', 'bold', 'expert', 'calm', 'luxurious', 'raw'] as const;
export type Tone = (typeof TONES)[number];

export const PARTNERSHIP_KINDS = ['sponsored_posts', 'ambassadorships', 'affiliate', 'events', 'product_seeding', 'licensing'] as const;
export type PartnershipKind = (typeof PARTNERSHIP_KINDS)[number];

export interface RateCardItem {
  readonly deliverable: string;
  /** Whole US dollars; the creator's own asking price, never shown publicly. */
  readonly priceUsd: number;
}

export interface CreatorProfile {
  readonly workspaceId: string;
  readonly publicName: string;
  readonly handle: string;
  readonly legalName: string | null;
  readonly bio: string | null;
  readonly niches: readonly Niche[];
  readonly targetAudience: string | null;
  readonly audienceNotes: string | null;
  readonly brandMessage: string | null;
  readonly values: readonly string[];
  readonly tone: Tone | null;
  readonly toneNotes: string | null;
  readonly colors: readonly string[];
  readonly fonts: readonly string[];
  readonly goals: string | null;
  readonly growthTarget: string | null;
  readonly partnershipKinds: readonly PartnershipKind[];
  readonly brandsWanted: readonly string[];
  readonly brandsAvoided: readonly string[];
  readonly rateCard: readonly RateCardItem[];
  readonly hasLogo: boolean;
  readonly hasPhoto: boolean;
  readonly contentExamples: number;
  readonly updatedAt: Date;
}

export const PROFILE_SECTIONS = ['identity', 'audience', 'voice', 'visual', 'goals', 'partnerships'] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export const SECTION_LABELS: Readonly<Record<ProfileSection, string>> = {
  identity: 'Identity',
  audience: 'Audience',
  voice: 'Voice and values',
  visual: 'Visual identity',
  goals: 'Goals',
  partnerships: 'Partnerships',
};

/** Which sections have their essentials filled in. */
export function sectionStatus(p: CreatorProfile): Readonly<Record<ProfileSection, boolean>> {
  return {
    identity: Boolean(p.bio) && p.niches.length > 0,
    audience: Boolean(p.targetAudience),
    voice: Boolean(p.brandMessage) && (p.tone !== null || p.values.length > 0),
    visual: p.hasPhoto && (p.hasLogo || p.colors.length > 0),
    goals: Boolean(p.goals),
    partnerships: p.partnershipKinds.length > 0 || p.brandsWanted.length > 0 || p.rateCard.length > 0,
  };
}

/** Hex colors only (#rgb or #rrggbb), stored lowercase. */
export function normalizeColor(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(v) ? v : null;
}

/** Split a comma- or newline-separated list, trimmed, de-duplicated (case-insensitive), capped. */
export function splitList(raw: string, max: number, maxLength = 60): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const v = part.trim().slice(0, maxLength);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}
