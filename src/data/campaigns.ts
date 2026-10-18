export type CampaignCategory = 'Environment' | 'Education' | 'Community' | 'Human Rights';
export type IsoDate = `${number}-${number}-${number}`;

export type DiscoveryCampaign = {
  id: string;
  createdAt: IsoDate;
  fundingDeadline: IsoDate;
  country: string;
  title: string;
  cause: string;
  category: CampaignCategory;
  description: string;
  creator: string;
  /** Stable fictional identity for the demo creator; never an authenticated account. */
  creatorId: string;
  raised: number;
  goal: number;
  platform: 'Instagram' | 'Facebook';
  status: 'Ready for amplification' | 'In review' | 'Building support';
  estimatedReachAtGoal: number;
  keywords: string[];
  coverColor: string;
  coverSymbol: string;
};

// All campaigns and figures below are fictional examples for the app preview.
export const discoveryCampaigns: DiscoveryCampaign[] = [
  {
    id: 'creekside-native-plants',
    createdAt: '2026-10-02',
    fundingDeadline: '2026-11-07',
    country: 'Canada',
    title: 'Bring Creekside back to life',
    cause: 'Urban creek restoration',
    category: 'Environment',
    description: 'A volunteer group is organizing a native planting day and sharing simple ways nearby residents can care for the creek.',
    creator: 'Creekside Neighbors (fictional group)',
    creatorId: 'demo-creator-creekside',
    raised: 2675,
    goal: 5000,
    platform: 'Instagram',
    status: 'Ready for amplification',
    estimatedReachAtGoal: 60000,
    keywords: ['wildlife', 'nature', 'plants', 'restoration', 'local action'],
    coverColor: '#D9E0D2',
    coverSymbol: '⌁',
  },
  {
    id: 'open-books-after-school',
    createdAt: '2026-09-29',
    fundingDeadline: '2026-10-30',
    country: 'India',
    title: 'Open books after school',
    cause: 'Community reading access',
    category: 'Education',
    description: 'A fictional neighborhood reading circle wants more families to know about its free after-school book sessions.',
    creator: 'Pages Together (fictional collective)',
    creatorId: 'demo-creator-pages-together',
    raised: 1320,
    goal: 3200,
    platform: 'Facebook',
    status: 'Building support',
    estimatedReachAtGoal: 38400,
    keywords: ['books', 'reading', 'children', 'learning', 'literacy'],
    coverColor: '#E7D9C8',
    coverSymbol: '▤',
  },
  {
    id: 'neighbors-share-fresh-food',
    createdAt: '2026-10-12',
    fundingDeadline: '2026-11-15',
    country: 'Singapore',
    title: 'Neighbors share fresh food',
    cause: 'Local food access',
    category: 'Community',
    description: 'A sample community pantry is raising awareness of its weekly produce exchange and volunteer sign-up days.',
    creator: 'Eastside Pantry Project (fictional)',
    creatorId: 'demo-creator-eastside-pantry',
    raised: 1840,
    goal: 4000,
    platform: 'Instagram',
    status: 'Ready for amplification',
    estimatedReachAtGoal: 48000,
    keywords: ['mutual aid', 'food', 'pantry', 'neighbors', 'volunteers'],
    coverColor: '#E5D5C1',
    coverSymbol: '✳',
  },
  {
    id: 'know-your-rights-workshop',
    createdAt: '2026-09-15',
    fundingDeadline: '2026-10-10',
    country: 'South Africa',
    title: 'Know your rights, together',
    cause: 'Community rights education',
    category: 'Human Rights',
    description: 'A fictional volunteer team is sharing details for a free, plain-language community information workshop.',
    creator: 'Common Ground Helpers (fictional team)',
    creatorId: 'demo-creator-common-ground',
    raised: 740,
    goal: 2800,
    platform: 'Facebook',
    status: 'In review',
    estimatedReachAtGoal: 33600,
    keywords: ['rights', 'workshop', 'access', 'community information'],
    coverColor: '#E6D6D2',
    coverSymbol: '◎',
  },
  {
    id: 'stories-from-main-street',
    createdAt: '2026-10-08',
    fundingDeadline: '2026-12-01',
    country: 'New Zealand',
    title: 'Stories from Main Street',
    cause: 'Local arts and culture',
    category: 'Community',
    description: 'An independent fictional arts collective is preparing a short film about the people who make a neighborhood feel like home.',
    creator: 'Open Frame Studio (fictional collective)',
    creatorId: 'demo-creator-open-frame',
    raised: 920,
    goal: 3000,
    platform: 'Instagram',
    status: 'Building support',
    estimatedReachAtGoal: 36000,
    keywords: ['arts', 'film', 'culture', 'local stories', 'creators'],
    coverColor: '#DDD2C5',
    coverSymbol: '▣',
  },
];

export const discoveryCategories = [
  'All',
  'Environment',
  'Education',
  'Community',
  'Human Rights',
] as const;

export type DiscoveryFilter = (typeof discoveryCategories)[number];

export const sortOptions = [
  'Newest first',
  'Oldest first',
  'Deadline: soonest first',
  'Deadline: latest first',
] as const;

export type CampaignSort = (typeof sortOptions)[number];

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function getUtcToday(): IsoDate {
  return new Date().toISOString().slice(0, 10) as IsoDate;
}

export function isDeadlineExpired(deadline: IsoDate, today: IsoDate): boolean {
  return deadline < today;
}

export function getDeadlineDaysRemaining(deadline: IsoDate, today: IsoDate): number {
  return Math.ceil((Date.parse(`${deadline}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / millisecondsPerDay);
}

export function formatIsoDate(date: IsoDate): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00.000Z`));
}

export function getDeadlineLabel(deadline: IsoDate, today: IsoDate): string {
  if (isDeadlineExpired(deadline, today)) return 'Funding period ended';
  const days = getDeadlineDaysRemaining(deadline, today);
  if (days === 0) return 'Ends today';
  if (days === 1) return 'Ends tomorrow';
  return `Ends in ${days} days`;
}
