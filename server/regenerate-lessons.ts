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

async function regenerateLessons() {
  console.log("Fetching vocabulary...");
  const vocabResult = await pool.query(`
    SELECT id, word, level, part_of_speech, example_sentences 
    FROM vocabulary 
    ORDER BY frequency ASC
    LIMIT 500
  `);
  
  const vocabulary = vocabResult.rows;
  const b1Words = vocabulary.filter((w: any) => w.level === "B1");
  const b2Words = vocabulary.filter((w: any) => w.level === "B2");
  
  console.log(`Found ${b1Words.length} B1 and ${b2Words.length} B2 words`);
  
  const chunkSize = 8;
  
  // Simple definitions for common words (since we don't have translations)
  const definitions: Record<string, string> = {
    "verb": "action word",
    "noun": "person, place, or thing",
    "adjective": "describes a noun",
    "adverb": "describes a verb",
    "need": "to require something",
    "want": "to desire something",
    "have": "to possess",
    "be": "to exist",
    "do": "to perform an action",
    "make": "to create",
    "get": "to receive",
    "know": "to understand",
    "think": "to believe",
    "say": "to speak",
    "tell": "to inform",
    "find": "to discover",
    "give": "to offer",
    "take": "to grab",
    "see": "to view",
    "come": "to arrive",
    "go": "to leave",
    "become": "to turn into",
    "leave": "to go away",
    "put": "to place",
    "keep": "to hold",
    "let": "to allow",
    "begin": "to start",
    "seem": "to appear",
    "help": "to assist",
    "show": "to demonstrate",
    "hear": "to listen",
    "play": "to have fun",
    "run": "to move fast",
    "move": "to change position",
    "live": "to reside",
    "believe": "to trust",
    "bring": "to carry",
    "happen": "to occur",
    "write": "to compose",
    "provide": "to supply",
    "sit": "to be seated",
    "stand": "to be upright",
    "lose": "to misplace",
    "pay": "to give money",
    "meet": "to encounter",
    "include": "to contain",
    "continue": "to keep going",
    "set": "to arrange",
    "learn": "to gain knowledge",
    "change": "to modify",
    "lead": "to guide",
    "understand": "to comprehend",
    "watch": "to observe",
    "follow": "to pursue",
    "stop": "to halt",
    "create": "to make",
    "speak": "to talk",
    "read": "to interpret text",
    "allow": "to permit",
    "add": "to combine",
    "spend": "to use time/money",
    "grow": "to increase",
    "open": "to unfold",
    "walk": "to move on foot",
    "win": "to succeed",
    "offer": "to propose",
    "remember": "to recall",
    "love": "to care deeply",
    "consider": "to think about",
    "appear": "to show up",
    "buy": "to purchase",
    "wait": "to pause",
    "serve": "to assist",
    "die": "to cease living",
    "send": "to transmit",
    "expect": "to anticipate",
    "build": "to construct",
    "stay": "to remain",
    "fall": "to drop",
    "cut": "to divide",
    "reach": "to arrive at",
    "kill": "to cause death",
    "remain": "to stay",
    "suggest": "to propose",
    "raise": "to lift",
    "pass": "to go by",
    "sell": "to exchange for money",
    "require": "to need",
    "report": "to describe",
    "decide": "to make a choice",
    "pull": "to draw toward",
  };

  const getDefinition = (word: string, pos: string): string => {
    if (definitions[word]) return definitions[word];
    return `${pos}: ${word}`;
  };
  
  const createLesson = (words: any[], level: string, lessonNum: number, title: string, description: string) => {
    const exercises = [];
    const numExercises = 7;
    
    for (let i = 0; i < numExercises; i++) {
      const targetWord = words[i % words.length];
      const definition = getDefinition(targetWord.word, targetWord.part_of_speech);
      
      if (i % 4 === 0) {
        // Type 1: See word, pick meaning
        const otherWords = words.filter((w: any) => w.id !== targetWord.id).slice(0, 3);
        const options = [
          { word: targetWord.word, meaning: definition },
          ...otherWords.map((w: any) => ({ word: w.word, meaning: getDefinition(w.word, w.part_of_speech) }))
        ].sort(() => Math.random() - 0.5);
        
        exercises.push({
          id: `meaning-${i}`,
          type: "multiple_choice_meaning",
          question: `What does "${targetWord.word}" mean?`,
          correctAnswer: definition,
          options: options.map((o: any) => o.meaning),
          word: targetWord.word
        });
      } else if (i % 4 === 1) {
        // Type 2: See meaning, pick word
        const otherWords = words.filter((w: any) => w.id !== targetWord.id).slice(0, 3);
        const options = [targetWord, ...otherWords].sort(() => Math.random() - 0.5);
        
        exercises.push({
          id: `word-${i}`,
          type: "multiple_choice_word",
          question: `Which word means "${definition}"?`,
          correctAnswer: targetWord.word,
          options: options.map((w: any) => w.word),
          word: targetWord.word
        });
      } else if (i % 4 === 2) {
        // Type 3: Complete the sentence
        const sentence = `I ___ to ${targetWord.word} every day.`;
        
        const otherWords = words.filter((w: any) => w.id !== targetWord.id).slice(0, 3);
        const options = [targetWord.word, ...otherWords.map((w: any) => w.word)].sort(() => Math.random() - 0.5);
        
        exercises.push({
          id: `complete-${i}`,
          type: "fill_blank",
          question: "Complete the sentence:",
          sentence,
          correctAnswer: targetWord.word,
          options,
          word: targetWord.word
        });
      } else {
        // Type 4: Is this correct?
        const isCorrect = Math.random() > 0.5;
        const sentence = isCorrect 
          ? `"She ${targetWord.word}s every morning."`
          : `"She ${targetWord.word} yesterday."`; // Wrong tense for demo
        
        exercises.push({
          id: `judge-${i}`,
          type: "true_false",
          question: "Is this sentence correct?",
          sentence,
          correctAnswer: isCorrect ? "true" : "false",
          word: targetWord.word
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
          partOfSpeech: w.part_of_speech,
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