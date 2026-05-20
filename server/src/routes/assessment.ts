import { Router } from 'express';
import OpenAI from 'openai';

const router = Router();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const assessmentQuestions = [
  {
    id: 1,
    question: "Choose the correct word: 'I ___ to the store yesterday.'",
    options: ["go", "went", "going", "goes"],
    correctAnswer: "went",
    level: "B1"
  },
  {
    id: 2,
    question: "Which sentence is correct?",
    options: [
      "She don't like coffee.",
      "She doesn't like coffee.",
      "She not like coffee.",
      "She doesn't likes coffee."
    ],
    correctAnswer: "She doesn't like coffee.",
    level: "B1"
  },
  {
    id: 3,
    question: "Complete: 'If I ___ rich, I would travel the world.'",
    options: ["am", "was", "were", "be"],
    correctAnswer: "were",
    level: "B2"
  },
  {
    id: 4,
    question: "Choose the correct phrase: 'I'm looking forward ___ the results.'",
    options: ["to hearing", "hearing", "to hear", "hear"],
    correctAnswer: "to hearing",
    level: "B2"
  },
  {
    id: 5,
    question: "What does 'to take something for granted' mean?",
    options: [
      "To appreciate something",
      "To assume something will always be available without gratitude",
      "To grant something to someone",
      "To take something important"
    ],
    correctAnswer: "To assume something will always be available without gratitude",
    level: "B2"
  },
  {
    id: 6,
    question: "Select the correct past perfect sentence:",
    options: [
      "I have finished dinner when she called.",
      "I had finished dinner when she called.",
      "I finished dinner when she had called.",
      "I was finished dinner when she called."
    ],
    correctAnswer: "I had finished dinner when she called.",
    level: "B2"
  },
  {
    id: 7,
    question: "Choose the correct relative clause: 'The person ___ car was stolen...'",
    options: ["who", "whose", "which", "whom"],
    correctAnswer: "whose",
    level: "B1"
  },
  {
    id: 8,
    question: "Which word is the odd one out?",
    options: ["Acquire", "Obtain", "Attain", "Acquire"],
    correctAnswer: "Acquire",
    level: "B2"
  },
  {
    id: 9,
    question: "Complete: 'Despite ___ tired, she finished the project.'",
    options: ["being", "be", "been", "to be"],
    correctAnswer: "being",
    level: "B1"
  },
  {
    id: 10,
    question: "What does 'to make ends meet' mean?",
    options: [
      "To end something",
      "To barely have enough money to pay for necessities",
      "To meet people",
      "To finish a meeting"
    ],
    correctAnswer: "To barely have enough money to pay for necessities",
    level: "B2"
  }
];

router.get('/quiz', async (req, res) => {
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an English language assessment expert. Generate a 10-question English level assessment quiz. 
Questions should mix B1 and B2 level and cover:
- Grammar (verb tenses, conditionals, articles)
- Vocabulary in context
- Idioms and expressions
- Relative clauses
- Prepositions

Return a JSON array with questions. Each question should have:
- id: number (1-10)
- question: string
- options: array of 4 strings (only one correct)
- correctAnswer: string (the exact text of the correct option)
- level: "B1" or "B2"
- explanation: string (brief explanation of why this is the correct answer)

Format: {"questions": [...]}
Do NOT include the correct answer in the options in a way that makes it obvious. Make distractors plausible but clearly incorrect.`
          },
          {
            role: "user",
            content: "Generate a 10-question English level assessment quiz. Mix B1 and B2 questions. Return as JSON."
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000,
        temperature: 0.8
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return res.json(parsed);
      }
    } catch (err: any) {
      console.error('OpenAI assessment error:', err);
    }
  }

  res.json({
    questions: assessmentQuestions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
      level: q.level
    }))
  });
});

router.post('/submit', async (req, res) => {
  try {
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers array required' });
    }

    let score = 0;
    let b1Correct = 0;
    let b2Correct = 0;
    let b1Total = 0;
    let b2Total = 0;

    answers.forEach((answer: { questionId: number; answer: string }, index: number) => {
      const question = assessmentQuestions.find(q => q.id === answer.questionId);
      if (question) {
        if (question.level === 'B1') b1Total++;
        else if (question.level === 'B2') b2Total++;

        if (question.correctAnswer === answer.answer) {
          score++;
          if (question.level === 'B1') b1Correct++;
          else if (question.level === 'B2') b2Correct++;
        }
      }
    });

    const totalQuestions = assessmentQuestions.length;
    const percentage = Math.round((score / totalQuestions) * 100);

    let suggestedLevel = 'B1';
    if (percentage >= 80 && b2Correct >= b1Correct) {
      suggestedLevel = 'B2';
    } else if (percentage < 50) {
      suggestedLevel = 'B1';
    }

    res.json({
      score,
      totalQuestions,
      percentage,
      suggestedLevel,
      b1Score: { correct: b1Correct, total: b1Total },
      b2Score: { correct: b2Correct, total: b2Total }
    });
  } catch (err: any) {
    console.error('Assessment submit error:', err);
    res.status(500).json({ error: err.message || 'Failed to submit assessment' });
  }
});

export default router;