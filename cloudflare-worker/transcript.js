/**
 * Cloudflare Worker to fetch YouTube transcripts
 * Deploy at: https://workers.cloudflare.com/
 * 
 * To deploy:
 * 1. Create account at cloudflare.com/workers
 * 2. Install Wrangler: npm install -g wrangler
 * 3. Run: wrangler deploy
 */

const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://inv.nadeko.net',
  'https://vid.priv.au'
];

async function getTranscript(videoId, lang = 'en') {
  // Try each Invidious instance
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`Trying ${instance}...`);
      
      // Get video info
      const infoUrl = `${instance}/api/v1/videos/${videoId}?format=json`;
      const infoResponse = await fetch(infoUrl);
      
      if (!infoResponse.ok) continue;
      
      const data = await infoResponse.json();
      const title = data.title || `Video ${videoId}`;
      
      // Get captions
      let captions = data.captions || data.subtitles || data.captionTracks || [];
      
      if (captions.length === 0) continue;
      
      // Find best matching caption
      const track = captions.find(c => c.languageCode === lang) || captions[0];
      const captionUrl = track.url || track.baseUrl;
      
      if (!captionUrl) continue;
      
      // Fetch captions
      const captionResponse = await fetch(captionUrl);
      if (!captionResponse.ok) continue;
      
      const xml = await captionResponse.text();
      
      if (!xml.includes('<text')) continue;
      
      // Parse XML
      const segments = [];
      const regex = /<text[^>]*start="([^"]+)"[^>]*dur="([^"]+)"[^>]*>([^<]+)<\/text>/gi;
      let match;
      
      while ((match = regex.exec(xml)) !== null) {
        const startMs = Math.round(parseFloat(match[1]) * 1000);
        const durMs = Math.round(parseFloat(match[2]) * 1000);
        const text = match[3]
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();
        
        if (text) {
          segments.push({
            id: `seg-${segments.length + 1}`,
            startMs,
            endMs: startMs + durMs,
            text
          });
        }
      }
      
      if (segments.length > 0) {
        return { title, segments };
      }
    } catch (e) {
      console.error(`Error: ${e.message}`);
    }
  }
  
  throw new Error('No transcript found');
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Health check
  if (path === '/health') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Transcript endpoint
  const match = path.match(/\/transcript\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    return new Response(JSON.stringify({ error: 'Invalid video ID' }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  const videoId = match[1];
  const lang = url.searchParams.get('lang') || 'en';
  
  try {
    const result = await getTranscript(videoId, lang);
    
    return new Response(JSON.stringify(result), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 404,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
