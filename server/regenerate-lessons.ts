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

// English definitions + Japanese translations
const vocabData: Record<string, { en: string; ja: string }> = {
  "need": { en: "to require something", ja: "何かを必要とする" },
  "want": { en: "to desire or wish for", ja: "欲しいと思う、 wishする" },
  "have": { en: "to possess or own", ja: "持っている、所有している" },
  "be": { en: "to exist or live", ja: "存在する、~である" },
  "do": { en: "to perform an action", ja: "何かをする" },
  "make": { en: "to create or build", ja: "作る、建立する" },
  "get": { en: "to receive or obtain", ja: "受け取る、入手する" },
  "know": { en: "to have knowledge of", ja: "知っている" },
  "think": { en: "to believe or consider", ja: "思う、考える" },
  "say": { en: "to speak or utter", ja: "言う" },
  "tell": { en: "to inform or notify", ja: "教える、知らせる" },
  "find": { en: "to discover or locate", ja: "見つける" },
  "give": { en: "to offer or provide", ja: "与える、提供します" },
  "take": { en: "to grab or hold", ja: "取る、掴む" },
  "see": { en: "to view with eyes", ja: "見る" },
  "come": { en: "to arrive at a place", ja: "来る" },
  "go": { en: "to leave or move away", ja: "行く" },
  "become": { en: "to change into", ja: "~になる" },
  "leave": { en: "to go away from", ja: "去る、離れる" },
  "put": { en: "to place or set down", ja: "置く" },
  "keep": { en: "to hold or maintain", ja: "保つ、維持する" },
  "let": { en: "to allow or permit", ja: "許可する" },
  "begin": { en: "to start something", ja: "始める" },
  "seem": { en: "to appear or look", ja: "~のように見える" },
  "help": { en: "to assist or aid", ja: "助ける" },
  "show": { en: "to demonstrate or display", ja: "見せる、示す" },
  "hear": { en: "to perceive with ears", ja: "聞く（耳で）" },
  "play": { en: "to engage in fun activity", ja: "遊ぶ" },
  "run": { en: "to move quickly", ja: "走る" },
  "move": { en: "to change position", ja: "移動する" },
  "live": { en: "to reside or dwell", ja: "住む" },
  "believe": { en: "to trust or think true", ja: "信じる" },
  "bring": { en: "to carry to a place", ja: "持ってくる" },
  "happen": { en: "to occur or take place", ja: "起こる" },
  "write": { en: "to compose text", ja: "書く" },
  "provide": { en: "to supply or give", ja: "提供する" },
  "sit": { en: "to be seated", ja: "座る" },
  "stand": { en: "to be on feet", ja: "立つ" },
  "lose": { en: "to misplace something", ja: "失う、なくす" },
  "pay": { en: "to give money", ja: "支払う" },
  "meet": { en: "to encounter someone", ja: "会います" },
  "include": { en: "to contain or have", ja: "含む" },
  "continue": { en: "to keep doing", ja: "続ける" },
  "set": { en: "to arrange or place", ja: "設定する、置く" },
  "learn": { en: "to gain knowledge", ja: "学ぶ" },
  "change": { en: "to make different", ja: "変える、変更する" },
  "lead": { en: "to guide or direct", ja: "導く、リードする" },
  "understand": { en: "to comprehend", ja: "理解する" },
  "watch": { en: "to observe or view", ja: "見る（TVなど）" },
  "follow": { en: "to go behind", ja: "従う、フォローする" },
  "stop": { en: "to cease or halt", ja: "止める" },
  "create": { en: "to make or invent", ja: "作る、創造する" },
  "speak": { en: "to talk or say", ja: "話す" },
  "read": { en: "to interpret text", ja: "読む" },
  "allow": { en: "to permit or let", ja: "許可する" },
  "add": { en: "to combine or join", ja: "加える、足す" },
  "spend": { en: "to use time or money", ja: "費やす使う" },
  "grow": { en: "to increase in size", ja: "成長する" },
  "open": { en: "to unfold or reveal", ja: "開く" },
  "walk": { en: "to move on foot", ja: "歩く" },
  "win": { en: "to be victorious", ja: "勝つ" },
  "offer": { en: "to propose or give", ja: "提案する、提供します" },
  "remember": { en: "to recall from memory", ja: "覚えている" },
  "love": { en: "to care deeply for", ja: "愛している" },
  "consider": { en: "to think about", ja: "考える" },
  "appear": { en: "to become visible", ja: "現れる" },
  "buy": { en: "to purchase with money", ja: "買う" },
  "wait": { en: "to pause for someone", ja: "待つ" },
  "serve": { en: "to assist customers", ja: "サービスを提供する" },
  "die": { en: "to cease living", ja: "死ぬ" },
  "send": { en: "to transmit or mail", ja: "送る" },
  "expect": { en: "to anticipate", ja: "期待する" },
  "build": { en: "to construct or make", ja: "建設する、建てる" },
  "stay": { en: "to remain in place", ja: "stayする、留まる" },
  "fall": { en: "to drop down", ja: "落ちる" },
  "cut": { en: "to divide with knife", ja: "切る" },
  "reach": { en: "to arrive at or touch", ja: "到着する、到達する" },
  "kill": { en: "to cause death", ja: "殺す" },
  "remain": { en: "to stay behind", ja: "残りのこる" },
  "suggest": { en: "to propose an idea", ja: "提案する" },
  "raise": { en: "to lift up higher", ja: "上げる、高める" },
  "pass": { en: "to go by or succeed", ja: "通る、成功する" },
  "sell": { en: "to exchange for money", ja: "売る" },
  "require": { en: "to need or demand", ja: "必要とする" },
  "report": { en: "to describe or inform", ja: "報告する" },
  "decide": { en: "to make a choice", ja: "決める" },
  "pull": { en: "to draw toward you", ja: "引く" },
  "push": { en: "to force away", ja: "押す" },
  "throw": { en: "to toss or hurl", ja: "投げる" },
  "catch": { en: "to grab in air", ja: "キャッチする、掴む" },
  "hold": { en: "to grasp or keep", ja: "保持する、掴む" },
  "save": { en: "to rescue or keep safe", ja: "助ける、セーブする" },
  "protect": { en: "to keep from harm", ja: "守る" },
  "agree": { en: "to have same opinion", ja: "同意する" },
  "fail": { en: "to not succeed", ja: "失敗する" },
  "hope": { en: "to wish for something", ja: "望む" },
  "discuss": { en: "to talk about", ja: "議論する" },
  "mention": { en: "to briefly refer to", ja: "言及する" },
  "support": { en: "to help or back", ja: "サポートする" },
  "face": { en: "to confront or meet", ja: "直面する" },
  "contain": { en: "to have inside", ja: "含まれている" },
  "receive": { en: "to get or accept", ja: "受け取る" },
  "visit": { en: "to go see someone", ja: "訪問する" },
  "return": { en: "to come back", ja: "戻る、返す" },
  "explain": { en: "to make clear", ja: "説明する" },
  "develop": { en: "to grow or improve", ja: "開発する、伸ばす" },
  "carry": { en: "to hold and move", ja: "運ぶ" },
  "break": { en: "to split apart", ja: "壊す" },
  "enjoy": { en: "to take pleasure in", ja: "楽しむ" },
  "fill": { en: "to make full", ja: "満たす、埋める" },
  "cover": { en: "to put something over", ja: "カバーする、覆う" },
  "draw": { en: "to create image", ja: "描く" },
  "choose": { en: "to pick or select", ja: "選ぶ" },
  "nod": { en: "to move head up and down", ja: "うなずく" },
  "obey": { en: "to follow rules", ja: "従う" },
  "object": { en: "to disagree", ja: "異議を唱える" },
  "notice": { en: "to observe or see", ja: "気づく、気がつく" },
  "number": { en: "to count or label", ja: "番号をつける、数える" },
  "normalize": { en: "to make normal", ja: "正常にする" },
  "nest": { en: "to build a nest", ja: "nestを作る" },
  "strain": { en: "to exert force on something", ja: "緊張させる、頑張る" },
  "strangle": { en: "to squeeze someone's throat", ja: "絞め殺す" },
  "strap": { en: "to fasten with a strap", ja: "ストラップで止める" },
};

