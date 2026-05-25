import Dexie, { type Table } from "dexie";
import type { Card, ReviewState } from "../types";

export interface StoredUserStats {
  id: 'singleton';
  streak: number;
  stars: number;
  streakDate: string | null;
  lastSessionDate: string | null;
}

export interface StoredUserSettings {
  id: 'singleton';
  quizSize: number;
  nativeLang: string;
  learningMode: string;
  preferWhisper: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  customBackground: string | null;
  glassEnabled: boolean;
}

export class SumitomoBenkyoDB extends Dexie {
  cards!: Table<Card>;
  reviewStates!: Table<ReviewState>;
  userStats!: Table<StoredUserStats>;
  userSettings!: Table<StoredUserSettings>;

  constructor() {
    super("SumitomoBenkyoDB");
    this.version(1).stores({
      cards: "id, createdAt, *tags, sourceUrl",
      reviewStates:
        "id, cardId, promptLang, answerLang, nextReviewAt, [cardId+promptLang+answerLang]",
    });
    this.version(2).stores({
      cards: "id, createdAt, *tags, sourceUrl, sourceLang",
      reviewStates:
        "id, cardId, promptLang, answerLang, nextReviewAt, [cardId+promptLang+answerLang]",
      userStats: "id",
      userSettings: "id",
    });
  }
}

export const db = new SumitomoBenkyoDB();
