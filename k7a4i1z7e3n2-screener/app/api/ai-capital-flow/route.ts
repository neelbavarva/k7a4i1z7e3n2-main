import { getAiCapitalFlow } from '@/lib/ai-capital-flow/provider';

export async function GET() {
  try { return Response.json(await getAiCapitalFlow()); }
  catch { return Response.json({ error: 'Unable to load AI capital-flow data.' }, { status: 502 }); }
}
