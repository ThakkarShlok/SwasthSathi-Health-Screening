import { handleCors } from '../_shared/cors.ts';
import { getUserId } from '../_shared/auth.ts';
import { checkRateLimit, logUsage } from '../_shared/rate-limit.ts';
import { jsonResponse, errorResponse } from '../_shared/errors.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

const LANG_NAMES: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    gu: 'Gujarati',
    mr: 'Marathi',
};

Deno.serve(async (req: Request) => {
    const corsResp = handleCors(req);
    if (corsResp) return corsResp;

    const userId = await getUserId(req);
    if (!userId) return errorResponse('Unauthorized', 401, req);

    const withinLimit = await checkRateLimit(userId, 'llm');
    if (!withinLimit) return errorResponse('Rate limit exceeded — 5 recommendations per hour', 429, req);

    let body: {
        riskData?: {
            combined?: { score?: number; risk?: string; tier?: string };
            diabetes?: { risk?: string; score?: number };
            hypertension?: { risk?: string; score?: number };
            topFactors?: string[];
            topContributions?: Array<{ id: string; label: string; points: number; category: string; direction: string }>;
        };
        lang?: string;
        patientAge?: number;
        patientGender?: string;
        additionalSymptoms?: string;
        symptomsConsent?: boolean;
    };
    try {
        body = await req.json();
    } catch {
        return errorResponse('Invalid JSON body', 400, req);
    }

    const { riskData = {}, lang = 'en', patientAge, patientGender } = body;
    const language = LANG_NAMES[lang] || 'English';
    const combinedScore = riskData.combined?.score ?? 0;
    const combinedRisk = riskData.combined?.risk ?? 'unknown';
    const diabetesRisk = riskData.diabetes?.risk ?? 'unknown';
    const hypertensionRisk = riskData.hypertension?.risk ?? 'unknown';
    const topFactors = (riskData.topFactors ?? []).slice(0, 4).join(', ') || 'none listed';

    const tier = riskData.combined?.tier ?? 'baseline';
    const contributions = (riskData.topContributions ?? []).slice(0, 3);
    const contributionsLine = contributions.length > 0
        ? contributions.map(c => `${c.label} (+${c.points} pts, ${c.category})`).join('; ')
        : 'none';

    const { additionalSymptoms, symptomsConsent } = body;
    const symptomsLine = (symptomsConsent && additionalSymptoms)
        ? `\nPatient mentioned: ${additionalSymptoms.slice(0, 200)}`
        : '';

    const ageLine = patientAge ? `Age: ${patientAge}` : '';
    const genderLine = patientGender ? `Gender: ${patientGender}` : '';
    const demographics = [ageLine, genderLine].filter(Boolean).join(' | ');

    const systemPrompt =
        `You are a compassionate health awareness assistant for SwasthSathi, an Indian preventive health screening app.
Your role is to provide warm, practical, non-alarming health guidance tailored to the Indian context.
Write in ${language}. Keep the total response under 180 words.
The assessment tier is "${tier}" — one of baseline (no lab data), partial (some lab data), or enhanced (full lab data). For enhanced tier, reference specific factor magnitudes with confidence. For baseline tier, emphasize that full lab workup would improve the assessment.
Structure your response in exactly 3 short paragraphs (no bullet points, no headers):
1. What the results mean for them (encourage, don't alarm)
2. Two or three specific lifestyle tips with Indian food/activity examples
3. Clear guidance on when to see a doctor
Do not repeat the numbers from the screening data. Write conversationally.`;

    const userPrompt =
        `Health screening results for this patient:
${demographics ? demographics + '\n' : ''}Assessment tier: ${tier}
Overall risk: ${combinedRisk} (score ${combinedScore}/100)
Diabetes risk: ${diabetesRisk} | Hypertension risk: ${hypertensionRisk}
Key risk factors: ${topFactors}
Top contributions: ${contributionsLine}${symptomsLine}

Generate a personalized health recommendation.`;

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
        await logUsage(userId, 'llm', 0);
        return errorResponse('LLM not configured', 500, req);
    }

    let anthropicStatus = 502;
    try {
        const resp = await fetch(ANTHROPIC_URL, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 350,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
            }),
            signal: AbortSignal.timeout(12000),
        });

        anthropicStatus = resp.status;

        if (!resp.ok) {
            await logUsage(userId, 'llm', anthropicStatus);
            return errorResponse(`LLM error ${anthropicStatus}`, 502, req);
        }

        const data = await resp.json();
        const recommendation: string = data.content?.[0]?.text ?? '';

        await logUsage(userId, 'llm', anthropicStatus);
        return jsonResponse({ recommendation }, 200, req);
    } catch (e) {
        await logUsage(userId, 'llm', 0);
        const msg = e instanceof Error ? e.message : String(e);
        return errorResponse(`LLM request failed: ${msg}`, 502, req);
    }
});
