export const campaignStoryFinalHeading = 'And The Next Step, You Ask?' as const;

export type CampaignStoryPhoto = {
  source: number;
  caption: string;
};

export type CampaignStorySection = {
  heading: '' | typeof campaignStoryFinalHeading;
  paragraphs: string[];
  photos?: Partial<Record<number, CampaignStoryPhoto>>;
};

export type CampaignStory = {
  disclosure: string;
  sections: CampaignStorySection[];
};

/** Editorial demo stories and locally bundled contextual images for the Explore catalogue. */
export const campaignStories: Record<string, CampaignStory> = {
  'pages-for-all-library': {
    disclosure: 'Illustrative campaign concept. This page does not document a verified local programme or completed outcome.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Children do not all have the same opportunity to find books beyond the classroom. In some communities, families and schools may have limited collections, while welcoming places to read, borrow, or spend time with books can be difficult to access. When reading material is scarce or out of reach, a child has fewer chances to follow a question, revisit a favourite subject, or choose a book that speaks to a new interest.',
          'Regular access to books supports learning across subjects and gives children room to build vocabulary, curiosity, and imagination at their own pace. Stories and informational books can introduce unfamiliar places, ideas, and ways of seeing the world. Access does not guarantee a particular result, but it gives children more opportunities to practise reading and discover what they enjoy.',
        ],
        photos: {
          1: { source: require('../../assets/images/stories/discovering-books.jpg'), caption: 'Choosing a book gives young readers room to follow a question or interest.' },
        },
      },
      {
        heading: '',
        paragraphs: [
          'A library or community reading space offers more than a collection of books. It can give children a place to browse, read quietly or with others, return to a subject, and build a reading habit over time. A range of material lets readers move between stories, practical knowledge, and ideas they may not encounter in a lesson or at home.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/reading-corner.jpg'), caption: 'A welcoming reading corner brings books, seating, and time to read within reach.' },
        },
      },
      {
        heading: campaignStoryFinalHeading,
        paragraphs: [
          'Distributing the campaign message more widely could help it reach people and organisations with the interest or capacity to support better access to books and welcoming reading spaces.',
          'The campaign seeks to make the reading gap easier to recognise and the case for accessible books easier to share. Its proposed amplification is a way to invite attention and conversation; it does not establish that a library has been funded, opened, or adopted by any institution.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/library-community.png'), caption: 'Preparing a shared reading space is one practical way to support access to books.' },
        },
      },
    ],
  },
  'green-bengaluru-lakes': {
    disclosure: 'Illustrative campaign concept. No specific lake, environmental measurement, partnership, or completed action is documented here.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Urban lakes sit within the daily life of a neighbourhood: they are part of the local landscape, provide habitat, and shape how people experience nearby public space. Waste entering a waterway can affect its surroundings and make a shared resource feel neglected. A campaign about lake protection can help people recognise that how rubbish is handled on land is connected to the condition of water and shorelines.',
          'Clear communication matters because visible litter, water quality, and ecological health are related concerns but are not interchangeable evidence. A responsible public message can explain the issue in plain language, identify what is actually known about a place, and avoid turning a general concern into an unsupported claim about a particular lake.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/lakeshore-care.jpg'), caption: 'Illustrative photo: shoreline clean-ups can make shared responsibility visible.' },
          1: { source: require('../../assets/images/stories/lake-habitat.jpg'), caption: 'Illustrative photo: a lake’s habitat is part of the case for long-term stewardship.' },
        },
      },
      {
        heading: '',
        paragraphs: [
          'The phrase “Our Lakes Aren’t Dumping Grounds” is direct by design. It asks residents to see a lake as a shared place that deserves care, rather than a convenient destination for discarded material. The creative approach can pair a plain statement with images of shorelines and community care, making the connection between individual habits and public space easy to grasp.',
          'A useful awareness campaign can also point people toward credible local information and practical ways to take part, when those details are established. That might mean explaining how a concern can be reported or where an organised clean-up is announced; this catalogue entry does not confirm a location, activity, or partner.',
        ],
      },
      {
        heading: campaignStoryFinalHeading,
        paragraphs: [
          'Wider distribution could bring the message to nearby residents, environmental educators, civic groups, and people involved in maintaining public water spaces. More people seeing a clear message may help make lake care a topic for discussion and help interested audiences look for reliable information about local conditions.',
          'These are possible effects of communication, not promised results. The campaign does not report a lake restoration, measured pollution reduction, or response from a public agency. Its proposed amplification is intended to draw attention to the value of protecting shared water places and encourage informed conversation about what local care requires.',
        ],
      },
    ],
  },
  'neighbourhood-arts-collective': {
    disclosure: 'Illustrative campaign concept. No participating residents, mural site, permit, or completed artwork is documented here.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'A mural changes how a wall is encountered: a blank surface can become a place for colour, memory, and shared interpretation. A neighbourhood arts campaign can use that possibility to invite people to think about whose experiences are represented in public space and how local creative work can become part of the streetscape.',
          'A strong public-art message is more than an image of paint on a wall. It can introduce the idea behind a work, identify the people shaping it, and explain how the setting and the community’s perspectives inform the design. That context helps audiences see public art as cultural expression rather than decoration alone.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/mural-in-progress.jpg'), caption: 'Illustrative photo: a mural taking shape foregrounds the creative process.' },
          1: { source: require('../../assets/images/stories/public-mural.jpg'), caption: 'Illustrative photo: public art can add a shared visual point of reference to a street.' },
        },
      },
      {
        heading: '',
        paragraphs: [
          'When a campaign speaks in the name of a neighbourhood, its creative approach should make room for local voices and describe how participation works. People need to understand who is organising the work, what choices are open to residents, and how permissions and care for the site will be handled before an idea is presented as a project.',
          'The campaign’s title, “Let Our Neighbourhood Tell Its Story,” centres that invitation. It suggests that culture is not limited to formal institutions: a community can interpret its own surroundings and make its perspective visible. The message is most persuasive when it is specific about whose story is being told and how that story was shaped.',
        ],
      },
      {
        heading: campaignStoryFinalHeading,
        paragraphs: [
          'Sharing the campaign more broadly could help local artists, residents, cultural groups, and potential supporters understand the idea and decide whether they want to learn more. Distribution may also give organisers a way to explain the purpose of the work and invite constructive discussion about public art and shared space.',
          'Attention alone does not secure a wall, funding, permission, participation, or a finished mural. Those would require their own decisions and arrangements. The campaign’s proposed amplification is a way to make the idea easier to encounter and discuss, while leaving any future project outcomes open and unconfirmed.',
        ],
      },
    ],
  },
  'better-streets-collective': {
    disclosure: 'Illustrative campaign concept. No street audit, named location, accessibility assessment, or public-authority response is documented here.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Pavements, crossings, lighting, and public-space entrances influence whether people can move through a neighbourhood comfortably and independently. A broken path or difficult crossing can affect a person using a mobility aid, an older pedestrian, a parent with a stroller, or anyone navigating after dark. Street access is part of ordinary participation in community life.',
          'A campaign about safer, more accessible streets can help audiences notice how design details shape a route. Images and clear descriptions can make a concern easier to understand, while a credible account of a specific barrier should identify where it is, who experiences it, and what evidence supports the description.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/tactile-paving.jpg'), caption: 'Illustrative photo: tactile paving is one element that can support independent navigation.' },
          1: { source: require('../../assets/images/stories/accessible-crossing.jpg'), caption: 'Illustrative photo: crossing design affects how people move through public space.' },
        },
      },
      {
        heading: '',
        paragraphs: [
          '“The Streets We Deserve” frames street access as a shared civic concern. Its creative direction can bring attention to the route itself—where people walk, wait, cross, or encounter an obstacle—rather than treating accessibility as a specialist issue that concerns only a few residents.',
          'Community reporting can help explain how different people experience the same space. To be useful, that storytelling should distinguish personal experience from a formal inspection and make clear whether a location or proposed fix has been verified. The catalogue does not include a street assessment or specific location.',
        ],
      },
      {
        heading: campaignStoryFinalHeading,
        paragraphs: [
          'Wider distribution could help residents, accessibility advocates, community journalists, and people involved in public-space planning encounter the campaign’s central question: what makes a street usable for more people? A clear message may help an audience recognise a concern and look for ways to discuss it with relevant local groups.',
          'Such discussion is a possibility, not a confirmed response. The campaign does not report completed repairs, an official review, or a commitment from a decision-maker. Its proposed reach is intended to support awareness of everyday street access and invite more informed attention to the issue.',
        ],
      },
    ],
  },
  'community-health-connect': {
    disclosure: 'Illustrative campaign concept. No health service, clinical source, medical advice, or completed information distribution is documented here.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Public-health messages are more useful when people can find them, understand what they mean, and tell where the guidance comes from. Dense language, unfamiliar terms, and unclear next steps can make information difficult to use. Communication should account for different reading levels, languages, formats, and routes people take to seek care.',
          'The campaign title, “Health Information Should Reach Everyone,” puts access and clarity together. Its message can focus on how reliable preventive information is presented and shared, while making it clear that a campaign post is not a diagnosis or substitute for advice from a qualified health professional.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/health-information.jpg'), caption: 'Illustrative photo: accessible printed information can support a conversation about health.' },
          1: { source: require('../../assets/images/stories/community-health-event.jpg'), caption: 'Illustrative photo: community settings can help people encounter public-health information.' },
        },
      },
      {
        heading: '',
        paragraphs: [
          'Health communication needs particular care because readers may act on what they see. A responsible campaign identifies the qualified source behind its information, explains who the message is for, and avoids overstating what a recommendation can do. Plain language should make evidence easier to follow without removing important limits or context.',
          'The demo record does not include a clinical reference or a specific health message, so this presentation stays at the level of communication principles. A real public-health campaign would need to attach appropriate sources and review its wording before asking audiences to rely on it.',
        ],
      },
      {
        heading: campaignStoryFinalHeading,
        paragraphs: [
          'Wider distribution could introduce the campaign’s access message to community members, health educators, service organisations, and potential supporters. Reaching those audiences may help draw attention to the role of understandable information and point people toward relevant, qualified sources when they are supplied.',
          'The campaign does not claim to provide treatment, deliver a health service, or change health outcomes. Its proposed amplification is an invitation to discuss how reliable information can be made easier to encounter, with the accuracy and source of any future advice established separately.',
        ],
      },
    ],
  },
  'community-science-watch': {
    disclosure: 'Illustrative campaign concept. No study, research institution, dataset, field activity, or scientific finding is documented here.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Scientific work can shape how communities understand changes in the places around them, but specialist methods and terminology can make findings difficult to follow. Clear public communication explains the question being explored, how information was gathered, and what the evidence can—and cannot—show.',
          'Community science also depends on a transparent relationship between observation and conclusion. People may help notice or record changes, but observations need consistent methods and careful interpretation before they support a wider claim. A campaign can make that process visible and invite curiosity without suggesting that participation alone proves a result.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/community-science.jpg'), caption: 'Illustrative photo: shared observation can be a starting point for scientific questions.' },
          1: { source: require('../../assets/images/stories/field-notes.jpg'), caption: 'Illustrative photo: recording what is observed helps make a process easier to explain.' },
        },
      },
      {
        heading: '',
        paragraphs: [
          '“Community Science, Shared Discoveries” points to two parts of public research: understandable explanation and meaningful participation. A strong creative approach can show how a question is asked, how observations are recorded, and where specialist knowledge helps interpret the evidence.',
          'For a specific research project, readers would need to know who is responsible for the work, what is measured, how uncertainty is handled, and where results can be reviewed. None of those materials accompanies this demo entry, so it makes no claim about a local environmental change or scientific finding.',
        ],
      },
      {
        heading: campaignStoryFinalHeading,
        paragraphs: [
          'Wider awareness could help residents, educators, researchers, and science communicators encounter the idea and consider how research can be shared in accessible language. It may also help interested readers identify where to find a project’s methods and results, if those references are provided by its organisers.',
          'The campaign does not report that a study has begun or that residents have contributed data. Its proposed amplification is meant to make the value of clear, open scientific communication easier to discuss, while keeping any research activity and outcome unconfirmed.',
        ],
      },
    ],
  },
  'people-first-city-budget': {
    disclosure: 'Illustrative campaign concept. No city budget, spending analysis, financial finding, or government response is documented here.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'A public budget turns priorities into categories, plans, and financial decisions. Yet budget documents can be difficult to navigate when figures are presented without plain-language explanations of what a line covers, how choices relate to public services, or which questions remain open.',
          'Making budget information easier to understand is not the same as proving that a decision is good or bad. A useful explainer helps readers follow the source document, understand the terms being used, and distinguish a planned allocation from spending that has actually occurred.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/budget-documents.jpg'), caption: 'Illustrative photo: reading the underlying documents is part of understanding public spending.' },
          1: { source: require('../../assets/images/stories/budget-review.jpg'), caption: 'Illustrative photo: clear discussion can help people work through complex budget information.' },
        },
      },
      {
        heading: '',
        paragraphs: [
          '“A Clearer View of the City Budget” presents accessibility as the campaign’s central purpose. A creative approach can translate unfamiliar terms into explanations, show how a reader can trace a point back to its source, and make room for questions rather than offering a verdict without evidence.',
          'A specific public-finance campaign should name the jurisdiction and budget year, link to the original documents, explain its method, and correct for the limits of the available data. This catalogue entry supplies no such source material, so it does not describe a particular spending choice or allege misuse.',
        ],
      },
      {
        heading: campaignStoryFinalHeading,
        paragraphs: [
          'Wider distribution could help residents, journalists, civic organisations, and people interested in public policy discover the campaign’s case for readable budget information. Reaching those audiences may invite more careful questions and encourage people to look for the public documents that support a local discussion.',
          'Distribution cannot substitute for financial evidence, an audit, or an official answer. No spending change or institutional response is claimed here. The proposed amplification is an opportunity to bring the idea of clearer public information into view and make it easier to share.',
        ],
      },
    ],
  },
  'neighbourhood-makers-market': {
    disclosure: 'Illustrative campaign concept. No participating makers, confirmed market, sales, or business outcomes are documented here.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Small creative businesses often depend on people being able to find their work and understand what makes it distinctive. A neighbourhood market can offer a direct meeting point between makers and customers, while a campaign can introduce the skills, materials, and ideas behind locally made goods.',
          'The value of a maker-focused message is not only commercial. It can help audiences notice forms of craft and design that are part of a place’s cultural life and give independent producers a clearer public presence. Any account of a particular business should be based on the maker’s own description and permission.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/maker-at-work.jpg'), caption: 'Illustrative photo: the making process gives audiences context for a finished object.' },
          1: { source: require('../../assets/images/stories/handmade-market.jpg'), caption: 'Illustrative photo: a market display can help customers encounter independent work.' },
        },
      },
      {
        heading: '',
        paragraphs: [
          '“A Market for Neighbourhood Makers” suggests a simple invitation: discover the people and creative work around you. The campaign can use images of making and display to explain why local creative businesses deserve visibility, while making clear whether a market, directory, or other way to participate is actually available.',
          'This catalogue entry does not name vendors, products, a venue, or a date. Those details would be necessary before audiences could treat the idea as an event announcement. Keeping the distinction clear respects both makers and potential customers.',
        ],
      },
      {
        heading: campaignStoryFinalHeading,
        paragraphs: [
          'Wider distribution could bring the idea to nearby residents, independent makers, cultural groups, and people who support local enterprise. More visibility may help interested audiences learn about a future opportunity or discover how local creative work contributes to everyday neighbourhood life.',
          'The campaign does not promise sales, attendance, or a stronger business outlook. Its proposed amplification is intended to make the case for discoverability easier to encounter and discuss; any marketplace or business result would depend on arrangements beyond the message itself.',
        ],
      },
    ],
  },
  'neighbourhood-heat-safety': {
    disclosure: 'Illustrative campaign concept. No local heat reading, route map, public-health source, or completed safety measure is documented here.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'On hot days, shade and access to comfortable places to pause can influence whether a walk feels manageable. The availability of tree cover, covered paths, and clear information can matter to people moving through a neighbourhood for daily needs, especially when they have limited choice about when or where to travel.',
          'A campaign about cooler routes can make these everyday conditions easier to notice. A route guide should be based on current local observation and explain when it was checked, what its limits are, and where people can find authoritative heat-safety advice. A general message should not be mistaken for a live map or emergency guidance.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/shaded-sidewalk.jpg'), caption: 'Illustrative photo: tree cover can make shade visible as part of the public route.' },
          1: { source: require('../../assets/images/stories/walking-under-trees.jpg'), caption: 'Illustrative photo: a shaded path is one element a local route guide could describe.' },
        },
      },
      {
        heading: '',
        paragraphs: [
          '“Cooler Routes Through Our Neighbourhood” connects heat awareness with the spaces people use to get around. Its creative direction can show how route conditions matter and invite readers to consider what information would help them plan a journey more comfortably.',
          'A responsible campaign would distinguish a suggested route from an official accessibility assessment and would not make safety guarantees. This record does not provide a named route, shade survey, weather data, or health guidance; any such information would need to be established separately.',
        ],
      },
      {
        heading: campaignStoryFinalHeading,
        paragraphs: [
          'Wider distribution could help residents, community groups, public-space planners, and organisations focused on heat preparedness encounter the message. It may help audiences discuss shade and route information as part of how neighbourhood spaces serve people during hot weather.',
          'Awareness does not create tree cover, change a route, or guarantee protection from heat. No local plan or safety outcome is confirmed by this campaign entry. The proposed amplification is an invitation to make practical information and public-space conditions part of a broader conversation.',
        ],
      },
    ],
  },
  'stories-across-generations': {
    disclosure: 'Illustrative campaign concept. No participant stories, recordings, archive, event, or community permissions are documented here.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'People learn about a place through more than formal records. Memories of changing streets, family practices, work, language, and daily routines can help different generations understand how a community has been shaped. Listening across age groups can also make room for younger people to share what matters to them now.',
          '“Stories That Bring Generations Together” frames storytelling as an exchange rather than a one-way record of the past. A thoughtful campaign can invite audiences to value both lived experience and new perspectives, while recognising that each person decides what they are comfortable sharing.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/intergenerational-conversation.jpg'), caption: 'Illustrative photo: conversation can make room for memories and questions to be shared.' },
          1: { source: require('../../assets/images/stories/family-storytelling.jpg'), caption: 'Illustrative photo: stories shared at home can connect experience across age groups.' },
        },
      },
      {
        heading: '',
        paragraphs: [
          'Stories can be personal, and the way they are recorded or distributed matters. A real project should explain who will hear or keep a story, how a participant can change their mind, and whether their name or image will appear. Consent and context help ensure that sharing is respectful rather than extractive.',
          'The campaign can communicate its invitation through ordinary conversation and listening, rather than promising a permanent archive or a public event. No participants or submitted stories are identified in this catalogue entry.',
        ],
      },
      {
        heading: campaignStoryFinalHeading,
        paragraphs: [
          'Wider distribution could help families, community groups, libraries, and cultural organisers encounter the idea and consider whether an exchange of stories would be useful in their own setting. The message may help make intergenerational listening visible as a form of community connection.',
          'The campaign does not confirm that a gathering, archive, or collection of stories exists. Its proposed amplification is intended to invite attention to the value of listening across generations, while leaving participation and any future activity to the people involved.',
        ],
      },
    ],
  },
  'ananya-lake-shared-responsibility': {
    disclosure: 'Illustrative story based on the campaign description. The images are contextual and do not document a verified site or campaign activity.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Healthy lakes are part of the places people share: they shape local landscapes, support living habitats, and give communities a reason to care for the water and its surroundings. Pollution can make those shared places harder to enjoy and protect. This campaign asks people to notice the everyday pressures that can affect a lake and to keep its value in view.',
          'A clear message can help connect local observations with a wider conversation about stewardship. It can also encourage readers to look for reliable information about the lakes near them, while distinguishing general awareness from verified environmental measurements or a formal assessment.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/lake-habitat.jpg'), caption: 'Illustrative freshwater habitat; not a verified campaign site.' },
        },
      },
      {
        heading: campaignStoryFinalHeading,
        paragraphs: [
          'The campaign’s description focuses on making the importance of healthy lakes and the pressures of pollution easier to recognise and discuss. Wider sharing could help people encounter that message and consider what responsible care of a shared water place involves.',
          'The campaign record does not name a lake, report a clean-up, or document a measured change in water quality. Its story is an invitation to pay attention and seek trustworthy local information; no environmental outcome is claimed here.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/lakeshore-care.jpg'), caption: 'Illustrative shoreline care; this photo does not show a confirmed campaign activity.' },
        },
      },
    ],
  },
  'rohan-safer-streets-everyone': {
    disclosure: 'Illustrative story based on the campaign description. Photos provide accessibility context and do not document a verified street or audit.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'A street is part of everyday life: people use it to reach work, school, shops, and one another. Crossings, pavements, and other small design details can influence whether a route feels safe and usable for someone walking, using a mobility aid, or moving at a different pace.',
          'The campaign centres community experience as a way to make those details easier to notice. Clear storytelling can help readers understand why access matters while leaving room for different people to describe what they encounter on the same street.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/accessible-crossing.jpg'), caption: 'Illustrative accessible crossing; not a documented campaign location.' },
        },
      },
      {
        heading: campaignStoryFinalHeading,
        paragraphs: [
          'Sharing the message more widely could help people discuss pedestrian safety and accessible public space as connected parts of neighbourhood life. The campaign description invites attention to street features and community perspectives rather than proposing a specific repair.',
          'No street audit, named location, completed improvement, or public-authority response is included in the campaign record. The story does not claim that a particular route has changed; it makes the case for listening to the experiences that shape how streets are used.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/tactile-paving.jpg'), caption: 'Illustrative tactile paving detail; no specific street is identified.' },
        },
      },
    ],
  },
  'amara-clean-water-community': {
    disclosure: 'Illustrative story based on the campaign description. Water images are contextual and do not show a confirmed project location or outcome.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Access to clean water affects ordinary routines and the wellbeing of a community. Making the issue visible can be a first step toward a more informed conversation, especially when a message is clear about what is known and whose perspectives it represents.',
          'This campaign is described as a community-awareness effort. Its story focuses on sharing information and inviting participation, without suggesting that a particular water source has been tested, repaired, or made more accessible.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/lakeshore-care.jpg'), caption: 'Illustrative waterway image; not a verified clean-water project site.' },
        },
      },
      {
        heading: campaignStoryFinalHeading,
        paragraphs: [
          'Wider distribution could help more people encounter the campaign’s invitation to treat clean-water access as a shared community concern. A useful conversation can make space for local knowledge and for reliable information about the conditions people are discussing.',
          'The campaign record does not include water-quality results, a named community project, or a confirmed service change. No improvement in water access is claimed; the message is intended to support awareness and informed discussion.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/lake-habitat.jpg'), caption: 'Illustrative freshwater habitat; not evidence of a campaign result or location.' },
        },
      },
    ],
  },
  'lucas-room-to-move': {
    disclosure: 'Illustrative story based on the campaign description. Photos provide urban-access context and do not document a verified street or campaign activity.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Moving through a city depends on more than the distance between two places. Pavements, crossings, shade, and access to public spaces all shape how comfortable and inclusive a route can feel. Barriers that are easy to overlook can affect whether someone can take part in daily life independently.',
          'This campaign asks people to pay attention to those everyday details. Community stories can help explain how the same street is experienced differently, and why accessible public space matters to a wider group of people.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/shaded-sidewalk.jpg'), caption: 'Illustrative urban sidewalk; no campaign location is identified.' },
        },
      },
      {
        heading: campaignStoryFinalHeading,
        paragraphs: [
          'Wider sharing could invite more people to consider what makes a street welcoming and usable. The campaign description presents awareness and conversation as its focus, with attention to how public spaces can support wider participation.',
          'No accessibility assessment, named route, or completed street change is documented in this campaign record. The story does not claim that a particular barrier has been addressed; it invites attention to the conditions people encounter.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/accessible-crossing.jpg'), caption: 'Illustrative crossing scene; not a verified campaign site or outcome.' },
        },
      },
    ],
  },
  'yuki-art-in-every-neighbourhood': {
    disclosure: 'Illustrative story based on the campaign description. Art images are contextual and do not document a confirmed mural or participating community.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Creative work can change how people see familiar places and make room for stories that are not always visible in public life. Neighbourhood art can offer an invitation to notice local perspectives and to think about who gets to shape the places people share.',
          'This campaign is described as a call for wider creative participation and local storytelling. Its message can introduce the idea while recognising that any real artwork or public project would depend on the people involved and the arrangements around it.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/mural-in-progress.jpg'), caption: 'Illustrative mural-making process; not a documented campaign project.' },
        },
      },
      {
        heading: campaignStoryFinalHeading,
        paragraphs: [
          'Sharing the campaign more broadly could help neighbours encounter its invitation to take part in local creative life. It may also prompt discussion about how art can reflect a place and whose perspectives should be part of that conversation.',
          'The campaign record does not name a mural site, confirm permissions, or identify participating residents. No finished artwork or community outcome is claimed; the story is about making the possibility of shared creativity easier to discuss.',
        ],
        photos: {
          0: { source: require('../../assets/images/stories/public-mural.jpg'), caption: 'Illustrative public mural; not an artwork confirmed by this campaign.' },
        },
      },
    ],
  },
};
