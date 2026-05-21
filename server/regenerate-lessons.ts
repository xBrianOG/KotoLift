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
  "throw": "to fling through air",
  "save": "to rescue or keep safe",
  "protect": "to keep from harm",
  "agree": "to have same opinion",
  "expect": "to look forward to",
  "fail": "to not succeed",
  "hope": "to wish for something",
  "seem": "to give impression",
  "appear": "to become seen",
  "discuss": "to talk about",
  "mention": "to briefly refer to",
  "support": "to help or back",
  "face": "to confront or meet",
  "contain": "to have inside",
  "agree": "to consent or accept",
  "receive": "to get or accept",
  "visit": "to go see someone",
  "return": "to come back",
  "explain": "to make clear",
  "hope": "to want something to happen",
  "develop": "to grow or improve",
  "carry": "to hold and move",
  "break": "to split apart",
  "receive": "to be given something",
  "enjoy": "to take pleasure in",
  "fill": "to make full",
  "cover": "to put something over",
  "catch": "to grab or intercept",
  "draw": "to create image",
  "choose": "to pick or select",
};

const posLabels: Record<string, string> = {
  "verb": "verb",
  "noun": "noun",
  "adjective": "adjective",
  "adverb": "adverb"
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
  
  const getDefinition = (word: string, pos: string): string => {
    if (definitions[word]) return definitions[word];
    return `to ${word}`;
  };

  // Group words by part of speech for better distractors
  const wordsByPos: Record<string, any[]> = {};
  for (const w of vocabulary) {
    const pos = w.part_of_speech || 'verb';
    if (!wordsByPos[pos]) wordsByPos[pos] = [];
    wordsByPos[pos].push(w);
  }

  const getDistractors = (targetWord: any, count: number): string[] => {
    const pos = targetWord.part_of_speech || 'verb';
    const samePosWords = wordsByPos[pos] || [];
    
    // Get words of same level first, then others
    let poolWords = samePosWords.filter(w => w.id !== targetWord.id && w.level === targetWord.level);
    if (poolWords.length < count) {
      poolWords = [...poolWords, ...samePosWords.filter(w => w.id !== targetWord.id && w.level !== targetLevel)];
    }
    
    // Shuffle and get definitions
    const shuffled = poolWords.sort(() => Math.random() - 0.5);
    const distractors = shuffled.slice(0, count).map(w => getDefinition(w.word, w.part_of_speech));
    
    // Remove duplicates and near-duplicates
    const targetDef = getDefinition(targetWord.word, targetWord.part_of_speech);
    return distractors.filter(d => d !== targetDef && !d.includes(targetWord.word));
  };

  const chunkSize = 8;
  
  const createLesson = (words: any[], level: string, lessonNum: number, title: string, description: string) => {
    const exercises = [];
    const numExercises = Math.min(7, words.length);
    
    for (let i = 0; i < numExercises; i++) {
      const targetWord = words[i % words.length];
      const targetDef = getDefinition(targetWord.word, targetWord.part_of_speech);
      const targetPos = posLabels[targetWord.part_of_speech] || targetWord.part_of_speech;
      const example = targetWord.example_sentences?.[0]?.text || `Example: ${targetWord.word}`;
      
      // Get distractors using actual definitions
      const otherDefs = getDistractors(targetWord, 3);
      
      if (i % 3 === 0) {
        // Type: What does this word mean? (show word, pick definition)
        const options = [targetDef, ...otherDefs].sort(() => Math.random() - 0.5);
        
        exercises.push({
          id: `mean-${i}`,
          type: "meaning",
          word: targetWord.word,
          partOfSpeech: targetPos,
          question: `What does "${targetWord.word}" mean?`,
          options,
          correctAnswer: targetDef,
          example
        });
      } else if (i % 3 === 1) {
        // Type: Which word means this? (show definition, pick word)
        const otherWords = words.filter((w: any) => w.id !== targetWord.id).slice(0, 3).map((w: any) => w.word);
        const options = [targetWord.word, ...otherWords].sort(() => Math.random() - 0.5);
        
        exercises.push({
          id: `word-${i}`,
          type: "word",
          word: targetWord.word,
          partOfSpeech: targetPos,
          question: `Which word means "${targetDef}"?`,
          options,
          correctAnswer: targetWord.word,
          example
        });
      } else {
        // Type: Complete the sentence
        const otherWords = words.filter((w: any) => w.id !== targetWord.id).slice(0, 3).map((w: any) => w.word);
        const options = [targetWord.word, ...otherWords].sort(() => Math.random() - 0.5);
        const sentence = `"I ___ ${targetWord.word} every morning."`;
        
        exercises.push({
          id: `fill-${i}`,
          type: "fill",
          word: targetWord.word,
          partOfSpeech: targetPos,
          question: "Complete the sentence:",
          sentence,
          options,
          correctAnswer: targetWord.word,
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
          definition: getDefinition(w.word, w.part_of_speech)
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