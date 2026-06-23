(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.ExportUtils = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function normalizeDims(dims) {
        return {
            width: Math.max(1, Math.round(Number(dims.width) || 1)),
            height: Math.max(1, Math.round(Number(dims.height) || 1))
        };
    }

    function scaleToMax(dims, maxDim) {
        const normalized = normalizeDims(dims);
        if (!Number.isFinite(maxDim) || maxDim <= 0) {
            return normalized;
        }
        if (normalized.width <= maxDim && normalized.height <= maxDim) {
            return normalized;
        }
        const scale = Math.min(maxDim / normalized.width, maxDim / normalized.height);
        return {
            width: Math.max(1, Math.round(normalized.width * scale)),
            height: Math.max(1, Math.round(normalized.height * scale))
        };
    }

    function buildExportRenderPlan(options) {
        const dims = normalizeDims(options.dims || {});
        const format = options.format === 'mp4' ? 'mp4' : 'gif';
        const isIOS = Boolean(options.isIOS);
        const isMobile = Boolean(options.isMobile || isIOS);
        const requestedFps = Math.max(1, Math.round(Number(options.fps) || (format === 'mp4' ? 24 : 15)));
        const fps = isIOS ? Math.min(requestedFps, 10) : requestedFps;
        const outputFormat = format;
        const gifMaxDim = Math.max(1, Math.round(Number(options.gifMaxDim) || 1280));
        const outputDims = format === 'gif' && isMobile ? scaleToMax(dims, gifMaxDim) : dims;

        return {
            fps,
            layoutDims: dims,
            maxFrames: isIOS ? (format === 'mp4' ? 60 : 50) : (format === 'gif' ? 100 : Infinity),
            outputDims,
            outputFormat,
            usesScaledOutput: outputDims.width !== dims.width || outputDims.height !== dims.height
        };
    }

    function buildFramePlan(options) {
        const durationMs = Math.max(1, Number(options.durationMs) || 1);
        const fps = Math.max(1, Number(options.fps) || 1);
        const maxFrames = Number.isFinite(options.maxFrames)
            ? Math.max(1, Math.floor(options.maxFrames))
            : Infinity;
        const naturalFrames = Math.max(1, Math.ceil(durationMs / 1000 * fps));
        const totalFrames = Math.min(naturalFrames, maxFrames);
        const frameDurationMs = durationMs / totalFrames;
        const frameDelayMs = Math.max(20, Math.round(frameDurationMs));

        return {
            durationMs,
            fps,
            frameDelayMs,
            frameDurationMs,
            totalFrames,
            progressAt(index) {
                if (totalFrames <= 1) return 1;
                return Math.max(0, Math.min(1, index / (totalFrames - 1)));
            }
        };
    }

    function listVideoRecorderTypes(options) {
        const isTypeSupported = options && options.isTypeSupported;
        if (typeof isTypeSupported !== 'function') {
            return [];
        }

        const mp4Candidates = [
            { mimeType: 'video/mp4', ext: 'mp4' },
            { mimeType: 'video/mp4;codecs=h264', ext: 'mp4' },
            { mimeType: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' }
        ];
        const webmCandidates = [
            { mimeType: 'video/webm;codecs=vp9', ext: 'webm' },
            { mimeType: 'video/webm;codecs=vp8', ext: 'webm' },
            { mimeType: 'video/webm', ext: 'webm' }
        ];
        const candidates = options && options.preferWebm
            ? webmCandidates.concat(mp4Candidates)
            : mp4Candidates.concat(webmCandidates);

        return candidates.filter((candidate) => {
            try {
                return isTypeSupported(candidate.mimeType);
            } catch (error) {
                return false;
            }
        });
    }

    function selectVideoRecorderType(options) {
        const profiles = listVideoRecorderTypes(options);
        return profiles.length ? profiles[0] : null;
    }

    function getExportMimeType(ext) {
        const typeMap = {
            gif: 'image/gif',
            mp4: 'video/mp4',
            png: 'image/png',
            webm: 'video/webm'
        };
        return typeMap[ext] || 'application/octet-stream';
    }

    function isUsableExportBlob(blob, options) {
        const minBytes = Math.max(1, Number(options && options.minBytes) || 1024);
        return Boolean(blob && Number(blob.size) >= minBytes);
    }

    function formatExportSize(bytes) {
        const size = Math.max(0, Math.round(Number(bytes) || 0));
        if (size < 1024) return `${size}B`;
        if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`;
        return `${(size / 1024 / 1024).toFixed(1)}MB`;
    }

    function shouldUseSystemShare(options) {
        const ext = String(options && options.ext || '').toLowerCase();
        const isMobile = Boolean(options && options.isMobile);
        return isMobile && (ext === 'mp4' || ext === 'webm' || ext === 'gif');
    }

    return {
        buildExportRenderPlan,
        buildFramePlan,
        formatExportSize,
        getExportMimeType,
        isUsableExportBlob,
        listVideoRecorderTypes,
        selectVideoRecorderType,
        shouldUseSystemShare,
        scaleToMax
    };
}));
