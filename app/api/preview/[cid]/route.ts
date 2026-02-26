import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// MIME types allowed through the proxy
const ALLOWED_MIME_TYPES = new Set([
    // Images
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    // Video
    'video/mp4',
    'video/webm',
    'video/ogg',
    // Documents
    'application/pdf',
    // Text & Archives
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
    // Common document formats
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

// CID validation: base32, base58, or CIDv1
const CID_REGEX = /^[a-zA-Z0-9]+$/;

const GATEWAY_BASE = 'https://gateway.lighthouse.storage/ipfs';

function getCspForType(contentType: string): string {
    // PDFs need the browser's built-in viewer which requires scripts
    if (contentType === 'application/pdf') {
        return "default-src 'self'; script-src 'unsafe-inline' 'unsafe-eval' blob:; style-src 'unsafe-inline'; object-src 'self'; frame-src 'self'";
    }
    // Everything else stays locked down
    return "default-src 'none'; style-src 'unsafe-inline'";
}

function getSecurityHeaders(contentType: string, contentLength?: string): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': getCspForType(contentType),
        'Cache-Control': 'public, max-age=3600, immutable',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'no-referrer',
        'Access-Control-Allow-Origin': '*',
    };
    if (contentLength) {
        headers['Content-Length'] = contentLength;
    }
    return headers;
}

// HEAD — used by the frontend to detect MIME type before rendering
export async function HEAD(
    _request: NextRequest,
    { params }: { params: Promise<{ cid: string }> }
) {
    const { cid } = await params;

    if (!CID_REGEX.test(cid)) {
        return new NextResponse(null, { status: 400, statusText: 'Invalid CID' });
    }

    try {
        const headRes = await fetch(`${GATEWAY_BASE}/${cid}`, { method: 'HEAD' });

        if (!headRes.ok) {
            return new NextResponse(null, { status: headRes.status, statusText: 'Gateway error' });
        }

        const contentType = (headRes.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
        const contentLength = headRes.headers.get('content-length') || undefined;

        if (!ALLOWED_MIME_TYPES.has(contentType)) {
            return new NextResponse(null, {
                status: 415,
                statusText: 'Unsupported file type',
                headers: { 'X-Detected-Type': contentType },
            });
        }

        return new NextResponse(null, {
            status: 200,
            headers: getSecurityHeaders(contentType, contentLength),
        });
    } catch (err) {
        console.error('[Preview HEAD] Error:', err);
        return new NextResponse(null, { status: 502, statusText: 'Gateway unreachable' });
    }
}

// GET — streams the file from Lighthouse to the browser
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ cid: string }> }
) {
    const { cid } = await params;

    if (!CID_REGEX.test(cid)) {
        return NextResponse.json({ error: 'Invalid CID format' }, { status: 400 });
    }

    try {
        // Step 1: HEAD to validate MIME type first (lightweight check)
        const headRes = await fetch(`${GATEWAY_BASE}/${cid}`, { method: 'HEAD' });

        if (!headRes.ok) {
            return NextResponse.json(
                { error: `Gateway returned ${headRes.status}` },
                { status: headRes.status }
            );
        }

        const contentType = (headRes.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
        const totalSize = headRes.headers.get('content-length');

        if (!ALLOWED_MIME_TYPES.has(contentType)) {
            return NextResponse.json(
                { error: 'File type not allowed for preview', detectedType: contentType },
                { status: 415 }
            );
        }

        // Step 2: Build the fetch headers, forwarding Range if present
        const fetchHeaders: Record<string, string> = {};
        const rangeHeader = request.headers.get('range');

        if (rangeHeader) {
            fetchHeaders['Range'] = rangeHeader;
        }

        // Step 3: Fetch the actual file (streamed)
        const fileRes = await fetch(`${GATEWAY_BASE}/${cid}`, {
            method: 'GET',
            headers: fetchHeaders,
        });

        if (!fileRes.ok && fileRes.status !== 206) {
            return NextResponse.json(
                { error: `Gateway fetch failed: ${fileRes.status}` },
                { status: fileRes.status }
            );
        }

        // Step 4: Build response headers
        const isPartial = fileRes.status === 206;
        const responseHeaders = getSecurityHeaders(contentType);

        // Forward range-related headers for video seeking
        if (isPartial) {
            const contentRange = fileRes.headers.get('content-range');
            if (contentRange) {
                responseHeaders['Content-Range'] = contentRange;
            }
            const partialLength = fileRes.headers.get('content-length');
            if (partialLength) {
                responseHeaders['Content-Length'] = partialLength;
            }
        } else if (totalSize) {
            responseHeaders['Content-Length'] = totalSize;
        }

        // For videos, allow range requests
        if (contentType.startsWith('video/')) {
            responseHeaders['Accept-Ranges'] = 'bytes';
        }

        // Step 5: Stream the body through — never buffer the full file
        const body = fileRes.body;

        return new NextResponse(body, {
            status: isPartial ? 206 : 200,
            headers: responseHeaders,
        });
    } catch (err) {
        console.error('[Preview GET] Error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch file from gateway' },
            { status: 502 }
        );
    }
}
