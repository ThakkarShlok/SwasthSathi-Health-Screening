import { handleCors } from '../_shared/cors.ts';
import { getUserId } from '../_shared/auth.ts';
import { checkRateLimit, logUsage } from '../_shared/rate-limit.ts';
import { jsonResponse, errorResponse } from '../_shared/errors.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const RADIUS = 5000;
const FIELD_MASK = 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.googleMapsUri,places.regularOpeningHours';

const QUERIES: Record<string, string> = {
    diabetes: 'diabetologist',
    diabetologist: 'diabetologist',
    hypertension: 'cardiologist',
    cardiologist: 'cardiologist',
};

interface PlaceResult {
    name: string;
    vicinity: string | null;
    rating: number | null;
    reviewCount: number;
    mapsUrl: string | null;
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

    const textQuery = QUERIES[type];
    if (!textQuery) return errorResponse('Invalid type — must be diabetes or hypertension', 400, req);

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
        const googleResp = await fetch(PLACES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': FIELD_MASK,
            },
            body: JSON.stringify({
                textQuery,
                maxResultCount: 10,
                locationBias: {
                    circle: {
                        center: { latitude: latR, longitude: lngR },
                        radius: RADIUS,
                    },
                },
            }),
            signal: AbortSignal.timeout(8000),
        });
        placesStatus = googleResp.status;

        const googleData = await googleResp.json();

        if (!googleResp.ok) {
            console.error("[doctor-search] Google Places New API failure", {
                timestamp: new Date().toISOString(),
                httpStatus: placesStatus,
                googleError: googleData.error ?? null,
                googleErrorCode: googleData.error?.code ?? null,
                googleErrorMessage: googleData.error?.message ?? null,
                googleErrorStatus: googleData.error?.status ?? null,
                requestParams: { lat, lng, type },
            });
            await logUsage(userId, 'places', placesStatus);
            return errorResponse('Unable to fetch doctors at this time. Please try again.', 502, req);
        }

        const places: PlaceResult[] = (googleData.places ?? []).slice(0, 8).map(
            (p: Record<string, unknown>) => ({
                name: (p.displayName as { text?: string })?.text ?? 'Unknown',
                vicinity: (p.formattedAddress as string) ?? null,
                rating: (p.rating as number) ?? null,
                reviewCount: (p.userRatingCount as number) ?? 0,
                mapsUrl: (p.googleMapsUri as string) ?? null,
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
