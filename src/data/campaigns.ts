import { Signal } from '@/constants/theme';

export type CampaignCategory =
  | 'Environment'
  | 'Education'
  | 'Public Health'
  | 'Civic Awareness'
  | 'Arts & Culture'
  | 'Health'
  | 'Science'
  | 'Public Policy'
  | 'Economic Policy'
  | 'Community'
  | 'Business'
  | 'Other';
export type DiscoveryCategory =
  | 'Environment'
  | 'Health'
  | 'Science'
  | 'Education'
  | 'Public Policy'
  | 'Economic Policy'
  | 'Community'
  | 'Arts & Culture'
  | 'Business'
  | 'Other';
export type IsoDate = `${number}-${number}-${number}`;

export type DiscoveryCampaign = {
  id: string;
  createdAt: IsoDate;
  fundingDeadline: IsoDate;
  country: string;
  /** Catalogue funding goals and raised figures are stored in whole Indian rupees. */
  currency: 'INR';
  title: string;
  cause: string;
  category: CampaignCategory;
  discoveryCategory: DiscoveryCategory;
  description: string;
  creator: string;
  /** Stable fictional identity for the demo creator; never an authenticated account. */
  creatorId: string;
  raised: number;
  goal: number;
  platform: 'Instagram, Facebook';
  status: 'Ready for amplification' | 'In review' | 'Building support' | 'completed';
  estimatedReachAtGoal?: number;
  keywords: string[];
  coverColor: string;
  coverSymbol: string;
  image: number | string;
  featuredOnHome?: boolean;
};

