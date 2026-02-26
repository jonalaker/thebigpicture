'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Loader2, FileText, AlertTriangle, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SecureFileViewerProps {
    ipfsUri: string;       // e.g. "ipfs://Qm..."
    isOpen: boolean;
    onClose: () => void;
}

type FileCategory = 'image' | 'video' | 'pdf' | 'text' | 'unsupported' | 'loading' | 'error';

function cidFromUri(uri: string): string | null {
    if (uri.startsWith('ipfs://')) return uri.slice(7);
    // Handle gateway URLs too
    const match = uri.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

function categorize(mime: string): FileCategory {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime === 'application/pdf') return 'pdf';
    if (mime === 'text/plain') return 'text';
    // Word docs can't be rendered in-browser natively
    return 'unsupported';
}

export function SecureFileViewer({ ipfsUri, isOpen, onClose }: SecureFileViewerProps) {
    const [category, setCategory] = useState<FileCategory>('loading');
    const [mimeType, setMimeType] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [textContent, setTextContent] = useState<string>('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const cid = cidFromUri(ipfsUri);
    const proxyUrl = cid ? `/api/preview/${cid}` : null;
    const gatewayUrl = cid ? `https://gateway.lighthouse.storage/ipfs/${cid}` : null;

    // Detect file type with a HEAD request
    const detectType = useCallback(async () => {
        if (!proxyUrl) {
            setCategory('error');
            setErrorMsg('Invalid IPFS URI');
            return;
        }

        setCategory('loading');
        setErrorMsg('');

        try {
            const res = await fetch(proxyUrl, { method: 'HEAD' });

            if (res.status === 415) {
                const detected = res.headers.get('x-detected-type') || 'unknown';
                setCategory('unsupported');
                setMimeType(detected);
                setErrorMsg(`File type "${detected}" cannot be previewed securely.`);
                return;
            }

            if (!res.ok) {
                setCategory('error');
                setErrorMsg(`Failed to load file (HTTP ${res.status})`);
                return;
            }

            const ct = (res.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
            setMimeType(ct);
            const cat = categorize(ct);
            setCategory(cat);

            // For text files, fetch the content to render inline
            if (cat === 'text' && proxyUrl) {
                try {
                    const textRes = await fetch(proxyUrl);
                    const text = await textRes.text();
                    setTextContent(text.slice(0, 500000)); // Cap at 500KB of text
                } catch {
                    setTextContent('Failed to load text content.');
                }
            }
        } catch (err) {
            console.error('Preview HEAD failed:', err);
            setCategory('error');
            setErrorMsg('Could not reach the file. The gateway may be temporarily unavailable.');
        }
    }, [proxyUrl]);

    useEffect(() => {
        if (isOpen && cid) {
            detectType();
        }
        return () => {
            // Cleanup on close
            setCategory('loading');
            setMimeType('');
            setErrorMsg('');
            setTextContent('');
            setIsFullscreen(false);
        };
    }, [isOpen, cid, detectType]);

    // Video memory cleanup
    useEffect(() => {
        return () => {
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.removeAttribute('src');
                videoRef.current.load(); // Forces the browser to release buffered data
            }
        };
    }, [isOpen]);

    // ESC key to close
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // Prevent background scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    const toggleFullscreen = () => setIsFullscreen(prev => !prev);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                ref={containerRef}
                className={`relative bg-[#1a1a2e] border border-[#8247E5]/40 rounded-xl shadow-2xl shadow-[#8247E5]/10 flex flex-col transition-all duration-300 ${isFullscreen
                    ? 'w-[98vw] h-[96vh]'
                    : 'w-[90vw] max-w-5xl h-[85vh]'
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a3e] shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-[#8247E5] shrink-0" />
                        <span className="text-sm text-foreground/60 truncate font-mono">
                            {cid ? `${cid.slice(0, 12)}…${cid.slice(-6)}` : 'Unknown'}
                        </span>
                        {mimeType && (
                            <span className="text-xs text-foreground/30 bg-[#2a2a3e] px-2 py-0.5 rounded-full shrink-0">
                                {mimeType}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleFullscreen}
                            className="text-foreground/50 hover:text-foreground"
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="text-foreground/50 hover:text-red-400"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                    {category === 'loading' && (
                        <div className="flex flex-col items-center gap-3 text-foreground/50">
                            <Loader2 className="w-10 h-10 animate-spin text-[#8247E5]" />
                            <p className="text-sm">Checking file type…</p>
                        </div>
                    )}

                    {category === 'image' && proxyUrl && (
                        <img
                            src={proxyUrl}
                            alt="Submission preview"
                            className="max-w-full max-h-full object-contain rounded-lg"
                            crossOrigin="anonymous"
                        />
                    )}

                    {category === 'pdf' && proxyUrl && (
                        <embed
                            src={proxyUrl}
                            type="application/pdf"
                            className="w-full h-full rounded-lg border border-[#2a2a3e]"
                        />
                    )}

                    {category === 'text' && (
                        <pre className="w-full h-full overflow-auto p-6 rounded-lg bg-[#121212] border border-[#2a2a3e] text-foreground/80 text-sm font-mono whitespace-pre-wrap break-words">
                            {textContent || 'Loading text content…'}
                        </pre>
                    )}

                    {category === 'video' && proxyUrl && (
                        <video
                            ref={videoRef}
                            controls
                            preload="metadata"
                            className="max-w-full max-h-full rounded-lg"
                            controlsList="nodownload"
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            <source src={proxyUrl} type={mimeType || 'video/mp4'} />
                            Your browser does not support video playback.
                        </video>
                    )}

                    {category === 'unsupported' && (
                        <div className="flex flex-col items-center gap-4 text-center max-w-md">
                            <AlertTriangle className="w-12 h-12 text-[#FFD700]" />
                            <h3 className="text-lg font-semibold text-foreground">Cannot preview this file</h3>
                            <p className="text-sm text-foreground/50">
                                {errorMsg || 'This file type is not supported for secure preview.'}
                            </p>
                            {gatewayUrl && (
                                <a
                                    href={gatewayUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-[#FFD700] hover:underline mt-2"
                                >
                                    <AlertTriangle className="w-3 h-3" />
                                    Download at your own risk
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    )}

                    {category === 'error' && (
                        <div className="flex flex-col items-center gap-4 text-center max-w-md">
                            <AlertTriangle className="w-12 h-12 text-red-400" />
                            <h3 className="text-lg font-semibold text-foreground">Failed to load</h3>
                            <p className="text-sm text-foreground/50">
                                {errorMsg || 'An unexpected error occurred.'}
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={detectType}
                                className="mt-2 border-[#8247E5]/50 hover:bg-[#8247E5]/10"
                            >
                                Retry
                            </Button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-2 border-t border-[#2a2a3e] shrink-0 flex items-center justify-between">
                    <p className="text-xs text-foreground/30">
                        🔒 Proxied through your server — file never saves to disk
                    </p>
                    {gatewayUrl && (
                        <a
                            href={gatewayUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-foreground/30 hover:text-foreground/50 flex items-center gap-1"
                        >
                            Raw IPFS <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
