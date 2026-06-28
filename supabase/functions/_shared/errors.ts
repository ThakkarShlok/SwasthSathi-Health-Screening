import { getCorsHeaders } from './cors.ts';

export function jsonResponse(data: unknown, status = 200, req?: Request): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...(req ? getCorsHeaders(req) : {}),
        },
    });
}

export function errorResponse(message: string, status: number, req?: Request): Response {
    return jsonResponse({ error: message }, status, req);
}
