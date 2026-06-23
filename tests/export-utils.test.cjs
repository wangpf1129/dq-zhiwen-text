const assert = require('node:assert/strict');
const test = require('node:test');

const {
    buildExportRenderPlan,
    buildFramePlan,
    formatExportSize,
    getExportMimeType,
    isUsableExportBlob,
    listVideoRecorderTypes,
    selectVideoRecorderType,
    shouldUseSystemShare
} = require('../export-utils.js');

test('iOS video export keeps MP4 format and requested dimensions', () => {
    const plan = buildExportRenderPlan({
        dims: { width: 1080, height: 1440 },
        format: 'mp4',
        fps: 24,
        isIOS: true
    });

    assert.deepEqual(plan.layoutDims, { width: 1080, height: 1440 });
    assert.deepEqual(plan.outputDims, { width: 1080, height: 1440 });
    assert.equal(plan.outputFormat, 'mp4');
    assert.equal(plan.fps, 10);
    assert.equal(plan.maxFrames, 60);
    assert.equal(plan.usesScaledOutput, false);
});

test('mobile GIF export uses album-safe dimensions while keeping requested layout', () => {
    const plan = buildExportRenderPlan({
        dims: { width: 1080, height: 1440 },
        format: 'gif',
        fps: 15,
        isMobile: true
    });

    assert.deepEqual(plan.layoutDims, { width: 1080, height: 1440 });
    assert.deepEqual(plan.outputDims, { width: 960, height: 1280 });
    assert.equal(plan.outputFormat, 'gif');
    assert.equal(plan.fps, 15);
    assert.equal(plan.maxFrames, 100);
    assert.equal(plan.usesScaledOutput, true);
});

test('mobile 4K GIF export scales to album-safe dimensions', () => {
    const plan = buildExportRenderPlan({
        dims: { width: 2160, height: 3840 },
        format: 'gif',
        fps: 15,
        isMobile: true
    });

    assert.deepEqual(plan.layoutDims, { width: 2160, height: 3840 });
    assert.deepEqual(plan.outputDims, { width: 720, height: 1280 });
    assert.equal(plan.outputFormat, 'gif');
    assert.equal(plan.usesScaledOutput, true);
});

test('frame plan preserves duration when capped to fewer mobile frames', () => {
    const plan = buildFramePlan({ durationMs: 8340, fps: 10, maxFrames: 50 });

    assert.equal(plan.totalFrames, 50);
    assert.equal(plan.frameDelayMs, 167);
    assert.equal(plan.frameDurationMs, 166.8);
    assert.equal(plan.progressAt(0), 0);
    assert.equal(plan.progressAt(49), 1);
    assert.equal(Math.round(plan.frameDurationMs * plan.totalFrames), 8340);
});

test('video recorder prefers playable MP4 before webm fallback', () => {
    const supported = new Set(['video/mp4', 'video/webm;codecs=vp9']);
    const profile = selectVideoRecorderType({
        isTypeSupported: (mimeType) => supported.has(mimeType)
    });

    assert.deepEqual(profile, { mimeType: 'video/mp4', ext: 'mp4' });
});

test('video recorder exposes all supported profiles for retry', () => {
    const supported = new Set(['video/mp4', 'video/webm;codecs=vp8']);
    const profiles = listVideoRecorderTypes({
        isTypeSupported: (mimeType) => supported.has(mimeType)
    });

    assert.deepEqual(profiles, [
        { mimeType: 'video/mp4', ext: 'mp4' },
        { mimeType: 'video/webm;codecs=vp8', ext: 'webm' }
    ]);
});

test('video recorder can prefer webm for non-iOS mobile retry order', () => {
    const supported = new Set(['video/mp4', 'video/webm;codecs=vp8']);
    const profiles = listVideoRecorderTypes({
        isTypeSupported: (mimeType) => supported.has(mimeType),
        preferWebm: true
    });

    assert.deepEqual(profiles, [
        { mimeType: 'video/webm;codecs=vp8', ext: 'webm' },
        { mimeType: 'video/mp4', ext: 'mp4' }
    ]);
});

test('video recorder uses webm when MP4 recording is unavailable', () => {
    const supported = new Set(['video/webm;codecs=vp8']);
    const profile = selectVideoRecorderType({
        isTypeSupported: (mimeType) => supported.has(mimeType)
    });

    assert.deepEqual(profile, { mimeType: 'video/webm;codecs=vp8', ext: 'webm' });
});

test('video recorder reports no native profile when recording types are unavailable', () => {
    const profile = selectVideoRecorderType({
        isTypeSupported: () => false
    });

    assert.equal(profile, null);
});

test('export mime type maps video extensions to browser-shareable files', () => {
    assert.equal(getExportMimeType('mp4'), 'video/mp4');
    assert.equal(getExportMimeType('webm'), 'video/webm');
    assert.equal(getExportMimeType('gif'), 'image/gif');
});

test('export blob validity rejects empty recorder output', () => {
    assert.equal(isUsableExportBlob({ size: 0 }), false);
    assert.equal(isUsableExportBlob({ size: 512 }), false);
    assert.equal(isUsableExportBlob({ size: 2048 }), true);
});

test('export size formatting does not round tiny files to 0MB', () => {
    assert.equal(formatExportSize(0), '0B');
    assert.equal(formatExportSize(512), '512B');
    assert.equal(formatExportSize(2048), '2KB');
    assert.equal(formatExportSize(1024 * 1024), '1.0MB');
});

test('system share is used for mobile video and GIF files', () => {
    assert.equal(shouldUseSystemShare({ ext: 'mp4', isMobile: true }), true);
    assert.equal(shouldUseSystemShare({ ext: 'webm', isMobile: true }), true);
    assert.equal(shouldUseSystemShare({ ext: 'gif', isMobile: true }), true);
    assert.equal(shouldUseSystemShare({ ext: 'mp4', isMobile: false }), false);
});
