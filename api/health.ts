export default async function handler(req: any, res: any) {
  return res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    env: {
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      nodeEnv: process.env.NODE_ENV,
    },
    headers: req.headers,
    url: req.url,
  });
}
