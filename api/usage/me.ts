export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Handle usage tracking
  // For now return a mock response to satisfy the frontend
  return res.status(200).json({
    minutesUsed: 0,
    month: new Date().toISOString().substring(0, 7) // YYYY-MM
  });
}
