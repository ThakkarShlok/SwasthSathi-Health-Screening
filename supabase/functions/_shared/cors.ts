const ALLOWED_ORIGINS = [
    'https://swasthsathi.app',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
];

export function getCorsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get('Origin') ?? '';
    const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allow,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
}

export function handleCors(req: Request): Response | null {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: getCorsHeaders(req) });
    }
    return null;
}
