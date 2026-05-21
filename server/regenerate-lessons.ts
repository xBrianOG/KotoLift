import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || "5432"),
  database: process.env.PG_DATABASE || "postgres",
  user: process.env.PG_USER || "postgres",
  password: process.env.PG_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const definitions: Record<string, string> = {
  "need": "to require something",
  "want": "to desire or wish for",
  "have": "to possess or own",
  "be": "to exist or live",
  "do": "to perform an action",
  "make": "to create or build",
  "get": "to receive or obtain",
  "know": "to have knowledge of",
  "think": "to believe or consider",
  "say": "to speak or utter",
  "tell": "to inform or notify",
  "find": "to discover or locate",
  "give": "to offer or provide",
  "take": "to grab or hold",
  "see": "to view with eyes",
  "come": "to arrive at a place",
  "go": "to leave or move away",
  "become": "to change into",
  "leave": "to go away from",
  "put": "to place or set down",
  "keep": "to hold or maintain",
  "let": "to allow or permit",
  "begin": "to start something",
  "seem": "to appear or look",
  "help": "to assist or aid",
  "show": "to demonstrate or display",
  "hear": "to perceive with ears",
  "play": "to engage in fun",
  "run": "to move quickly",
  "move": "to change position",
  "live": "to reside or dwell",
  "believe": "to trust or think true",
  "bring": "to carry to a place",
  "happen": "to occur or take place",
  "write": "to compose text",
  "provide": "to supply or give",
  "sit": "to be seated",
  "stand": "to be on feet",
  "lose": "to misplace something",
  "pay": "to give money",
  "meet": "to encounter someone",
  "include": "to contain or have",
  "continue": "to keep doing",
  "set": "to arrange or place",
  "learn": "to gain knowledge",
  "change": "to make different",
  "lead": "to guide or direct",
  "understand": "to comprehend",
  "watch": "to observe or view",
  "follow": "to go behind",
  "stop": "to cease or halt",
  "create": "to make or invent",
  "speak": "to talk or say",
  "read": "to interpret text",
  "allow": "to permit or let",
  "add": "to combine or join",
  "spend": "to use time/money",
  "grow": "to increase in size",
  "open": "to unfold or reveal",
  "walk": "to move on foot",
  "win": "to be victorious",
  "offer": "to propose or give",
  "remember": "to recall from memory",
  "love": "to care deeply for",
  "consider": "to think about",
  "appear": "to become visible",
  "buy": "to purchase with money",
  "wait": "to pause for someone",
  "serve": "to assist customers",
  "die": "to cease living",
  "send": "to transmit or mail",
  "expect": "to anticipate",
  "build": "to construct or make",
  "stay": "to remain in place",
  "fall": "to drop down",
  "cut": "to divide with knife",
  "reach": "to arrive at or touch",
  "kill": "to cause death",
  "remain": "to stay behind",
  "suggest": "to propose an idea",
  "raise": "to lift up higher",
  "pass": "to go by or succeed",
  "sell": "to exchange for money",
  "require": "to need or demand",
  "report": "to describe or inform",
  "decide": "to make a choice",
  "pull": "to draw toward you",
  "push": "to force away",
  "throw": "to toss or hurl",
  "catch": "to grab in air",
  "hold": "to grasp or keep",
  "save": "to rescue or keep safe",
  "protect": "to keep from harm",
  "agree": "to have same opinion",
  "fail": "to not succeed",
  "hope": "to wish for something",
  "discuss": "to talk about",
  "mention": "to briefly refer to",
  "support": "to help or back",
  "face": "to confront or meet",
  "contain": "to have inside",
  "receive": "to get or accept",
  "visit": "to go see someone",
  "return": "to come back",
  "explain": "to make clear",
  "develop": "to grow or improve",
  "carry": "to hold and move",
  "break": "to split apart",
  "enjoy": "to take pleasure in",
  "fill": "to make full",
  "cover": "to put something over",
  "draw": "to create image",
  "choose": "to pick or select",
  "nod": "to move head up and down",
  "obey": "to follow rules",
  "object": "to disagree",
  "notice": "to observe or see",
  "number": "to count or label",
  "normalize": "to make normal",
  "nest": "to build a nest",
};

const posLabels: Record<string, string> = {
  "verb": "verb",
  "noun": "noun",
  "adjective": "adjective",
  "adverb": "adverb"
};

