import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { getUserId } from '../_shared/auth.ts';
import { checkRateLimit, logUsage } from '../_shared/rate-limit.ts';
import { jsonResponse, errorResponse } from '../_shared/errors.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';

const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';

Deno.serve(async (req: Request) => {
    const corsResp = handleCors(req);
    if (corsResp) return corsResp;

    const userId = await getUserId(req);
    if (!userId) return errorResponse('Unauthorized', 401, req);

    const withinLimit = await checkRateLimit(userId, 'ocr');
    if (!withinLimit) return errorResponse('Rate limit exceeded — 10 scans per hour', 429, req);

    let body: { image?: string; mimeType?: string };
    try {
        body = await req.json();
    } catch {
        return errorResponse('Invalid JSON body', 400, req);
    }

    const { image, mimeType = 'image/jpeg' } = body;
    if (!image) return errorResponse('Missing image field (base64)', 400, req);

    // SHA-256 hash for cache lookup
    const imageBytes = Uint8Array.from(atob(image), (c) => c.charCodeAt(0));
    const hashBuf = await crypto.subtle.digest('SHA-256', imageBytes);
    const hash = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const admin = createAdminClient();

    // Check cache (unexpired entries only)
    const { data: cached } = await admin
        .from('ocr_cache')
        .select('extracted_json')
        .eq('image_hash', hash)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

    if (cached?.extracted_json) {
        return jsonResponse({ ...cached.extracted_json, cached: true }, 200, req);
    }

    // Call Google Cloud Vision
    const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!apiKey) return errorResponse('Vision API not configured', 500, req);

    let visionStatus = 502;
    let extracted: Record<string, string | null> = { blood_sugar: null, hba1c: null, blood_pressure: null };

    try {
        const visionResp = await fetch(`${VISION_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [{
                    image: { content: image },
                    features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
                }],
            }),
            signal: AbortSignal.timeout(8000),
        });

        visionStatus = visionResp.status;

        if (visionResp.ok) {
            const visionData = await visionResp.json();
            const fullText: string = visionData.responses?.[0]?.fullTextAnnotation?.text ?? '';
            extracted = extractMedicalValues(fullText);

            // Store in cache regardless of whether values were found
            if (fullText) {
                await admin.from('ocr_cache').upsert(
                    { image_hash: hash, extracted_json: extracted },
                    { onConflict: 'image_hash' },
                );
            }
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await logUsage(userId, 'ocr', 0);
        return errorResponse(`Vision API error: ${msg}`, 502, req);
    }

    await logUsage(userId, 'ocr', visionStatus);

    if (visionStatus !== 200) {
        return errorResponse('Vision API returned non-200', 502, req);
    }

    return jsonResponse(extracted, 200, req);
});

function extractMedicalValues(text: string): Record<string, string | null> {
    const t = text.replace(/\s+/g, ' ');

    console.log("[ocr-extract] text inputs", {
        rawTextLength: text.length,
        normalizedTextLength: t.length,
        rawTextSample: text.slice(0, 2000),
        normalizedTextSample: t.slice(0, 2000)
    });

    // Fasting / random blood glucose
    const sugarPatterns = [
        /(?:fasting[\s-]*(?:blood[\s-]*)?(?:sugar|glucose)|fasting[\s-]*plasma[\s-]*glucose)(?:\s*\([^)]*\))?.{0,40}?(\d{2,3}(?:\.\d)?)\s*(?:mg\/dl)?/i,
        /\b(?:fbs|fpg)\b(?:\s*\([^)]*\))?.{0,40}?(\d{2,3}(?:\.\d)?)\s*(?:mg\/dl)?/i,
        /(?:blood[\s-]*glucose|random[\s-]*blood[\s-]*sugar|rbs)(?:\s*\([^)]*\))?.{0,40}?(\d{2,3}(?:\.\d)?)\s*(?:mg\/dl)?/i,
        /glucose\s*[\-:]\s*(\d{2,3}(?:\.\d)?)/i,
    ];
    let blood_sugar: string | null = null;
    for (const [i, p] of sugarPatterns.entries()) {
        const m = t.match(p);
        console.log("[ocr-extract] blood_sugar pattern attempt", {
            patternIndex: i,
            patternSource: p.source,
            matched: !!m,
            matchedValue: m?.[1] ?? null,
            matchedFullString: m?.[0] ?? null
        });
        if (m) { blood_sugar = m[1]; break; }
    }

    // HbA1c
    const hba1cPattern = /(?:hba1c|glycated[\s-]*h[ae]moglobin|a1c|glyco?h[ae]moglobin)(?:\s*\([^)]*\))?.{0,40}?(\d{1,2}\.\d)\s*%?/i;
    const hba1cMatch = t.match(hba1cPattern);
    console.log("[ocr-extract] hba1c pattern attempt", {
        patternIndex: 0,
        patternSource: hba1cPattern.source,
        matched: !!hba1cMatch,
        matchedValue: hba1cMatch?.[1] ?? null,
        matchedFullString: hba1cMatch?.[0] ?? null
    });
    const hba1c = hba1cMatch?.[1] ?? null;

    // Blood pressure
    const bpPatterns = [
        /(?:bp|blood[\s-]*pressure)\s*:?\s*(\d{2,3}\/\d{2,3})/i,
        /(\d{3}\/\d{2,3})\s*(?:mmhg|mm[\s]*hg)/i,
        /systolic\s*:?\s*(\d{2,3})[\s\S]{0,40}?diastolic\s*:?\s*(\d{2,3})/i,
        /(?:bp|blood[\s-]*pressure)(?:\s*\([^)]*\))?.{0,20}?(\d{2,3}\/\d{2,3})/i,
    ];
    let blood_pressure: string | null = null;
    for (const [i, p] of bpPatterns.entries()) {
        const m = t.match(p);
        console.log("[ocr-extract] blood_pressure pattern attempt", {
            patternIndex: i,
            patternSource: p.source,
            matched: !!m,
            matchedValue: m?.[2] ? `${m?.[1]}/${m?.[2]}` : m?.[1] ?? null,
            matchedFullString: m?.[0] ?? null
        });
        if (m) {
            blood_pressure = m[2] ? `${m[1]}/${m[2]}` : m[1];
            break;
        }
    }

    console.log("[ocr-extract] final extraction", {
        blood_sugar,
        hba1c,
        blood_pressure
    });
    return { blood_sugar, hba1c, blood_pressure };
}
