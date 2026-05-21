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
  `);
  
  const vocabulary = vocabResult.rows;
  const b1Words = vocabulary.filter((w: any) => w.level === "B1");
  const b2Words = vocabulary.filter((w: any) => w.level === "B2");
  
  console.log(`Found ${b1Words.length} B1 and ${b2Words.length} B2 words`);
  
  const chunkSize = 8;
  
  const createLesson = (words: any[], level: string, lessonNum: number, title: string, description: string) => {
    const vocabularySection = words.slice(0, 8).map((w: any) => ({
      id: w.id,
      word: w.word,
      partOfSpeech: w.part_of_speech,
      example: w.example_sentences?.[0]?.text || null
    }));
    
    const exercises = [];
    const numExercises = 6;
    
    for (let i = 0; i < numExercises; i++) {
      const targetWord = words[i % words.length];
      
      if (i % 3 === 0) {
        const otherWords = words.filter((w: any) => w.id !== targetWord.id).slice(0, 3);
        const options = [targetWord, ...otherWords].sort(() => Math.random() - 0.5);
        const posOptions = ['verb', 'noun', 'adjective', 'adverb'].filter(p => p !== targetWord.part_of_speech);
        const randomPos = posOptions[Math.floor(Math.random() * posOptions.length)];
        exercises.push({
          id: `mc-${i}`,
          type: "multiple_choice",
          question: `Which word is a ${targetWord.part_of_speech}?`,
          correctAnswer: targetWord.word,
          options: options.map((w: any) => w.word),
          vocabularyId: targetWord.id
        });
      } else if (i % 3 === 1) {
        const sentences = targetWord.example_sentences || [];
        if (sentences.length > 0) {
          const sentence = sentences[0];
          const blankedSentence = sentence.text.replace(new RegExp(targetWord.word, 'gi'), "_____");
          const otherWords = words.filter((w: any) => w.id !== targetWord.id).slice(0, 3).map((w: any) => w.word);
          const options = [targetWord.word, ...otherWords].sort(() => Math.random() - 0.5);
          exercises.push({
            id: `fill-${i}`,
            type: "fill_blank",
            sentence: blankedSentence,
            correctAnswer: targetWord.word,
            options: options,
            vocabularyId: targetWord.id
          });
        }
      } else {
        const subset = words.slice(0, Math.min(4, words.length));
        exercises.push({
          id: `match-${i}`,
          type: "match",
          pairs: subset.map((w: any) => ({ word: w.word, partOfSpeech: w.part_of_speech })),
          vocabularyIds: subset.map((w: any) => w.id)
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
        vocabulary: vocabularySection,
        exercises: exercises.filter(e => e)
      }),
      vocabulary_ids: words.slice(0, 8).map((w: any) => w.id),
      xp_reward: 10 * exercises.filter(e => e).length,
      estimated_minutes: Math.ceil(words.length / 8) * 5,
      difficulty: level === "B1" ? 1 : 2
    };
  };
  
  const lessons: any[] = [];
  let lessonId = 1;
  
  const b1Titles = ["Essential Actions", "Daily Activities", "People & Places", "Objects Around You", "Describing Things", "Communication"];
  const b2Titles = ["Advanced Actions", "Complex Ideas", "Professional Context", "Abstract Concepts", "Nuanced Expression", "Academic Words"];
  
  for (let i = 0; i < b1Words.length; i += chunkSize) {
    const group = b1Words.slice(i, i + chunkSize);
    const titleIdx = Math.floor(i / chunkSize);
    lessons.push(createLesson(group, "B1", lessonId++, `B1 - ${b1Titles[titleIdx]}`, `Learn ${group.length} essential B1 vocabulary words`));
  }
  
  for (let i = 0; i < b2Words.length; i += chunkSize) {
    const group = b2Words.slice(i, i + chunkSize);
    const titleIdx = Math.floor(i / chunkSize);
    lessons.push(createLesson(group, "B2", lessonId++, `B2 - ${b2Titles[titleIdx]}`, `Master ${group.length} advanced B2 vocabulary words`));
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