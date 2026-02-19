export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/api/explain') {
      return new Response('Not found', { status: 404 });
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `rate_limit:${ip}`;
    const current = await env.RATE_LIMIT.get(rateLimitKey);
    
    if (current && parseInt(current) > 10) {
      return new Response('Rate limit exceeded', { status: 429 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const { sentence, focus } = body as { sentence?: string; focus?: string };
    
    if (!sentence || typeof sentence !== 'string' || sentence.length > 500) {
      return new Response('Invalid sentence', { status: 400 });
    }

    if (!['english', 'spanish', 'both'].includes(focus || 'both')) {
      return new Response('Invalid focus', { status: 400 });
    }

    if (current) {
      await env.RATE_LIMIT.put(rateLimitKey, (parseInt(current) + 1).toString(), { expirationTtl: 3600 });
    } else {
      await env.RATE_LIMIT.put(rateLimitKey, '1', { expirationTtl: 3600 });
    }

    const focusText = focus === 'both' ? 'English and Spanish' : focus === 'english' ? 'English' : 'Spanish';

    const systemPrompt = `You are a language tutor helping a native Japanese speaker learning English and Spanish.

Return STRICT JSON only (no markdown, no explanation):

{
  "detected_language": "ja|en|es",
  "translations": { "ja": "...", "en": "...", "es": "..." },
  "naturalness": { "score_1_to_5": number, "comment": "..." },
  "grammar_points": [
    { "title": "...", "explanation": "...", "example": "..." }
  ],
  "vocabulary": [
    { "term": "...", "meaning": "...", "notes": "..." }
  ],
  "alternatives": [
    { "tone": "neutral|casual|formal", "ja": "...", "en": "...", "es": "..." }
  ],
  "mistakes": [ "..." ],
  "suggested_flashcard": {
    "ja": "...",
    "en": "...",
    "es": "...",
    "tags": ["..."]
  }
}`;

    const userPrompt = `Explain this sentence (focus on ${focusText}):

"${sentence}"`;

    try {
      const llmResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });

      if (!llmResponse.ok) {
        const error = await llmResponse.text();
        console.error('LLM error:', error);
        return new Response('LLM error', { status: 502 });
      }

      const llmData = await llmResponse.json() as { content?: Array<{ text?: string }> };
      const text = llmData.content?.[0]?.text || '';
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return new Response('Invalid LLM response', { status: 502 });
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return new Response(JSON.stringify(parsed), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error:', error);
      return new Response('Internal error', { status: 500 });
    }
  }
};

interface Env {
  ANTHROPIC_API_KEY: string;
  RATE_LIMIT: KVNamespace;
}
