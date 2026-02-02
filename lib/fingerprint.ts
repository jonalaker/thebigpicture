'use client';

/**
 * Device Fingerprinting Utility
 * Creates a unique hash based on browser/device characteristics
 * Used to prevent multiple airdrop claims from the same device
 */

// Generate canvas fingerprint
function getCanvasFingerprint(): string {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return 'no-canvas';

        canvas.width = 200;
        canvas.height = 50;

        // Draw text with specific styling
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(0, 0, 100, 50);
        ctx.fillStyle = '#069';
        ctx.fillText('PINN44 Fingerprint', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('PINN44 Fingerprint', 4, 17);

        return canvas.toDataURL();
    } catch {
        return 'canvas-error';
    }
}

// Get WebGL renderer info
function getWebGLInfo(): string {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return 'no-webgl';

        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return 'no-debug-info';

        const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

        return `${vendor}~${renderer}`;
    } catch {
        return 'webgl-error';
    }
}

// Get screen info
function getScreenInfo(): string {
    return `${screen.width}x${screen.height}x${screen.colorDepth}`;
}

// Get timezone
function getTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Get browser plugins (limited in modern browsers)
function getPlugins(): string {
    try {
        const plugins = Array.from(navigator.plugins || [])
            .map(p => p.name)
            .slice(0, 5)
            .join(',');
        return plugins || 'no-plugins';
    } catch {
        return 'plugins-error';
    }
}

// Simple hash function (djb2)
function hashString(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    // Convert to hex string
    return (hash >>> 0).toString(16).padStart(8, '0');
}

// Generate full device fingerprint
export async function generateDeviceFingerprint(): Promise<string> {
    const components = [
        getCanvasFingerprint(),
        getWebGLInfo(),
        getScreenInfo(),
        getTimezone(),
        getPlugins(),
        navigator.userAgent,
        navigator.language,
        navigator.hardwareConcurrency?.toString() || '0',
        navigator.maxTouchPoints?.toString() || '0',
    ];

    // Combine all components
    const combined = components.join('|||');

    // Create hash
    const hash = hashString(combined);

    // Add a shortened canvas hash for more uniqueness
    const canvasHash = hashString(getCanvasFingerprint());

    return `${hash}-${canvasHash}`;
}

// Check if fingerprint is stored in localStorage (additional client-side check)
export function hasClaimedBefore(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('pinn44_airdrop_claimed') === 'true';
}

// Mark as claimed in localStorage
export function markAsClaimed(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('pinn44_airdrop_claimed', 'true');
}
