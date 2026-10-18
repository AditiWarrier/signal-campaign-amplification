/**
 * Demo content for the Home page sections below the reach estimate.
 * Every value here is illustrative placeholder data for the visual prototype
 * and is intended to be replaced with real content later.
 * Campaign ids match `discoveryCampaigns` so the existing detail route resolves.
 */

export type HomeCampaign = {
  id: string;
  category: string;
  title: string;
  creator: string;
  summary: string;
  raised: number;
  goal: number;
  reach: number;
  image: number;
};

export const homeCampaigns: HomeCampaign[] = [
  {
    id: 'creekside-native-plants',
    category: 'Environment',
    title: 'Bring Creekside back to life',
    creator: 'Creekside Neighbors',
    summary: 'A volunteer group organizing a native planting day and sharing simple ways residents can care for the creek.',
    raised: 2675,
    goal: 5000,
    reach: 60000,
    image: require('../../assets/images/home/campaign-creekside.png'),
  },
  {
    id: 'open-books-after-school',
    category: 'Education',
    title: 'Open books after school',
    creator: 'Maple Street Library Friends',
    summary: 'Volunteers want more families to know about free after-school reading hours at the neighborhood library.',
    raised: 1320,
    goal: 3500,
    reach: 42000,
    image: require('../../assets/images/home/campaign-books.png'),
  },
  {
    id: 'neighbors-share-fresh-food',
    category: 'Community',
    title: 'Neighbors share fresh food',
    creator: 'Eastside Pantry Project',
    summary: 'A community pantry spreading the word about its weekly produce exchange and volunteer sign-up days.',
    raised: 1840,
    goal: 4000,
    reach: 48000,
    image: require('../../assets/images/home/campaign-food.png'),
  },
  {
    id: 'know-your-rights-workshop',
    category: 'Human Rights',
    title: 'Know your rights, together',
    creator: 'Riverside Tenants Circle',
    summary: 'A tenant group inviting neighbors to a free evening workshop on housing rights and local resources.',
    raised: 760,
    goal: 2500,
    reach: 30000,
    image: require('../../assets/images/home/campaign-rights.png'),
  },
  {
    id: 'stories-from-main-street',
    category: 'Arts & Media',
    title: 'Stories from Main Street',
    creator: 'Open Frame Studio',
    summary: 'An independent collective making a short film about the people who make a neighborhood feel like home.',
    raised: 920,
    goal: 3000,
    reach: 36000,
    image: require('../../assets/images/home/campaign-mainstreet.png'),
  },
];

export type HomePerson = {
  id: string;
  name: string;
  area: string;
  summary: string;
  image: number;
};

export const homePeople: HomePerson[] = [
  {
    id: 'amara-lewis',
    name: 'Amara Lewis',
    area: 'Campaigns in Food Access',
    summary: 'Runs awareness campaigns that help neighbors find and share fresh, affordable food closer to home.',
    image: require('../../assets/images/home/person-amara.png'),
  },
  {
    id: 'leo-nakamura',
    name: 'Leo Nakamura',
    area: 'Environment Advocate',
    summary: 'Organizes volunteer days and shares practical ways residents can look after local green spaces.',
    image: require('../../assets/images/home/person-leo.png'),
  },
  {
    id: 'sofia-reyes',
    name: 'Sofia Reyes',
    area: 'Independent Storyteller',
    summary: 'Makes short films and photo series about everyday people and the places that shape a community.',
    image: require('../../assets/images/home/person-sofia.png'),
  },
  {
    id: 'priya-raman',
    name: 'Priya Raman',
    area: 'Campaigns in Education',
    summary: 'Works with parents and librarians to spread the word about free learning programs for children.',
    image: require('../../assets/images/home/person-priya.png'),
  },
  {
    id: 'daniel-hart',
    name: 'Daniel Hart',
    area: 'Housing Rights Organizer',
    summary: 'Helps tenant groups host plain-language workshops so neighbors know where to find local resources.',
    image: require('../../assets/images/home/person-daniel.png'),
  },
  {
    id: 'tomas-cruz',
    name: 'Tomás Cruz',
    area: 'Youth Sports Volunteer',
    summary: 'Coordinates weekend games and invites new families to join free youth sports programs nearby.',
    image: require('../../assets/images/home/person-tomas.png'),
  },
];

export const monthlyWin = {
  month: 'October',
  title: 'A new mural for Birch Avenue',
  summary: 'After weeks of sharing sketches with neighbors, a local arts campaign gathered enough interest to host an open painting weekend.',
  image: require('../../assets/images/home/monthly-wins.png'),
};

export const moreMonthlyWins: { title: string; summary: string }[] = [
  { title: 'Creekside planting day fills up', summary: 'Volunteer spots for the native planting morning were taken within the week.' },
  { title: 'Library reading hours on the map', summary: 'The after-school reading campaign shared its schedule with more nearby schools.' },
];
