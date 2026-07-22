import { createAdminClient } from './supabase-admin.ts';

// 'rag' = Phase 4 guideline-chat. Kept separate from 'llm' so assistant
// questions don't consume the recommendation budget and so RAG spend is
// attributable on its own. NOTE: an api_name missing from this map is NOT
// rate limited at all (checkRateLimit returns true) — add the key before
// shipping any new paid endpoint.
const LIMITS: Record<string, number> = { ocr: 10, llm: 5, places: 5, rag: 20 };
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function checkRateLimit(userId: string, apiName: string): Promise<boolean> {
    const limit = LIMITS[apiName];
    if (limit === undefined) return true;

    const admin = createAdminClient();
    const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();

    const { count, error } = await admin
        .from('api_usage_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('api_name', apiName)
        .gte('called_at', windowStart);

    if (error) return true; // fail open — don't block on DB error
    return (count ?? 0) < limit;
}

export async function logUsage(userId: string, apiName: string, statusCode: number): Promise<void> {
    const admin = createAdminClient();
    await admin.from('api_usage_log').insert({ user_id: userId, api_name: apiName, status_code: statusCode });
}
