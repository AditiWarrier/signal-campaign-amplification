import { discoveryCampaigns } from '@/data/campaigns';

export type CreatorProfile = {
  id: string;
  name: string;
  role: string;
  country: string;
  introduction: string;
  aboutMe: string[];
  demoEmail: string;
  demoPhone: string;
  image: number | { uri: string };
};

export const creatorProfiles: CreatorProfile[] = [
  {
    id: 'ananya-nair',
    name: 'Ananya Nair',
    role: 'Environmental Activist',
    country: 'India',
    introduction: "Hi, I'm Ananya. I care about protecting lakes, making local pollution easier to see, and helping communities find practical ways to act. Through SIGNAL, I share campaigns that bring neighbourhood environmental issues to more people's attention.",
    aboutMe: [
      'I focus on the health of shared lakes and the pollution pressures around them. These places are part of community life and local ecosystems, so clear, accessible awareness matters.',
      'My campaigns use straightforward information and community-minded stories to invite people to notice environmental concerns, talk about them, and consider practical ways to take part. I hope wider awareness can help keep lake protection part of local conversations.',
    ],
    demoEmail: 'ananya.nair@example.com',
    demoPhone: '+00 0000 000 001',
    image: require('../../assets/images/home/person-priya.png'),
  },
  {
    id: 'rohan-menon',
    name: 'Rohan Menon',
    role: 'Community Journalist',
    country: 'India',
    introduction: "Hi, I'm Rohan. I'm interested in how people experience their streets and public spaces, and in the everyday community stories that deserve a wider audience. Through SIGNAL, I share those perspectives in a clear, approachable way.",
    aboutMe: [
      'I pay attention to the details that shape daily movement: safe crossings, usable pavements, and public places that welcome different people. Pedestrian safety and accessibility affect who can take part in neighbourhood life.',
      'My campaigns bring community experiences into view and make local issues easier to discuss. I hope that sharing these stories can help more people recognise the practical needs behind safer, more accessible streets.',
    ],
    demoEmail: 'rohan.menon@example.com',
    demoPhone: '+00 0000 000 002',
    image: {
      uri: 'https://images.unsplash.com/photo-1768654930111-c007226f15b7?auto=format&fit=crop&crop=faces&w=512&q=85',
    },
  },
  {
    id: 'amara-okafor',
    name: 'Amara Okafor',
    role: 'Community Organiser',
    country: 'Nigeria',
    introduction: "Hi, I'm Amara. I care about access to clean water and making sure local awareness work leaves room for community participation. Through SIGNAL, I help bring practical community concerns into a wider conversation.",
    aboutMe: [
      'Reliable access to clean water matters in everyday life, and the people closest to an issue should have space to help shape how it is understood. I am drawn to campaigns that make local needs easier to recognise without speaking over the communities involved.',
      'My work here focuses on clear public information, participation, and local awareness initiatives. I hope these messages can help people find common ground, ask useful questions, and see where community-led action may be possible.',
    ],
    demoEmail: 'amara.okafor@example.com',
    demoPhone: '+00 0000 000 003',
    image: require('../../assets/images/home/person-amara.png'),
  },
  {
    id: 'lucas-ferreira',
    name: 'Lucas Ferreira',
    role: 'Independent Journalist',
    country: 'Brazil',
    introduction: "Hi, I'm Lucas. I want local questions about accessible streets and shared urban spaces to be easier to see and talk about. Through SIGNAL, I bring a community-focused lens to issues that shape how people move through the city.",
    aboutMe: [
      'Streets and public spaces influence who can move around comfortably and who feels included in city life. Small barriers can have a real effect on everyday access, even when they are easy to overlook.',
      'My campaigns focus on making these local conditions more visible through concise, accessible storytelling. I hope that a wider conversation can help residents and advocates recognise shared concerns and consider more inclusive public spaces.',
    ],
    demoEmail: 'lucas.ferreira@example.com',
    demoPhone: '+00 0000 000 004',
    image: {
      uri: 'https://images.unsplash.com/photo-1775260014013-68d82308dd86?auto=format&fit=crop&crop=faces&w=512&q=85',
    },
  },
  {
    id: 'yuki-tanaka',
    name: 'Yuki Tanaka',
    role: 'Community Artist',
    country: 'Japan',
    introduction: "Hi, I'm Yuki. I care about neighbourhood art, the stories people share about their surroundings, and making creative participation feel open to more people. Through SIGNAL, I invite attention to the creative life of local communities.",
    aboutMe: [
      'Art can give neighbours a way to express what matters to them and to see familiar places through one another’s perspectives. I am especially interested in creative activities that make room for different voices and levels of experience.',
      'My campaigns highlight neighbourhood storytelling and accessible ways to take part in public creativity. I hope they can encourage more people to see local art as something they can contribute to, not only something they observe.',
    ],
    demoEmail: 'yuki.tanaka@example.com',
    demoPhone: '+00 0000 000 005',
    image: require('../../assets/images/home/person-yuki.jpg'),
  },
];

export function getCreatorProfile(creatorId: string | undefined): CreatorProfile | undefined {
  return creatorProfiles.find((profile) => profile.id === creatorId);
}

export function getCreatorCampaigns(creatorId: string) {
  return discoveryCampaigns.filter((campaign) => campaign.creatorId === creatorId);
}
