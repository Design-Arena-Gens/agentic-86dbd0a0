import logger from './logger';

interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  language: 'hi' | 'en' | 'hinglish';
}

const MYSTERY_CRIME_TITLES = {
  hi: [
    'रहस्यमयी {topic} - सच्ची घटना | Dark Mystery',
    '{topic} का अनसुलझा रहस्य | True Crime India',
    'खौफनाक {topic} की कहानी | Real Crime Story',
    'भारत का सबसे डरावना केस: {topic}',
    '{topic} - जिसे सुनकर रूह कांप जाए | Mystery',
    'असली अपराध: {topic} का काला सच',
  ],
  en: [
    'The Dark Mystery of {topic} | True Crime',
    'Unsolved: The {topic} Case | Crime Documentary',
    '{topic} - A Chilling True Story',
    "India's Most Mysterious Case: {topic}",
    'The Haunting Truth Behind {topic}',
    'Dark Secrets: The {topic} Investigation',
  ],
  hinglish: [
    '{topic} Ka Rahasya | Dark Mystery Revealed',
    'Bharat Ki Sabse Bhayankar Crime: {topic}',
    '{topic} - Ek Sachi Kahani | True Crime',
    'Mystery Solved: {topic} Ka Sach',
    '{topic} Case - Jo Aapko Sochne Par Majboor Karegi',
    'Real Crime Story: {topic} Ka Anth',
  ],
};

const DESCRIPTION_TEMPLATES = {
  hi: `{summary}

इस वीडियो में हम {topic} के रहस्यमय मामले को विस्तार से जानेंगे। यह एक सच्ची घटना है जो आपको सोचने पर मजबूर कर देगी।

⚠️ अस्वीकरण: यह वीडियो केवल शैक्षिक और जागरूकता उद्देश्यों के लिए है। हम किसी भी प्रकार की हिंसा या अपराध को बढ़ावा नहीं देते हैं।

🔔 चैनल को सब्सक्राइब करें और नोटिफिकेशन बेल को ऑन करें ताकि आप ऐसे और भी रहस्यमय मामलों के बारे में जान सकें।

#TrueCrime #Mystery #CrimeStory #DarkSecrets #IndianCrime #Documentary`,

  en: `{summary}

In this video, we delve deep into the mysterious case of {topic}. This is a true crime story that will leave you questioning everything.

⚠️ Disclaimer: This video is for educational and awareness purposes only. We do not promote violence or criminal activities in any form.

🔔 Subscribe to our channel and turn on notifications to stay updated with more dark mysteries and crime documentaries.

#TrueCrime #Mystery #CrimeDocumentary #DarkSecrets #Investigation #RealStory`,

  hinglish: `{summary}

Is video mein hum {topic} ke mysterious case ko detail mein jaanenge. Yeh ek true crime story hai jo aapko shock kar degi.

⚠️ Disclaimer: Yeh video sirf educational aur awareness purpose ke liye hai. Hum kisi bhi tarah ki violence ya crime ko promote nahi karte.

🔔 Channel ko subscribe karein aur notification bell on karein taaki aap aur bhi dark mysteries aur crime stories dekh sakein.

#TrueCrime #Mystery #CrimeStory #DarkSecrets #Investigation #IndianCrime`,
};

const COMMON_TAGS = [
  'true crime',
  'mystery',
  'crime documentary',
  'dark secrets',
  'unsolved mystery',
  'investigation',
  'crime story',
  'real crime',
  'mystery solved',
  'crime investigation',
];

const RESTRICTED_WORDS = [
  'murder',
  'killed',
  'blood',
  'death',
  'violence',
  'assault',
  'brutal',
  'torture',
  'suicide',
  'graphic',
];

function sanitizeText(text: string): string {
  let sanitized = text;
  RESTRICTED_WORDS.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    sanitized = sanitized.replace(regex, (match) => {
      return match.charAt(0) + '*'.repeat(match.length - 1);
    });
  });
  return sanitized;
}

export function generateMetadata(
  topic: string,
  summary: string,
  language: 'hi' | 'en' | 'hinglish' = 'hi',
  customTags: string[] = []
): VideoMetadata {
  try {
    const titleTemplates = MYSTERY_CRIME_TITLES[language];
    const titleTemplate = titleTemplates[Math.floor(Math.random() * titleTemplates.length)];
    const title = sanitizeText(titleTemplate.replace('{topic}', topic));

    const descriptionTemplate = DESCRIPTION_TEMPLATES[language];
    const description = sanitizeText(
      descriptionTemplate.replace(/{topic}/g, topic).replace('{summary}', summary)
    );

    const tags = [
      ...new Set([
        ...COMMON_TAGS,
        ...customTags,
        topic.toLowerCase(),
        `${topic} case`,
        language === 'hi' ? 'crime hindi' : '',
        language === 'en' ? 'crime english' : '',
        language === 'hinglish' ? 'crime hinglish' : '',
      ]),
    ].filter(Boolean);

    logger.info('Metadata generated', { title, language, tagsCount: tags.length });

    return {
      title,
      description,
      tags,
      language,
    };
  } catch (error) {
    logger.error('Error generating metadata', { error });
    throw error;
  }
}

export function generateScheduleTime(uploadsPerWeek: number = 3): Date {
  const now = new Date();
  const daysUntilNextUpload = Math.floor(7 / uploadsPerWeek);
  const nextUploadDate = new Date(now.getTime() + daysUntilNextUpload * 24 * 60 * 60 * 1000);

  // Set to optimal engagement time: 6 PM IST
  nextUploadDate.setHours(18, 0, 0, 0);

  logger.info('Schedule time generated', {
    nextUploadDate: nextUploadDate.toISOString(),
    uploadsPerWeek,
  });

  return nextUploadDate;
}
