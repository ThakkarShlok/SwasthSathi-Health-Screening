import { handleCors } from '../_shared/cors.ts';
import { getUserId } from '../_shared/auth.ts';
import { checkRateLimit, logUsage } from '../_shared/rate-limit.ts';
import { jsonResponse, errorResponse } from '../_shared/errors.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';

const PLACES_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const RADIUS = 5000;

const KEYWORDS: Record<string, string> = {
    diabetes: 'diabetologist endocrinologist diabetes specialist',
    hypertension: 'cardiologist heart specialist hypertension physician',
};

interface PlaceResult {
    name: string;
    vicinity: string | null;
    rating: number | null;
    reviewCount: number;
    placeId: string;
    mapsUrl: string;
}

Deno.serve(async (req: Request) => {
    const corsResp = handleCors(req);
    if (corsResp) return corsResp;

    const userId = await getUserId(req);
    if (!userId) return errorResponse('Unauthorized', 401, req);

    const withinLimit = await checkRateLimit(userId, 'places');
    if (!withinLimit) return errorResponse('Rate limit exceeded — 5 searches per hour', 429, req);

    let body: { lat?: number; lng?: number; type?: string };
    try {
        body = await req.json();
    } catch {
        return errorResponse('Invalid JSON body', 400, req);
    }

    const { lat, lng, type = 'diabetes' } = body;
    if (lat === undefined || lng === undefined) return errorResponse('Missing lat/lng', 400, req);
    if (!KEYWORDS[type]) return errorResponse('Invalid type — must be diabetes or hypertension', 400, req);

    // Round to 3dp (~110m precision) for cache key
    const latR = Math.round(lat * 1000) / 1000;
    const lngR = Math.round(lng * 1000) / 1000;
    const cacheKey = `${latR}:${lngR}:${type}`;

    const admin = createAdminClient();

    const { data: cached } = await admin
        .from('doctor_search_cache')
        .select('results_json')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

    if (cached?.results_json) {
        return jsonResponse({ places: cached.results_json as PlaceResult[], cached: true }, 200, req);
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
        await logUsage(userId, 'places', 0);
        return errorResponse('Places API not configured', 500, req);
    }

    let placesStatus = 502;
    try {
        const url = new URL(PLACES_URL);
        url.searchParams.set('location', `${latR},${lngR}`);
        url.searchParams.set('radius', String(RADIUS));
        url.searchParams.set('keyword', KEYWORDS[type]);
        url.searchParams.set('type', 'doctor');
        url.searchParams.set('key', apiKey);

        const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
        placesStatus = resp.status;

        if (!resp.ok) {
            await logUsage(userId, 'places', placesStatus);
            return errorResponse('Places API HTTP error', 502, req);
        }

        const data = await resp.json();
        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
            await logUsage(userId, 'places', 400);
            return errorResponse(`Places API status: ${data.status}`, 400, req);
        }

        const places: PlaceResult[] = (data.results ?? []).slice(0, 8).map(
            (p: Record<string, unknown>) => ({
                name: p.name as string,
                vicinity: (p.vicinity as string) ?? null,
                rating: (p.rating as number) ?? null,
                reviewCount: (p.user_ratings_total as number) ?? 0,
                placeId: p.place_id as string,
                mapsUrl: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
            }),
        );

        await admin.from('doctor_search_cache').upsert(
            { cache_key: cacheKey, results_json: places },
            { onConflict: 'cache_key' },
        );

        await logUsage(userId, 'places', placesStatus);
        return jsonResponse({ places, cached: false }, 200, req);

    } catch (e) {
        await logUsage(userId, 'places', 0);
        const msg = e instanceof Error ? e.message : String(e);
        return errorResponse(`Places request failed: ${msg}`, 502, req);
    }
});