// Real example sentences with blank
const sentences: Record<string, string> = {
  "need": "I ___ more time to finish this project.",
  "want": "She ___ to learn Japanese.",
  "have": "They ___ a big house.",
  "be": "I ___ a student.",
  "do": "What did you ___ yesterday?",
  "make": "He wants to ___ a cake.",
  "get": "I ___ a new phone.",
  "know": "Do you ___ the answer?",
  "think": "I ___ this is good.",
  "say": "What did she ___?",
  "tell": "Can you ___ me the truth?",
  "find": "I can't ___ my keys.",
  "give": "Please ___ me a chance.",
  "take": "You should ___ your time.",
  "see": "I want to ___ the movie.",
  "come": "Please ___ to my house.",
  "go": "I ___ to school every day.",
  "become": "She wants to ___ a doctor.",
  "leave": "I need to ___ early.",
  "put": "Please ___ the book on the table.",
  "keep": "Please ___ your room clean.",
  "let": "Please ___ me help you.",
  "begin": "Let's ___ the lesson.",
  "seem": "You ___ tired today.",
  "help": "Can you ___ me?",
  "show": "Can you ___ me how?",
  "hear": "I want to ___ the song.",
  "play": "Let's ___ soccer.",
  "run": "I like to ___ in the morning.",
  "move": "Please ___ your chair.",
  "live": "Where do you ___?",
  "believe": "I ___ in you.",
  "bring": "Please ___ your friend.",
  "happen": "What will ___ next?",
  "write": "I like to ___ stories.",
  "provide": "We will ___ food.",
  "sit": "Please ___ down.",
  "stand": "Please ___ up.",
  "lose": "Don't ___ hope.",
  "pay": "Please ___ the bill.",
  "meet": "Nice to ___ you!",
  "include": "Does this ___ me?",
  "continue": "Please ___ reading.",
  "set": "Let's ___ a goal.",
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
  "allow": "They ___ us to go.",
  "add": "Please ___ some sugar.",
  "spend": "I like to ___ time with family.",
  "grow": "Plants ___ in spring.",
  "open": "Please ___ the door.",
  "walk": "Let's ___ to school.",
  "win": "I hope we ___.",
  "offer": "I can ___ you help.",
  "remember": "Please ___ to call me.",
  "love": "I ___ chocolate.",
  "consider": "Please ___ my advice.",
  "appear": "She will ___ soon.",
  "buy": "I want to ___ a car.",
  "wait": "Please ___ for me.",
  "serve": "We ___ customers.",
  "die": "No one wants to ___.",
  "send": "Please ___ me an email.",
  "expect": "I ___ success.",
  "build": "They want to ___ a house.",
  "stay": "Let's ___ here.",
  "fall": "Leaves ___ in autumn.",
  "cut": "Please ___ the cake.",
  "reach": "Call when you ___ home.",
  "kill": "Don't ___ time.",
  "remain": "Please ___ seated.",
  "suggest": "I ___ we try again.",
  "raise": "Please ___ your hand.",
  "pass": "Please ___ the test.",
  "sell": "They want to ___ their car.",
  "require": "This ___ patience.",
  "report": "Please ___ the problem.",
  "decide": "Let's ___ together.",
  "pull": "Please ___ the door.",
  "push": "Don't ___ the button.",
  "throw": "Don't ___ trash.",
  "catch": "Can you ___ the ball?",
  "hold": "Please ___ my hand.",
  "save": "Let's ___ money.",
  "protect": "We must ___ nature.",
  "agree": "I ___ with you.",
  "fail": "Don't ___ to try.",
  "hope": "I ___ you feel better.",
  "discuss": "Let's ___ later.",
  "mention": "Don't ___ my name.",
  "support": "I ___ you.",
  "face": "Let's ___ the problem.",
  "contain": "This box ___ books.",
  "receive": "I ___ many emails.",
  "visit": "Let's ___ grandma.",
  "return": "When will you ___?",
  "explain": "Please ___ this.",
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
  "strain": "Don't ___ your eyes.",
  "strangle": "Don't ___ the cat!",
  "strap": "Please ___ the bag shut.",
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
  
  const getVocab = (word: string) => {
    if (vocabData[word]) return vocabData[word];
    return { en: `the meaning of "${word}"`, ja: `"${word}"の意味` };
  };

  const getSentence = (word: string): string => {
    if (sentences[word]) return sentences[word];
    return `The word "${word}" is used in this sentence: ____`;
  };

  // Group words by part of speech for distractors
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
      const vocab = getVocab(targetWord.word);
      const example = getSentence(targetWord.word);
      const posLabel = targetWord.part_of_speech || 'verb';
      
      // Get distractor words (NOT definitions)
      const distractorWords = getDistractorWords(targetWord, 3);
      
      // Include CORRECT answer + distractors, then shuffle
      const allOptions = [targetWord.word, ...distractorWords].sort(() => Math.random() - 0.5);
      
      if (i % 2 === 0) {
        // Type: See word, see definition, pick the word
        exercises.push({
          id: `pick-${i}`,
          type: "pick_word",
          word: targetWord.word,
          partOfSpeech: posLabel,
          english: vocab.en,
          japanese: vocab.ja,
          correctAnswer: targetWord.word,
          sentence: example,
          options: allOptions, // Includes correct answer!
        });
      } else {
        // Type: Fill in the blank
        const sentenceWithBlank = example.replace(targetWord.word, "_____");
        exercises.push({
          id: `fill-${i}`,
          type: "fill_blank",
          word: targetWord.word,
          partOfSpeech: posLabel,
          english: vocab.en,
          japanese: vocab.ja,
          correctAnswer: targetWord.word,
          sentence: sentenceWithBlank,
          options: allOptions, // Includes correct answer!
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
        words: words.slice(0, 8).map((w: any) => {
          const v = getVocab(w.word);
          return {
            id: w.id,
            word: w.word,
            partOfSpeech: w.part_of_speech || 'verb',
            english: v.en,
            japanese: v.ja
          };
        }),
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