const sentences: Record<string, string> = {
  "need": "I ___ more time to finish this.",
  "want": "She ___ to travel around the world.",
  "have": "They ___ a beautiful house.",
  "be": "I ___ a teacher at this school.",
  "do": "What did you ___ yesterday?",
  "make": "He ___ to build a new app.",
  "get": "I ___ a gift for my birthday.",
  "know": "Do you ___ the answer?",
  "think": "I ___ this is a good idea.",
  "say": "What did she ___ to you?",
  "tell": "Can you ___ me a story?",
  "find": "I couldn't ___ my keys.",
  "give": "Please ___ me that book.",
  "take": "You should ___ your time.",
  "see": "Can you ___ that bird?",
  "come": "Please ___ to my party!",
  "go": "I ___ to the store yesterday.",
  "become": "She wants to ___ a doctor.",
  "leave": "I need to ___ early.",
  "put": "Please ___ the plate on the table.",
  "keep": "Please ___ your room clean.",
  "let": "Please ___ me help you.",
  "begin": "Let's ___ the meeting.",
  "seem": "You ___ tired today.",
  "help": "Can you ___ me with this?",
  "show": "Can you ___ me how to do it?",
  "hear": "I can't ___ you clearly.",
  "play": "Let's ___ soccer later.",
  "run": "I like to ___ in the morning.",
  "move": "Please ___ your chair.",
  "live": "Where do you ___?",
  "believe": "I ___ in you!",
  "bring": "Please ___ your friends.",
  "happen": "What happened ___?",
  "write": "I like to ___ stories.",
  "provide": "We will ___ food.",
  "sit": "Please ___ down here.",
  "stand": "Please ___ up straight.",
  "lose": "I don't want to ___ this game.",
  "pay": "Did you ___ the bill?",
  "meet": "Nice to ___ you!",
  "include": "Does this ___ tax?",
  "continue": "Please ___ reading.",
  "set": "Let's ___ a meeting.",
  "learn": "I want to ___ English.",
  "change": "Let's ___ the plan.",
  "lead": "Who will ___ the team?",
  "understand": "I don't ___ you.",
  "watch": "Let's ___ a movie.",
  "follow": "Please ___ the rules.",
  "stop": "Please ___ talking!",
  "create": "Let's ___ something new.",
  "speak": "Can you ___ English?",
  "read": "I like to ___ books.",
  "allow": "They ___ us to leave.",
  "add": "Please ___ sugar to the mix.",
  "spend": "I like to ___ time with family.",
  "grow": "Plants ___ in spring.",
  "open": "Please ___ the door.",
  "walk": "Let's ___ to school.",
  "win": "I hope we ___!",
  "offer": "I can ___ you some help.",
  "remember": "Please ___ to call me.",
  "love": "I ___ chocolate cake.",
  "consider": "Please ___ my proposal.",
  "appear": "She will ___ soon.",
  "buy": "I want to ___ a car.",
  "wait": "Please ___ for me.",
  "serve": "We ___ customers daily.",
  "die": "No one wants to ___.",
  "send": "Please ___ me an email.",
  "expect": "I ___ good results.",
  "build": "They want to ___ a house.",
  "stay": "Let's ___ here tonight.",
  "fall": "Leaves ___ in autumn.",
  "cut": "Please ___ the cake.",
  "reach": "Call when you ___ home.",
  "kill": "Don't ___ the plants.",
  "remain": "Please ___ seated.",
  "suggest": "I ___ we go now.",
  "raise": "Please ___ your hand.",
  "pass": "Please ___ the salt.",
  "sell": "They want to ___ their car.",
  "require": "This ___ patience.",
  "report": "Please ___ the issue.",
  "decide": "Let's ___ together.",
  "pull": "Please ___ the door.",
  "push": "Don't ___ the button.",
  "throw": "Don't ___ trash here.",
  "catch": "Can you ___ the ball?",
  "hold": "Please ___ my hand.",
  "save": "Let's ___ money.",
  "protect": "We must ___ the environment.",
  "agree": "I ___ with you.",
  "fail": "Don't ___ to try.",
  "hope": "I ___ you feel better.",
  "discuss": "Let's ___ this later.",
  "mention": "Don't ___ my name.",
  "support": "I ___ your decision.",
  "face": "Let's ___ the problem.",
  "contain": "This box ___ books.",
  "receive": "I ___ many gifts.",
  "visit": "Let's ___ grandma.",
  "return": "When will you ___?",
  "explain": "Please ___ this to me.",
  "develop": "We need to ___ skills.",
  "carry": "Please ___ this for me.",
  "break": "Don't ___ the rules!",
  "enjoy": "I ___ reading books.",
  "fill": "Please ___ the form.",
  "cover": "Please ___ the pot.",
  "draw": "Can you ___ a picture?",
  "choose": "You can ___ any one.",
  "nod": "She ___ in agreement.",
  "obey": "Children should ___ parents.",
  "object": "I ___ to this plan.",
  "notice": "Did you ___ the change?",
  "number": "Please ___ the items.",
  "normalize": "We need to ___ relations.",
};

