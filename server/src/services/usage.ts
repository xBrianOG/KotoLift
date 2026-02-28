import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

export interface UsageRecord {
  userId: string;
  month: string; // YYYY-MM
  minutesUsed: number;
  updatedAt: number;
}

const DB_FILE = './data/usage.json';

function getDbPath(): string {
  const dir = './data';
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return DB_FILE;
}

function loadUsage(): Map<string, UsageRecord> {
  try {
    if (existsSync(getDbPath())) {
      const data = JSON.parse(readFileSync(getDbPath(), 'utf-8'));
      return new Map(Object.entries(data));
    }
  } catch (e) {
    console.error('Failed to load usage:', e);
  }
  return new Map();
}

function saveUsage(records: Map<string, UsageRecord>) {
  try {
    writeFileSync(getDbPath(), JSON.stringify(Object.fromEntries(records), null, 2));
  } catch (e) {
    console.error('Failed to save usage:', e);
  }
}

function makeKey(userId: string, month: string): string {
  return `${userId}:${month}`;
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function logUsage(userId: string, minutesDelta: number): UsageRecord {
  const month = getCurrentMonth();
  const key = makeKey(userId, month);
  const records = loadUsage();
  
  let record = records.get(key);
  
  if (!record) {
    record = {
      userId,
      month,
      minutesUsed: 0,
      updatedAt: Date.now()
    };
  }
  
  record.minutesUsed += minutesDelta;
  record.updatedAt = Date.now();
  
  records.set(key, record);
  saveUsage(records);
  
  return record;
}

export function getUsage(userId: string, month?: string): UsageRecord | null {
  const targetMonth = month || getCurrentMonth();
  const key = makeKey(userId, targetMonth);
  const records = loadUsage();
  
  return records.get(key) || null;
}

export function getUsageForMonth(userId: string, month: string): number {
  const record = getUsage(userId, month);
  return record?.minutesUsed || 0;
}