// All campaigns and figures below are fictional examples for the app preview.
export const discoveryCampaigns: DiscoveryCampaign[] = [
  {
    id: 'pages-for-all-library',
    createdAt: '2026-10-19',
    fundingDeadline: '2026-12-19',
    country: 'India',
    currency: 'INR',
    title: 'Every Child Deserves a Library',
    cause: 'Access to books and learning',
    category: 'Education',
    discoveryCategory: 'Education',
    description: 'Help close the learning gap in underserved communities and make access to books possible for every child.',
    creator: 'Pages for All Collective',
    creatorId: 'demo-creator-pages-for-all',
    raised: 1200,
    goal: 5000,
    platform: 'Instagram, Facebook',
    status: 'Building support',
    estimatedReachAtGoal: 60000,
    keywords: ['books', 'reading', 'children', 'learning', 'literacy'],
    coverColor: Signal.oliveLight,
    coverSymbol: '▤',
    image: require('../../assets/images/home/campaign-books.png'),
    featuredOnHome: true,
  },
  {
    id: 'green-bengaluru-lakes',
    createdAt: '2026-10-19',
    fundingDeadline: '2026-12-19',
    country: 'India',
    currency: 'INR',
    title: "Our Lakes Aren't Dumping Grounds",
    cause: 'Neighbourhood lake protection',
    category: 'Environment',
    discoveryCategory: 'Environment',
    description: "Raise awareness about lake pollution and inspire local communities to protect Bengaluru's lakes.",
    creator: 'Ananya Nair (Environmental Activist)',
    creatorId: 'ananya-nair',
    raised: 3100,
    goal: 8000,
    platform: 'Instagram, Facebook',
    status: 'Building support',
    estimatedReachAtGoal: 96000,
    keywords: ['lake', 'pollution', 'environment', 'Bengaluru'],
    coverColor: Signal.paperDeep,
    coverSymbol: '⌁',
    image: require('../../assets/images/stories/lakeshore-care.jpg'),
    featuredOnHome: true,
  },
  {
    id: 'neighbourhood-arts-collective',
    createdAt: '2026-10-19',
    fundingDeadline: '2026-12-19',
    country: 'India',
    currency: 'INR',
    title: 'Let Our Neighbourhood Tell Its Story',
    cause: 'Neighbourhood arts and culture',
    category: 'Arts & Culture',
    discoveryCategory: 'Arts & Culture',
    description: 'Bring local art and community stories into the spotlight through a neighbourhood mural initiative.',
    creator: 'Campus Creatives Club (Student-led Group)',
    creatorId: 'demo-creator-campus-creatives',
    raised: 1500,
    goal: 4500,
    platform: 'Instagram, Facebook',
    status: 'Building support',
    estimatedReachAtGoal: 54000,
    keywords: ['arts', 'culture', 'mural', 'public art', 'local stories'],
    coverColor: Signal.paper,
    coverSymbol: '▣',
    image: require('../../assets/images/stories/mural-in-progress.jpg'),
    featuredOnHome: true,
  },
  {
    id: 'better-streets-collective',
    createdAt: '2026-10-19',
    fundingDeadline: '2026-12-19',
    country: 'India',
    currency: 'INR',
    title: 'The Streets We Deserve',
    cause: 'Safer, more accessible streets',
    category: 'Civic Awareness',
    discoveryCategory: 'Public Policy',
    description: 'Highlight unsafe pavements, poor street lighting, and inaccessible public spaces through local stories.',
    creator: 'Rohan Menon (Community Journalist)',
    creatorId: 'rohan-menon',
    raised: 2500,
    goal: 7500,
    platform: 'Instagram, Facebook',
    status: 'Building support',
    estimatedReachAtGoal: 90000,
    keywords: ['streets', 'accessibility', 'lighting', 'community reporting'],
    coverColor: Signal.maroonLight,
    coverSymbol: '↗',
    image: require('../../assets/images/stories/tactile-paving.jpg'),
    featuredOnHome: true,
  },
  {
    id: 'community-health-connect',
    createdAt: '2026-10-19',
    fundingDeadline: '2026-12-19',
    country: 'India',
    currency: 'INR',
    title: 'Health Information Should Reach Everyone',
    cause: 'Preventive healthcare information',
    category: 'Public Health',
    discoveryCategory: 'Health',
    description: 'Help reliable preventive healthcare information reach more people through accessible public-health messaging.',
    creator: 'Community Health Connect',
    creatorId: 'demo-creator-community-health',
    raised: 2000,
    goal: 6000,
    platform: 'Instagram, Facebook',
    status: 'Building support',
    estimatedReachAtGoal: 72000,
    keywords: ['health', 'prevention', 'information', 'community'],
    coverColor: Signal.paperDeep,
    coverSymbol: '+',
    image: require('../../assets/images/stories/health-information.jpg'),
    featuredOnHome: true,
  },
  {
    id: 'community-science-watch',
    createdAt: '2026-10-15',
    fundingDeadline: '2026-12-15',
    country: 'Brazil',
    currency: 'INR',
    title: 'Community Science, Shared Discoveries',
    cause: 'Local science and public understanding',
    category: 'Science',
    discoveryCategory: 'Science',
    description: 'Make local research easier to understand and help residents take part in documenting changes in their environment.',
    creator: 'Lucas Ferreira',
    creatorId: 'lucas-ferreira',
    raised: 1850,
    goal: 6500,
    platform: 'Instagram, Facebook',
    status: 'Building support',
    estimatedReachAtGoal: 78000,
    keywords: ['science', 'research', 'community science', 'environment', 'Brazil'],
    coverColor: Signal.oliveLight,
    coverSymbol: '⌕',
    image: require('../../assets/images/hero-community-signs.png'),
  },
  {
    id: 'people-first-city-budget',
    createdAt: '2026-10-13',
    fundingDeadline: '2026-12-13',
    country: 'Nigeria',
    currency: 'INR',
    title: 'A Clearer View of the City Budget',
    cause: 'Accessible public budget information',
    category: 'Economic Policy',
    discoveryCategory: 'Economic Policy',
    description: 'Help residents understand local budget choices and share clear, practical explanations of how public spending affects daily life.',
    creator: 'Amara Okafor',
    creatorId: 'amara-okafor',
    raised: 1400,
    goal: 5200,
    platform: 'Instagram, Facebook',
    status: 'Building support',
    estimatedReachAtGoal: 62400,
    keywords: ['economics', 'public budget', 'policy', 'public spending', 'Nigeria'],
    coverColor: Signal.paperDeep,
    coverSymbol: '₦',
    image: 'https://images.pexels.com/photos/7109288/pexels-photo-7109288.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
  },
  {
    id: 'neighbourhood-makers-market',
    createdAt: '2026-10-11',
    fundingDeadline: '2026-12-11',
    country: 'Japan',
    currency: 'INR',
    title: 'A Market for Neighbourhood Makers',
    cause: 'Small local creative businesses',
    category: 'Business',
    discoveryCategory: 'Business',
    description: 'Introduce independent makers to nearby customers and show how small creative businesses strengthen local streets.',
    creator: 'Yuki Tanaka',
    creatorId: 'yuki-tanaka',
    raised: 2100,
    goal: 7000,
    platform: 'Instagram, Facebook',
    status: 'Building support',
    estimatedReachAtGoal: 84000,
    keywords: ['business', 'makers', 'small business', 'local market', 'Japan'],
    coverColor: Signal.maroonLight,
    coverSymbol: '⌂',
    image: require('../../assets/images/home/monthly-wins.png'),
  },
  {
    id: 'neighbourhood-heat-safety',
    createdAt: '2026-10-09',
    fundingDeadline: '2026-12-09',
    country: 'India',
    currency: 'INR',
    title: 'Cooler Routes Through Our Neighbourhood',
    cause: 'Community heat safety and shade',
    category: 'Community',
    discoveryCategory: 'Community',
    description: 'Share practical heat-safety information and map shaded routes so neighbours can move around more comfortably during hot days.',
    creator: 'Ananya Nair',
    creatorId: 'ananya-nair',
    raised: 1750,
    goal: 5600,
    platform: 'Instagram, Facebook',
    status: 'Building support',
    estimatedReachAtGoal: 67200,
    keywords: ['community', 'heat', 'shade', 'safety', 'India'],
    coverColor: Signal.oliveLight,
    coverSymbol: '☼',
    image: require('../../assets/images/community-people.jpg'),
  },
  {
    id: 'stories-across-generations',
    createdAt: '2026-10-07',
    fundingDeadline: '2026-12-07',
    country: 'India',
    currency: 'INR',
    title: 'Stories That Bring Generations Together',
    cause: 'Intergenerational storytelling',
    category: 'Other',
    discoveryCategory: 'Other',
    description: 'Invite neighbours to share the stories, memories and everyday knowledge that help generations understand one another.',
    creator: 'Rohan Menon',
    creatorId: 'rohan-menon',
    raised: 900,
    goal: 4000,
    platform: 'Instagram, Facebook',
    status: 'Building support',
    estimatedReachAtGoal: 48000,
    keywords: ['stories', 'community', 'culture', 'generations'],
    coverColor: Signal.paperDeep,
    coverSymbol: '“',
    image: require('../../assets/images/home-children.jpg'),
  },
  {
    id: 'ananya-lake-shared-responsibility',
    createdAt: '2026-05-12',
    fundingDeadline: '2026-07-12',
    country: 'India',
    currency: 'INR',
    title: 'Our Lakes, Our Shared Responsibility',
    cause: 'Lake protection and local environmental awareness',
    category: 'Environment',
    discoveryCategory: 'Environment',
    description: 'Make the value of healthy lakes and the everyday pressures of pollution easier for communities to recognise and discuss.',
    creator: 'Ananya Nair (Environmental Activist)',
    creatorId: 'ananya-nair',
    raised: 7200,
    goal: 6000,
    platform: 'Instagram, Facebook',
    status: 'completed',
    estimatedReachAtGoal: 72000,
    keywords: ['lakes', 'pollution', 'environment', 'community action'],
    coverColor: Signal.oliveLight,
    coverSymbol: '⌁',
    image: require('../../assets/images/stories/lake-habitat.jpg'),
  },
  {
    id: 'rohan-safer-streets-everyone',
    createdAt: '2026-05-18',
    fundingDeadline: '2026-07-18',
    country: 'India',
    currency: 'INR',
    title: 'Safer Streets Begin With Everyone',
    cause: 'Pedestrian safety and accessible public space',
    category: 'Civic Awareness',
    discoveryCategory: 'Public Policy',
    description: 'Bring attention to the street features that shape whether people can move around safely and comfortably, and make community experiences easier to share.',
    creator: 'Rohan Menon (Community Journalist)',
    creatorId: 'rohan-menon',
    raised: 6250,
    goal: 5000,
    platform: 'Instagram, Facebook',
    status: 'completed',
    estimatedReachAtGoal: 60000,
    keywords: ['pedestrian safety', 'accessibility', 'public space', 'community stories'],
    coverColor: Signal.maroonLight,
    coverSymbol: '↗',
    image: require('../../assets/images/stories/accessible-crossing.jpg'),
  },
  {
    id: 'amara-clean-water-community',
    createdAt: '2026-05-22',
    fundingDeadline: '2026-07-22',
    country: 'Nigeria',
    currency: 'INR',
    title: 'Clean Water, Stronger Communities',
    cause: 'Clean water access and community awareness',
    category: 'Community',
    discoveryCategory: 'Community',
    description: 'Help make clean water access a visible community priority through clear information and an invitation to take part in local awareness efforts.',
    creator: 'Amara Okafor',
    creatorId: 'amara-okafor',
    raised: 6050,
    goal: 5500,
    platform: 'Instagram, Facebook',
    status: 'completed',
    estimatedReachAtGoal: 66000,
    keywords: ['clean water', 'community participation', 'local awareness', 'Nigeria'],
    coverColor: Signal.paperDeep,
    coverSymbol: '≈',
    image: require('../../assets/images/stories/lakeshore-care.jpg'),
  },
  {
    id: 'lucas-room-to-move',
    createdAt: '2026-05-27',
    fundingDeadline: '2026-07-27',
    country: 'Brazil',
    currency: 'INR',
    title: 'Room to Move: Streets for Everyone',
    cause: 'Accessible streets and inclusive urban spaces',
    category: 'Civic Awareness',
    discoveryCategory: 'Public Policy',
    description: 'Make the everyday details of urban streets more visible and invite attention to how accessible public spaces can support wider participation.',
    creator: 'Lucas Ferreira',
    creatorId: 'lucas-ferreira',
    raised: 7800,
    goal: 6500,
    platform: 'Instagram, Facebook',
    status: 'completed',
    estimatedReachAtGoal: 78000,
    keywords: ['accessible streets', 'urban spaces', 'public access', 'Brazil'],
    coverColor: Signal.oliveLight,
    coverSymbol: '→',
    image: require('../../assets/images/stories/shaded-sidewalk.jpg'),
  },
  {
    id: 'yuki-art-in-every-neighbourhood',
    createdAt: '2026-06-02',
    fundingDeadline: '2026-08-02',
    country: 'Japan',
    currency: 'INR',
    title: 'Art Belongs in Every Neighbourhood',
    cause: 'Accessible community art and local storytelling',
    category: 'Arts & Culture',
    discoveryCategory: 'Arts & Culture',
    description: 'Invite more neighbours into creative participation and make local stories and shared places part of the public conversation.',
    creator: 'Yuki Tanaka',
    creatorId: 'yuki-tanaka',
    raised: 5750,
    goal: 5000,
    platform: 'Instagram, Facebook',
    status: 'completed',
    estimatedReachAtGoal: 60000,
    keywords: ['community art', 'neighbourhood stories', 'creative participation', 'Japan'],
    coverColor: Signal.maroonLight,
    coverSymbol: '▣',
    image: require('../../assets/images/stories/public-mural.jpg'),
  },
];

export function newestFirstCampaigns(campaigns: readonly DiscoveryCampaign[] = discoveryCampaigns): DiscoveryCampaign[] {
  return campaigns
    .map((campaign, index) => ({ campaign, index }))
    .sort((left, right) => right.campaign.createdAt.localeCompare(left.campaign.createdAt) || left.index - right.index)
    .map(({ campaign }) => campaign);
}

/** Returns null when a campaign has no grounded reach estimate. */
export function formatEstimatedReachAtGoal(campaign: Pick<DiscoveryCampaign, 'estimatedReachAtGoal'>): string | null {
  const reach = campaign.estimatedReachAtGoal;
  return typeof reach === 'number' && Number.isFinite(reach) && reach >= 0
    ? reach.toLocaleString('en-US')
    : null;
}

export const discoveryCategories = [
  'All',
  'Environment',
  'Health',
  'Science',
  'Education',
  'Public Policy',
  'Economic Policy',
  'Community',
  'Arts & Culture',
  'Business',
  'Other',
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
