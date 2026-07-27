import { getCryptoMarketCap } from '@/lib/crypto-market-cap/provider';

export async function GET() {
  try { return Response.json(await getCryptoMarketCap()); }
  catch { return Response.json({ error: 'Unable to load global cryptocurrency market capitalization.' }, { status: 502 }); }
}
