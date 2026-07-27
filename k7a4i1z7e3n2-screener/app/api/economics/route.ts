import { getEconomics } from '@/lib/worldbank/client';
export async function GET() {
  try { return Response.json(await getEconomics()); }
  catch { return Response.json({ error: 'Unable to load economic data.' }, { status: 502 }); }
}
