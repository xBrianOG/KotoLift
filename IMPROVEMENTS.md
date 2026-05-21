# KotoLift Improvements & Technical Notes

## Current Status (May 2026)

### ✅ Completed
- **Vocabulary Seeding**: 3,317 words (1,500 B1 + 1,817 B2)
- **Lessons**: 67 lessons auto-generated
- **Conjugations**: 88 verbs with 16 tenses each
- **No External Dependencies**: Self-contained frequency list
- **RLS Policies**: Properly configured for service_role, authenticated, anon

### 🔴 Known Issues

#### 1. VERIFY_JWT - NOT APPLICABLE
- **Clarification**: VERIFY_JWT is for **Edge Functions**, not the Data API (PostgREST)
- **Current State**: No Edge Functions in this project, so this setting is irrelevant
- **No action needed** - our REST API uses the Data API, not Edge Functions

#### 2. PostgREST Service Role 403 Error
- **Symptom**: Direct `pg` connection works, but Supabase REST API with service_role key fails with 403
- **Workaround**: Using direct `pg.Pool` connection in `server/seed.ts`
- **Root Cause**: Unknown - possibly Supabase platform config or PostgREST issue

#### 3. EN→JA Translations Missing
- **Current State**: All vocabulary has `"pending": true` for translations
- **Dictionary**: No EN→JA dictionary loaded (dict file not found)
- **Data Source**: Could use JMdict/EDICT but download URLs are unreliable
- **Priority**: Low - can add later

#### 4. CEFRLex Download Broken
- **URL**: `https://cental.uclouvain.be/static/resources/en/EFLLex.tsv` returns 404
- **Status**: Source website file appears to be removed
- **Workaround**: Using embedded frequency list (3,000+ words) instead

---

## Next Steps (Priority Order)

### High Priority
1. **Re-enable VERIFY_JWT** in Supabase dashboard
2. **Investigate service_role 403** - check Supabase project settings
3. **Test API endpoints** after re-enabling VERIFY_JWT

### Medium Priority
4. **Add EN→JA translations** - find reliable dictionary source
5. **Expand vocabulary** - could add A2 level words (currently skipped)
6. **Add more example sentences** - Tatoeba cache covers ~480 words, could expand

### Low Priority
7. **Add audio pronunciations** - would need audio files
8. **Gamification features** - XP, streaks, achievements
9. **User progress tracking** - which words users have learned

---

## Technical Details

### Database Schema
- `vocabulary`: id, word, level, part_of_speech, translations (JSONB), phonetic, frequency, example_sentences (JSONB), collocations (JSONB)
- `lessons`: id, title, description, level, type, content (JSONB), vocabulary_ids (TEXT[]), difficulty
- `conjugations`: id, verb, type, translations (JSONB), tenses (JSONB), frequency

### Seed Script
- **Location**: `server/seed.ts`
- **Run command**: `cd server && npx ts-node --esm seed.ts`
- **Data source**: Embedded frequency lists (COMMON_VERBS, COMMON_NOUNS, COMMON_ADJECTIVES)
- **No external dependencies**: Works offline after initial run

### Environment Variables Required
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
PG_HOST
PG_PORT
PG_USER
PG_PASSWORD
PG_DATABASE
```

---

## Notes for Future Sessions

1. If seed fails with "column does not exist", check schema in `supabase-schema.sql` matches actual database columns
2. If PostgREST 403 returns, use direct `pg.Pool` connection instead
3. Cache files in `server/data/` are reused - delete to force re-download
4. Tatoeba sentences are matched by keyword - works best with common words