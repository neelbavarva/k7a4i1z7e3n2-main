import { getEconomics } from '@/lib/worldbank/client';
import { getAiCapitalFlow } from '@/lib/ai-capital-flow/provider';
// import { getCryptoMarketCap } from '@/lib/crypto-market-cap/provider';
import { Dashboard } from '@/components/dashboard/dashboard';

export default async function Page() {
  try {
    // Crypto Cap is intentionally parked for now. Keep the provider/module in
    // place so it can be restored without rebuilding its data architecture.
    const [economics, aiCapitalFlow] = await Promise.all([getEconomics(), getAiCapitalFlow().catch(() => null)]);
    return <Dashboard initialData={economics} initialAiCapitalFlow={aiCapitalFlow} />;
  }
  catch { return <Dashboard initialData={null} />; }
}