async function regenerateLessons() {
  console.log("Fetching vocabulary...");
  const vocabResult = await pool.query(`
    SELECT id, word, level, part_of_speech, example_sentences 
    FROM vocabulary 
    ORDER BY frequency ASC
    LIMIT 800
  `);
  
  const vocabulary = vocabResult.rows;
  const b1Words = vocabulary.filter((w: any) => w.level === "B1");
  const b2Words = vocabulary.filter((w: any) => w.level === "B2");
  
  console.log(`Found ${b1Words.length} B1 and ${b2Words.length} B2 words`);
  
  const getDefinition = (word: string): string => {
    if (definitions[word]) return definitions[word];
    return `the meaning of "${word}"`;
  };

  const getSentence = (word: string): string => {
    if (sentences[word]) return sentences[word];
    return `"The word "${word}" is used in this sentence."`;
  };

  // Group words by part of speech
  const wordsByPos: Record<string, any[]> = {};
  for (const w of vocabulary) {
    const pos = w.part_of_speech || 'verb';
    if (!wordsByPos[pos]) wordsByPos[pos] = [];
    wordsByPos[pos].push(w);
  }

  const getDistractorWords = (targetWord: any, count: number): string[] => {
    const samePosWords = (wordsByPos[targetWord.part_of_speech] || []).filter((w: any) => w.id !== targetWord.id);
    const shuffled = samePosWords.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((w: any) => w.word);
  };

  const chunkSize = 8;
  
  const createLesson = (words: any[], level: string, lessonNum: number, title: string, description: string) => {
    const exercises = [];
    const numExercises = Math.min(7, words.length);
    
    for (let i = 0; i < numExercises; i++) {
      const targetWord = words[i % words.length];
      const targetDef = getDefinition(targetWord.word);
      const targetPos = posLabels[targetWord.part_of_speech] || targetWord.part_of_speech;
      const example = getSentence(targetWord.word);
      
      // Get distractor words (NOT definitions)
      const distractorWords = getDistractorWords(targetWord, 3);
      
      if (i % 2 === 0) {
        // Type: See word + definition, pick the word from options
        const options = [targetWord.word, ...distractorWords].sort(() => Math.random() - 0.5);
        
        exercises.push({
          id: `pick-${i}`,
          type: "pick_word",
          word: targetWord.word,
          partOfSpeech: targetPos,
          correctAnswer: targetWord.word,
          // Show definition so user knows what to pick
          context: targetDef,
          sentence: example,
          options,
          example
        });
      } else {
        // Type: See sentence with blank, pick correct word
        const sentenceWithBlank = example.replace(targetWord.word, "_____");
        const options = [targetWord.word, ...distractorWords].sort(() => Math.random() - 0.5);
        
        exercises.push({
          id: `fill-${i}`,
          type: "fill_blank",
          word: targetWord.word,
          partOfSpeech: targetPos,
          correctAnswer: targetWord.word,
          context: targetDef,
          sentence: sentenceWithBlank,
          options,
          example
        });
      }
    }
    
    return {
      id: `lesson-${String(lessonNum).padStart(3, "0")}`,
      title,
      description,
      level,
      type: "vocabulary",
      content: JSON.stringify({
        type: "duolingo",
        words: words.slice(0, 8).map((w: any) => ({
          id: w.id,
          word: w.word,
          partOfSpeech: posLabels[w.part_of_speech] || w.part_of_speech,
          definition: getDefinition(w.word)
        })),
        exercises
      }),
      vocabulary_ids: words.slice(0, 8).map((w: any) => w.id),
      xp_reward: 10 * exercises.length,
      estimated_minutes: 5,
      difficulty: level === "B1" ? 1 : 2
    };
  };
  
  const lessons: any[] = [];
  let lessonId = 1;
  
  const b1Titles = ["Essential Words", "Daily Actions", "Common Verbs", "Basic Concepts", "Everyday Use", "Foundation"];
  const b2Titles = ["Advanced Terms", "Complex Actions", "Professional", "Abstract Ideas", "Nuanced Use", "Expert Level"];
  
  for (let i = 0; i < b1Words.length; i += chunkSize) {
    const group = b1Words.slice(i, i + chunkSize);
    const titleIdx = Math.floor(i / chunkSize);
    lessons.push(createLesson(group, "B1", lessonId++, `B1 - ${b1Titles[titleIdx]}`, `Learn ${group.length} essential B1 words`));
  }
  
  for (let i = 0; i < b2Words.length; i += chunkSize) {
    const group = b2Words.slice(i, i + chunkSize);
    const titleIdx = Math.floor(i / chunkSize);
    lessons.push(createLesson(group, "B2", lessonId++, `B2 - ${b2Titles[titleIdx]}`, `Master ${group.length} advanced B2 words`));
  }
  
  console.log(`Generated ${lessons.length} lessons`);
  
  console.log("Clearing old lessons...");
  await pool.query("DELETE FROM lessons");
  
  console.log("Inserting new lessons...");
  for (const lesson of lessons) {
    await pool.query(
      `INSERT INTO lessons (id, title, description, level, type, content, vocabulary_ids, xp_reward, estimated_minutes, difficulty)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [lesson.id, lesson.title, lesson.description, lesson.level, lesson.type, lesson.content, lesson.vocabulary_ids, lesson.xp_reward, lesson.estimated_minutes, lesson.difficulty]
    );
  }
  
  console.log("Done!");
  await pool.end();
}

regenerateLessons().catch(console.error);