# Koto Lift

A mobile-first, offline-capable PWA for practicing English and Spanish with Japanese as the base language.

## Features

- **3-language sentence cards** (Japanese, English, Spanish)
- **Per-direction SRS-lite review system** with spaced repetition
- **Drill mode** for casual practice
- **Search & tagging** for organizing cards
- **LLM-powered "Explain Sentence"** feature via secure serverless API
- **Convert explanations into flashcards**

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Storage**: Dexie (IndexedDB)
- **PWA**: manifest.json + service worker
- **Backend**: Cloudflare Worker (Explain feature)

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Environment Variables

Create a `.env` file:

```bash
# Frontend (optional)
VITE_EXPLAIN_API_URL=/api/explain
```

## PWA Installation

1. Build the project: `npm run build`
2. Preview: `npm run preview`
3. Open in browser and add to home screen

Or deploy to Vercel/Cloudflare Pages for full PWA experience.

## Explain Feature

### Backend Setup

The Explain feature uses **Google Gemini API** (free tier: 15 requests/minute, 1500 requests/day).

#### Option 1: Vercel Deployment (Recommended)

1. Get a free Gemini API key:
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Click "Create API Key"
   - Copy your API key

2. Deploy to Vercel:

   ```bash
   npm install -g vercel
   vercel
   ```

3. Set the environment variable:

   ```bash
   vercel env add GEMINI_API_KEY
   ```

   Paste your Gemini API key when prompted.

4. Redeploy:
   ```bash
   vercel --prod
   ```

#### Option 2: Cloudflare Worker

1. Create a Cloudflare account
2. Install Wrangler: `npm install -g wrangler`
3. Create a KV namespace:
   ```bash
   wrangler kv:namespace create RATE_LIMIT
   ```
4. Add the namespace ID to `wrangler.toml`
5. Set the API key:
   ```bash
   wrangler secret put GEMINI_API_KEY
   ```
   Enter your Gemini API key when prompted.
6. Deploy:
   ```bash
   wrangler deploy
   ```

### Frontend Configuration

Update `src/components/ExplainScreen.tsx` to point to your worker URL:

```typescript
const API_URL = "https://your-worker.your-account.workers.dev/api/explain";
```

Or set `VITE_EXPLAIN_API_URL` in your `.env` file.

## Project Structure

```
src/
├── components/       # UI components
│   ├── ReviewScreen.tsx
│   ├── DrillScreen.tsx
│   ├── CardListScreen.tsx
│   ├── AddCardScreen.tsx
│   └── ExplainScreen.tsx
├── services/         # Business logic
│   ├── review.ts     # SRS-lite review engine
│   └── cards.ts      # Card CRUD operations
├── db/               # Dexie database
├── types/            # TypeScript interfaces
├── App.tsx
└── main.tsx

api/
└── explain.ts        # Cloudflare Worker

public/
├── manifest.json     # PWA manifest
└── sw.js            # Service worker
```

## Data Models

### Card

```typescript
{
  id: string;           // uuid
  jaText: string;
  enText: string;
  esText: string;
  tags: string[];
  notes?: string;
  createdAt: number;
}
```

### ReviewState

```typescript
{
  id: string;
  cardId: string;
  promptLang: "ja" | "en" | "es";
  answerLang: "ja" | "en" | "es";
  nextReviewAt: number;
  intervalDays: number;
  updatedAt: number;
}
```

## SRS-Lite Logic

- **Again**: next review in 10 minutes
- **Good**: double the interval (minimum 1 day)
- **Easy**: triple the interval (minimum 3 days)

## Limitations

- Explain feature requires internet connection
- Rate limited to 10 requests per hour per IP
- Max input length: 500 characters

## License

MIT
