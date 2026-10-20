import { creatorProfiles, type CreatorProfile } from '@/data/creator-profiles';
import { discoveryCampaigns, newestFirstCampaigns, type DiscoveryCampaign } from '@/data/campaigns';

/**
 * Home's CATW section is a view of the shared Explore catalogue, ordered with
 * the same default sort so campaign identity, details, and images stay aligned.
 */

export type HomeCampaign = DiscoveryCampaign;

export const homeCampaigns: HomeCampaign[] = newestFirstCampaigns(discoveryCampaigns).slice(0, 5);

export type HomePerson = CreatorProfile;

export const homePeople: HomePerson[] = creatorProfiles;

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
