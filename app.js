class FingerprintTextApp {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.state = {
            text: '',
            colorPalette: ['#5B9BD5', '#E06666', '#93C47D', '#F6B26B', '#8E7CC3', '#76A5AF', '#D5A6BD'],
            colorMode: 'sequential',
            textLayout: 'perRidge',
            fingerprintStyle: 'whorl',
            animPattern: 'random',
            fontSize: 14,
            letterSpacing: 2,
            spiralTurns: 5,
            fingerprintSize: 350,
            ridgeDensity: 12,
            rotation: 0,
            bgType: 'white',
            bgColor: '#FFFFFF',
            gradientColor1: '#f5f7fa',
            gradientColor2: '#c3cfe2',
            bgImage: null,
            animProgress: 1,
            animSpeed: 5,
            loopAnim: true,
            isPlaying: false,
            pixelSize: 8,
            rgbOffset: 5,
            floatDensity: 30,
            gifFps: 15,
            effects: {
                crt: false, pixel: false, rgb: false, glitch: false,
                noise: false, scanline: false, vignette: false, blur: false,
                floatHearts: false, floatBokeh: false, floatSnow: false,
                floatRain: false, floatDust: false, floatParticles: false,
                stickerText: false, stickerGeo: false, stickerPaper: false,
                stickerTape: false, textureScratch: false, textureDust: false,
                textureInk: false, borderTorn: false,
                geoSlice: false, geoSplit: false, geoHole: false,
                geoShift: false, geoMosaic: false, geoBarcode: false
            }
        };

        this.animFrame = null;
        this.animStartTime = 0;
        this.floatElements = [];
        this.particles = [];
        this.stickerSeed = this.makeSeed();
        this.fingerSeed = this.makeSeed();
        this.shuffleSeed = this.makeSeed();
        this.ridgeAppearOrder = [];
        this.ridgeColorMap = [];
        this.exporting = false;
        this.exportCancel = false;
        this.cachedRidges = null;
        this.cachedRidgeParams = null;
        this._renderTimeOverride = null;
        this._scanProgressOverride = null;
        this._scanMetricsCache = null;

        this.init();
    }

    makeSeed() {
        return Math.random() * 10000;
    }

    seededRandom(seed) {
        const x = Math.sin(seed) * 43758.5453123;
        return x - Math.floor(x);
    }

    getRenderNow() {
        return this._renderTimeOverride !== null ? this._renderTimeOverride : performance.now();
    }

    isIOSDevice() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    isMobileDevice() {
        return this.isIOSDevice() || /Android|Mobile|Tablet/i.test(navigator.userAgent);
    }

    createOffscreenCanvas(dims) {
        const canvas = document.createElement('canvas');
        canvas.width = dims.width;
        canvas.height = dims.height;
        canvas.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
        document.body.appendChild(canvas);
        return canvas;
    }

    removeOffscreenCanvas(canvas) {
        if (canvas && canvas.parentNode) {
            document.body.removeChild(canvas);
        }
    }

    init() {
        this.setupCanvas();
        this.bindEvents();
        this.buildPaletteUI();
        this.generateFloatElements();
        this.render();
        this.updateExportPreview();

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
                this.cachedRidges = null;
                this.render();
            });
        }
    }

    setupCanvas() {
        const isMobile = window.innerWidth <= 768;
        const exportDims = this.getExportDimensions();
        const maxInternalDim = 1080;
        const scale = exportDims.width > maxInternalDim || exportDims.height > maxInternalDim
            ? Math.min(maxInternalDim / exportDims.width, maxInternalDim / exportDims.height)
            : 1;
        let w = Math.round(exportDims.width * scale);
        let h = Math.round(exportDims.height * scale);

        const maxCanvasPixels = 16777216;
        if (w * h > maxCanvasPixels) {
            const s = Math.sqrt(maxCanvasPixels / (w * h));
            w = Math.round(w * s);
            h = Math.round(h * s);
        }

        this.canvas.width = w;
        this.canvas.height = h;

        const vv = window.visualViewport;
        const vpW = vv ? vv.width : window.innerWidth;
        const vpH = vv ? vv.height : window.innerHeight;

        let displayW, displayH;
        if (isMobile) {
            const area = document.querySelector('.canvas-area');
            const areaW = area ? area.clientWidth : 0;
            const areaH = area ? area.clientHeight : 0;
            const maxW = areaW > 20 ? areaW - 12 : vpW - 12;
            const maxH = areaH > 20 ? areaH - 30 : vpH * 0.5;
            if (w / h > maxW / maxH) {
                displayW = maxW;
                displayH = maxW * h / w;
            } else {
                displayH = maxH;
                displayW = maxH * w / h;
            }
        } else {
            const maxW = Math.min(vpW - 340, 720);
            const maxH = Math.min(vpH - 40, 960);
            if (w / h > maxW / maxH) {
                displayW = maxW;
                displayH = maxW * h / w;
            } else {
                displayH = maxH;
                displayW = maxH * w / h;
            }
        }
        displayW = Math.max(100, Math.round(displayW));
        displayH = Math.max(100, Math.round(displayH));
        this.canvas.style.width = displayW + 'px';
        this.canvas.style.height = displayH + 'px';
        document.getElementById('canvasSize').textContent = `${w} × ${h}`;
    }

    bindEvents() {
        document.getElementById('textInput').addEventListener('input', (e) => {
            this.state.text = e.target.value;
            this.cachedRidges = null;
            this.render();
        });

        document.getElementById('colorMode').addEventListener('change', (e) => {
            this.state.colorMode = e.target.value;
            this.assignRidgeColors();
            this.render();
        });

        document.getElementById('textLayout').addEventListener('change', (e) => {
            this.state.textLayout = e.target.value;
            this.cachedRidges = null;
            this.render();
        });

        document.getElementById('fingerprintStyle').addEventListener('change', (e) => {
            this.state.fingerprintStyle = e.target.value;
            this.cachedRidges = null;
            this.render();
        });

        document.getElementById('animPattern').addEventListener('change', (e) => {
            this.state.animPattern = e.target.value;
            this.shuffleRidgeOrder();
            this.render();
        });

        document.getElementById('addColor').addEventListener('click', () => {
            const hue = Math.floor(Math.random() * 360);
            this.state.colorPalette.push(this.hslToHex(hue, 70, 60));
            this.buildPaletteUI();
            this.assignRidgeColors();
            this.render();
        });

        document.getElementById('randomAllColors').addEventListener('click', () => {
            this.state.colorPalette = this.state.colorPalette.map(() => {
                return this.hslToHex(Math.random() * 360, 60 + Math.random() * 30, 45 + Math.random() * 25);
            });
            this.buildPaletteUI();
            this.assignRidgeColors();
            this.render();
        });

        this.bindSlider('fontSize', 'fontSizeVal', (v) => { this.state.fontSize = v; this.cachedRidges = null; this.render(); });
        this.bindSlider('letterSpacing', 'letterSpacingVal', (v) => { this.state.letterSpacing = v; this.render(); });
        this.bindSlider('spiralTurns', 'spiralTurnsVal', (v) => { this.state.spiralTurns = v; this.cachedRidges = null; this.render(); });
        this.bindSlider('fingerprintSize', 'fingerprintSizeVal', (v) => { this.state.fingerprintSize = v; this.cachedRidges = null; this.render(); });
        this.bindSlider('rotation', 'rotationVal', (v) => { this.state.rotation = v; this.cachedRidges = null; this.render(); }, '°');
        this.bindSlider('animSpeed', null, (v) => { this.state.animSpeed = v; });
        this.bindSlider('pixelSize', null, (v) => { this.state.pixelSize = v; this.render(); });
        this.bindSlider('rgbOffset', null, (v) => { this.state.rgbOffset = v; this.render(); });
        this.bindSlider('floatDensity', null, (v) => { this.state.floatDensity = v; this.generateFloatElements(); this.render(); });
        this.bindSlider('gifFps', 'gifFpsVal', (v) => { this.state.gifFps = v; });

        document.querySelectorAll('.bg-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.bgType = btn.dataset.bg;
                document.getElementById('gradientColorPicker').style.display = btn.dataset.bg === 'gradient' ? 'flex' : 'none';
                this.render();
            });
        });
        document.getElementById('gradientColor1').addEventListener('input', (e) => {
            this.state.gradientColor1 = e.target.value;
            this.render();
        });
        document.getElementById('gradientColor2').addEventListener('input', (e) => {
            this.state.gradientColor2 = e.target.value;
            this.render();
        });
        document.getElementById('bgColor').addEventListener('input', (e) => {
            this.state.bgColor = e.target.value;
            this.state.bgType = 'custom';
            document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
            this.render();
        });
        document.getElementById('bgImage').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const img = new Image();
                    img.onload = () => {
                        this.state.bgImage = img;
                        this.state.bgType = 'image';
                        this.render();
                    };
                    img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        document.getElementById('playAnim').addEventListener('click', () => this.toggleAnimation());
        document.getElementById('resetAnim').addEventListener('click', () => {
            this.state.animProgress = 1;
            this.state.isPlaying = false;
            if (this.animFrame) {
                cancelAnimationFrame(this.animFrame);
                this.animFrame = null;
            }
            document.getElementById('playAnim').textContent = '播放动画';
            this.render();
        });
        document.getElementById('loopAnim').addEventListener('change', (e) => {
            this.state.loopAnim = e.target.checked;
        });
        document.getElementById('regenFingerprint').addEventListener('click', () => {
            this.fingerSeed = this.makeSeed();
            this.cachedRidges = null;
            this.render();
        });
        document.getElementById('regenAnimOrder').addEventListener('click', () => {
            this.shuffleSeed = this.makeSeed();
            this.cachedRidges = null;
            this.render();
        });

        const fxMap = {
            'fxCRT': 'crt', 'fxPixel': 'pixel', 'fxRGB': 'rgb', 'fxGlitch': 'glitch',
            'fxNoise': 'noise', 'fxScanline': 'scanline', 'fxVignette': 'vignette', 'fxBlur': 'blur',
            'floatHearts': 'floatHearts', 'floatBokeh': 'floatBokeh', 'floatSnow': 'floatSnow',
            'floatRain': 'floatRain', 'floatDust': 'floatDust', 'floatParticles': 'floatParticles',
            'stickerText': 'stickerText', 'stickerGeo': 'stickerGeo', 'stickerPaper': 'stickerPaper',
            'stickerTape': 'stickerTape', 'textureScratch': 'textureScratch', 'textureDust': 'textureDust',
            'textureInk': 'textureInk', 'borderTorn': 'borderTorn',
            'geoSlice': 'geoSlice', 'geoSplit': 'geoSplit', 'geoHole': 'geoHole',
            'geoShift': 'geoShift', 'geoMosaic': 'geoMosaic', 'geoBarcode': 'geoBarcode'
        };

        Object.entries(fxMap).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    this.state.effects[key] = e.target.checked;
                    if (key === 'pixel') {
                        document.getElementById('pixelSizeRow').style.display = e.target.checked ? 'flex' : 'none';
                    }
                    if (key === 'rgb') {
                        document.getElementById('rgbOffsetRow').style.display = e.target.checked ? 'flex' : 'none';
                    }
                    this.render();
                });
            }
        });

        document.getElementById('exportPNG').addEventListener('click', () => this.exportPNG());
        document.getElementById('exportGIF').addEventListener('click', () => this.exportGIF());
        document.getElementById('exportMP4').addEventListener('click', () => this.exportMP4());
        document.getElementById('cancelExport').addEventListener('click', () => {
            this.exportCancel = true;
        });
        document.getElementById('exportAspect').addEventListener('change', (e) => {
            const val = e.target.value;
            if (val !== 'custom') {
                const res = parseInt(document.getElementById('exportResolution').value) || 1080;
                const [w, h] = val.split(':').map(Number);
                let newW, newH;
                if (w >= h) {
                    newH = res;
                    newW = Math.round(res * w / h);
                } else {
                    newW = res;
                    newH = Math.round(res * h / w);
                }
                document.getElementById('exportWidth').value = newW;
                document.getElementById('exportHeight').value = newH;
            }
            this.setupCanvas();
            this.cachedRidges = null;
            this.render();
            this.updateExportPreview();
        });

        document.getElementById('exportResolution').addEventListener('change', (e) => {
            const res = parseInt(e.target.value) || 1080;
            const aspect = document.getElementById('exportAspect').value;
            if (aspect !== 'custom') {
                const [w, h] = aspect.split(':').map(Number);
                let newW, newH;
                if (w >= h) {
                    newH = res;
                    newW = Math.round(res * w / h);
                } else {
                    newW = res;
                    newH = Math.round(res * h / w);
                }
                document.getElementById('exportWidth').value = newW;
                document.getElementById('exportHeight').value = newH;
            }
            this.setupCanvas();
            this.cachedRidges = null;
            this.render();
            this.updateExportPreview();
        });

        document.getElementById('exportWidth').addEventListener('input', () => {
            document.getElementById('exportAspect').value = 'custom';
            this.setupCanvas();
            this.cachedRidges = null;
            this.render();
            this.updateExportPreview();
        });

        document.getElementById('exportHeight').addEventListener('input', () => {
            document.getElementById('exportAspect').value = 'custom';
            this.setupCanvas();
            this.cachedRidges = null;
            this.render();
            this.updateExportPreview();
        });

        window.addEventListener('resize', () => {
            if (!this.exporting) {
                this.setupCanvas();
                this.cachedRidges = null;
                this.render();
                this.updateExportPreview();
            }
        });

        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (!this.exporting) {
                    this.setupCanvas();
                    this.cachedRidges = null;
                    this.render();
                    this.updateExportPreview();
                }
            }, 300);
        });
    }

    bindSlider(id, valId, callback, suffix = '') {
        const el = document.getElementById(id);
        el.addEventListener('input', () => {
            const v = parseFloat(el.value);
            if (valId) document.getElementById(valId).textContent = v + suffix;
            callback(v);
        });
    }

    hslToHex(h, s, l) {
        s /= 100; l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    buildPaletteUI() {
        const container = document.getElementById('colorPalette');
        if (!container) return;
        container.innerHTML = '';

        this.state.colorPalette.forEach((color, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'palette-color';
            wrapper.style.backgroundColor = color;
            wrapper.title = `颜色 ${idx + 1}`;

            const input = document.createElement('input');
            input.type = 'color';
            input.value = color;
            input.addEventListener('input', (e) => {
                this.state.colorPalette[idx] = e.target.value;
                wrapper.style.backgroundColor = e.target.value;
                this.assignRidgeColors();
                this.render();
            });

            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-color';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.state.colorPalette.length <= 1) return;
                this.state.colorPalette.splice(idx, 1);
                this.buildPaletteUI();
                this.assignRidgeColors();
                this.render();
            });

            wrapper.appendChild(input);
            wrapper.appendChild(removeBtn);
            container.appendChild(wrapper);
        });
    }

    // ========== 指纹脊线生成（弧线片段组成闭合指纹，有机扭曲） ==========
    generateFingerprintRidges(cx, cy, maxRadius, numRidges, rotation) {
        const ridges = [];
        const rotRad = (rotation * Math.PI) / 180;
        let seed = this.fingerSeed;

        const rng = () => {
            seed++;
            return this.seededRandom(seed);
        };

        const aspectY = 1.3;
        const aspectX = 0.85;
        const minAspect = Math.min(aspectX, aspectY);
        const maxDeviationRatio = 0.15;
        const minGap = this.state.fontSize / (minAspect * (1 - 2 * maxDeviationRatio));
        const maxPossibleRidges = Math.max(2, Math.floor(maxRadius / minGap - 1));
        const effectiveRidges = Math.min(numRidges, maxPossibleRidges);
        const ridgeGap = maxRadius / (effectiveRidges + 1);
        const maxDeviation = ridgeGap * maxDeviationRatio;
        const spiralInfluence = (this.state.spiralTurns - 1) / 9;

        for (let r = 1; r <= effectiveRidges; r++) {
            const normalizedR = r / effectiveRidges;
            const baseRadius = r * ridgeGap;
            const rMin = baseRadius - maxDeviation;
            const rMax = baseRadius + maxDeviation;

            const segmentsThisRing = 2 + Math.floor(rng() * 2);
            const gapAngle = 0.08 + rng() * 0.12;
            const totalSweep = Math.PI * 2 - gapAngle * segmentsThisRing;
            const segSweep = totalSweep / segmentsThisRing;

            const spiralAngleOffset = normalizedR * spiralInfluence * Math.PI * 2;

            for (let s = 0; s < segmentsThisRing; s++) {
                const startAngle = s * (segSweep + gapAngle) + spiralAngleOffset;
                const sweepAngle = segSweep + (rng() - 0.5) * 0.15;

                const segCurvature = (rng() - 0.5) * 0.3 + spiralInfluence * 0.2;
                const segTwist = (rng() - 0.5) * 0.1 + spiralInfluence * 0.1;

                const wobbleAmp = (0.3 + rng() * 0.7) * maxDeviation;
                const wobbleFreq = 3 + Math.floor(rng() * 4);
                const wobblePhase = rng() * 6.28;
                const distortAmp = (0.2 + rng() * 0.5) * maxDeviation;
                const distortFreq = 5 + Math.floor(rng() * 3);
                const distortPhase = rng() * 6.28;

                const arcLen = baseRadius * sweepAngle;
                const numPoints = Math.max(60, Math.floor(arcLen * 1.8));
                const ridge = [];

                for (let i = 0; i <= numPoints; i++) {
                    const t = i / numPoints;
                    const angle = startAngle + t * sweepAngle;

                    const curve = segCurvature * Math.sin(t * Math.PI);
                    const twist = segTwist * t;
                    const effectiveAngle = angle + curve + twist;

                    const wobble = Math.sin(effectiveAngle * wobbleFreq + wobblePhase) * wobbleAmp;
                    const distort = Math.cos(effectiveAngle * distortFreq + distortPhase) * distortAmp;

                    let radius = baseRadius + wobble + distort;
                    radius = Math.max(rMin, Math.min(rMax, radius));

                    const rawX = Math.cos(effectiveAngle) * radius * aspectX;
                    const rawY = Math.sin(effectiveAngle) * radius * aspectY;

                    const x = cx + rawX * Math.cos(rotRad) - rawY * Math.sin(rotRad);
                    const y = cy + rawX * Math.sin(rotRad) + rawY * Math.cos(rotRad);

                    ridge.push({ x, y });
                }

                ridges.push(ridge);
            }
        }

        return ridges;
    }

    // ========== 常规指纹（涡旋/斗型指纹，自然有机纹路，严格防重叠） ==========
    generateWhorlRidges(cx, cy, maxRadius, numRidges, rotation) {
        const ridges = [];
        const rotRad = (rotation * Math.PI) / 180;
        let seed = this.fingerSeed;

        const rng = () => {
            seed++;
            return this.seededRandom(seed);
        };

        const aspectY = 1.3;
        const aspectX = 0.85;
        const minAspect = Math.min(aspectX, aspectY);
        const maxDeviationRatio = 0.15;

        const minGap = this.state.fontSize / (minAspect * (1 - 2 * maxDeviationRatio));
        const maxPossibleRidges = Math.max(2, Math.floor(maxRadius / minGap - 1));
        const effectiveRidges = Math.min(numRidges, maxPossibleRidges);
        const ridgeGap = maxRadius / (effectiveRidges + 1);
        const maxDeviation = ridgeGap * maxDeviationRatio;

        const spiralInfluence = (this.state.spiralTurns - 1) / 9;

        const globalBulge = (rng() - 0.5) * 0.15;
        const globalTilt = (rng() - 0.5) * 0.2;

        for (let r = 0; r < effectiveRidges; r++) {
            const normalizedR = (r + 1) / effectiveRidges;
            const baseRadius = normalizedR * maxRadius;
            const rMin = Math.max(ridgeGap * 0.3, baseRadius - maxDeviation);
            const rMax = baseRadius + maxDeviation;

            const spiralOffset = (1 - normalizedR) * spiralInfluence * Math.PI * 2;

            const loFreqAmp = (0.3 + rng() * 0.7) * maxDeviation;
            const loFreq = 2 + Math.floor(rng() * 2);
            const loFreqPhase = rng() * 6.28;

            const midFreqAmp = (0.2 + rng() * 0.5) * maxDeviation;
            const midFreq = 4 + Math.floor(rng() * 4);
            const midFreqPhase = rng() * 6.28;

            const hiFreqAmp = (0.05 + rng() * 0.15) * maxDeviation;
            const hiFreq = 8 + Math.floor(rng() * 6);
            const hiFreqPhase = rng() * 6.28;

            const bulgeAmp = (0.2 + rng() * 0.6) * maxDeviation;
            const bulgeAngle = rng() * Math.PI * 2;
            const bulgeWidth = 0.4 + rng() * 0.8;

            const startAngle = -Math.PI / 2 + spiralOffset + globalTilt + rng() * 0.15;

            const isPartial = normalizedR > 0.7 && rng() > 0.6;
            const sweepAngle = isPartial
                ? Math.PI * (1.2 + rng() * 0.6)
                : Math.PI * 2;

            const numPoints = Math.max(80, Math.floor(baseRadius * 2.5));
            const ridge = [];

            for (let i = 0; i <= numPoints; i++) {
                const t = i / numPoints;
                const angle = startAngle + t * sweepAngle;

                const loWobble = Math.sin(angle * loFreq + loFreqPhase) * loFreqAmp;
                const midWobble = Math.sin(angle * midFreq + midFreqPhase) * midFreqAmp;
                const hiWobble = Math.sin(angle * hiFreq + hiFreqPhase) * hiFreqAmp;

                const angleDiff = Math.atan2(Math.sin(angle - bulgeAngle), Math.cos(angle - bulgeAngle));
                const bulge = bulgeAmp * Math.exp(-(angleDiff * angleDiff) / (2 * bulgeWidth * bulgeWidth));

                const shapeOffset = globalBulge * maxDeviation * Math.sin(angle * 2 + r * 0.5);

                let radius = baseRadius + loWobble + midWobble + hiWobble + bulge + shapeOffset;
                radius = Math.max(rMin, Math.min(rMax, radius));

                const rawX = Math.cos(angle) * radius * aspectX;
                const rawY = Math.sin(angle) * radius * aspectY;

                const x = cx + rawX * Math.cos(rotRad) - rawY * Math.sin(rotRad);
                const y = cy + rawX * Math.sin(rotRad) + rawY * Math.cos(rotRad);

                ridge.push({ x, y });
            }

            ridges.push(ridge);
        }

        return ridges;
    }

    generateCoreRidges(cx, cy, maxRadius, aspectX, aspectY, rotRad, rng) {
        return [];
    }

    generateForkRidges(cx, cy, maxRadius, aspectX, aspectY, rotRad, rng) {
        return [];
    }

    getRidges() {
        const params = `${this.canvas.width},${this.canvas.height},${this.state.fingerprintSize},${this.state.rotation},${this.state.spiralTurns},${this.state.fingerprintStyle},${this.fingerSeed},${this.state.text}`;
        if (this.cachedRidges && this.cachedRidgeParams === params) {
            return this.cachedRidges;
        }

        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        const aspectX = 0.85;
        const aspectY = 1.3;
        const sizeScale = this.state.fingerprintSize / 350;
        const maxRadius = Math.min(w / (2 * aspectX), h / (2 * aspectY)) * 0.9 * sizeScale;

        const lines = this.state.text.split('\n').filter(l => l.trim());
        let neededRidges = this.state.ridgeDensity;
        if (this.state.textLayout === 'perRidge') {
            neededRidges = Math.max(neededRidges, lines.length);
        } else {
            const fullText = lines.join('');
            const charSpacing = this.state.fontSize + this.state.letterSpacing;
            const avgCircumference = maxRadius * 0.6 * Math.PI * 2 * Math.min(aspectX, aspectY);
            const charsPerRidge = Math.max(1, Math.floor(avgCircumference / charSpacing));
            neededRidges = Math.max(neededRidges, Math.ceil(fullText.length / charsPerRidge));
        }

        let ridges;
        if (this.state.fingerprintStyle === 'whorl') {
            ridges = this.generateWhorlRidges(cx, cy, maxRadius, neededRidges, this.state.rotation);
        } else {
            ridges = this.generateFingerprintRidges(cx, cy, maxRadius, neededRidges, this.state.rotation);
        }

        // 计算每条纹路的长度并排序（用于优先分配重点句子）
        this.ridgeLengths = ridges.map((ridge, idx) => ({
            idx,
            length: this.calcPathLength(ridge),
            topY: Math.min(...ridge.map(p => p.y))
        }));

        // 按长度降序排序（最长的纹路排前面）
        this.ridgeLengths.sort((a, b) => b.length - a.length);

        this.cachedRidges = ridges;
        this.cachedRidgeParams = params;

        this.shuffleRidgeOrder();
        this.assignRidgeColors();

        return this.cachedRidges;
    }

    shuffleRidgeOrder() {
        const n = this.cachedRidges ? this.cachedRidges.length : this.state.ridgeDensity;
        this.ridgeAppearOrder = [];

        if (this.state.animPattern === 'dialogue') {
            this.buildDialogueOrder(n);
        } else if (this.state.animPattern === 'insideOut') {
            for (let i = 0; i < n; i++) {
                this.ridgeAppearOrder.push(i);
            }
        } else if (this.state.animPattern === 'outsideIn') {
            for (let i = n - 1; i >= 0; i--) {
                this.ridgeAppearOrder.push(i);
            }
        } else if (this.state.animPattern === 'scan') {
            // 指纹录入：按纹路从上到下排序（Y坐标小的先出现）
            this.buildScanOrder(n);
        } else {
            for (let i = 0; i < n; i++) {
                this.ridgeAppearOrder.push(i);
            }
            for (let i = this.ridgeAppearOrder.length - 1; i > 0; i--) {
                const j = Math.floor(this.seededRandom(this.shuffleSeed + i * 7.3) * (i + 1));
                [this.ridgeAppearOrder[i], this.ridgeAppearOrder[j]] = [this.ridgeAppearOrder[j], this.ridgeAppearOrder[i]];
            }
        }
    }

    buildScanOrder(n) {
        if (!this.cachedRidges || this.cachedRidges.length === 0) {
            for (let i = 0; i < n; i++) this.ridgeAppearOrder.push(i);
            return;
        }

        // 按纹路的顶部Y坐标排序（从上到下）
        const ridgeTops = this.cachedRidges.map((ridge, idx) => {
            const minY = ridge.length > 0 ? Math.min(...ridge.map(p => p.y)) : Infinity;
            return { idx, minY };
        });

        ridgeTops.sort((a, b) => a.minY - b.minY);

        // 分成5批
        const batchSize = Math.ceil(ridgeTops.length / 5);
        for (let batch = 0; batch < 5; batch++) {
            const start = batch * batchSize;
            const end = Math.min(start + batchSize, ridgeTops.length);
            for (let i = start; i < end; i++) {
                this.ridgeAppearOrder.push(ridgeTops[i].idx);
            }
        }
    }

    buildDialogueOrder(n) {
        if (!this.cachedRidges || this.cachedRidges.length === 0) {
            for (let i = 0; i < n; i++) this.ridgeAppearOrder.push(i);
            return;
        }

        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        const quadrants = [[], [], [], []];

        this.cachedRidges.forEach((ridge, idx) => {
            if (!ridge || ridge.length === 0) {
                quadrants[0].push(idx);
                return;
            }
            let sumX = 0, sumY = 0;
            const step = Math.max(1, Math.floor(ridge.length / 20));
            let count = 0;
            for (let i = 0; i < ridge.length; i += step) {
                sumX += ridge[i].x;
                sumY += ridge[i].y;
                count++;
            }
            const avgX = sumX / count;
            const avgY = sumY / count;

            const dx = avgX - cx;
            const dy = avgY - cy;

            let q;
            if (Math.abs(dx) > Math.abs(dy)) {
                q = dx < 0 ? 0 : 1;
            } else {
                q = dy < 0 ? 2 : 3;
            }
            quadrants[q].push(idx);
        });

        quadrants.forEach(q => {
            for (let i = q.length - 1; i > 0; i--) {
                const j = Math.floor(this.seededRandom(this.shuffleSeed + i * 3.7) * (i + 1));
                [q[i], q[j]] = [q[j], q[i]];
            }
        });

        const order = [0, 1, 2, 3];
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(this.seededRandom(this.shuffleSeed + i * 11.3) * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }

        let ptr = 0;
        while (quadrants.some(q => q.length > 0)) {
            const qi = order[ptr % 4];
            if (quadrants[qi].length > 0) {
                this.ridgeAppearOrder.push(quadrants[qi].shift());
            }
            ptr++;
        }
    }

    assignRidgeColors() {
        const palette = this.state.colorPalette;
        const n = this.cachedRidges ? this.cachedRidges.length : this.state.ridgeDensity;
        this.ridgeColorMap = [];

        if (this.state.colorMode === 'sequential') {
            for (let i = 0; i < n; i++) {
                this.ridgeColorMap.push(palette[i % palette.length]);
            }
        } else if (this.state.colorMode === 'random') {
            for (let i = 0; i < n; i++) {
                this.ridgeColorMap.push(palette[Math.floor(this.seededRandom(this.shuffleSeed + i * 13.7) * palette.length)]);
            }
        } else if (this.state.colorMode === 'gradient') {
            for (let i = 0; i < n; i++) {
                const t = n > 1 ? i / (n - 1) : 0;
                const idx = t * (palette.length - 1);
                const lo = Math.floor(idx);
                const hi = Math.min(lo + 1, palette.length - 1);
                const frac = idx - lo;
                this.ridgeColorMap.push(this.lerpColor(palette[lo], palette[hi], frac));
            }
        }
    }

    lerpColor(c1, c2, t) {
        const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
        const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }

    // ========== 文字沿路径排列（精确切线角度 + 字宽取点 + 循环填充） ==========
    renderTextAlongPath(ctx, text, path, color, ridgeProgress) {
        return this.renderTextAlongPathFrom(ctx, text, 0, path, color, ridgeProgress);
    }

    renderTextAlongPathFrom(ctx, text, startCharIdx, path, color, ridgeProgress) {
        if (!path || path.length < 2 || !text || text.length === 0) return 0;

        const totalPathLen = this.calcPathLength(path);
        if (totalPathLen < 1) return 0;

        ctx.save();
        ctx.font = `${this.state.fontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
        const getCharWidth = (ch) => ctx.measureText(ch).width;

        // 计算路径上能放多少字（文字循环重复直到填满路径）
        let maxChars = 0;
        let testDist = 0;
        while (true) {
            const ch = text[maxChars % text.length];
            const charWidth = getCharWidth(ch) + this.state.letterSpacing;
            if (testDist + charWidth > totalPathLen) break;
            testDist += charWidth;
            maxChars++;
        }

        if (maxChars === 0) {
            ctx.restore();
            return 0;
        }

        const charsToShow = Math.floor(maxChars * Math.min(1, ridgeProgress));
        if (charsToShow === 0) {
            ctx.restore();
            return 0;
        }

        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let placed = 0;
        let currentDist = 0;
        let pathIndex = 0;
        let segAcc = 0;

        for (let charIdx = 0; charIdx < charsToShow; charIdx++) {
            const globalIdx = startCharIdx + charIdx;
            const ch = text[globalIdx % text.length];
            const charWidth = getCharWidth(ch) + this.state.letterSpacing;

            let targetDist = currentDist + charWidth / 2;
            let found = false;
            let px = path[0].x, py = path[0].y;
            let angle = 0;

            let tempSegAcc = segAcc;
            for (let i = pathIndex; i < path.length - 1; i++) {
                const p1 = path[i];
                const p2 = path[i + 1];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const segLen = Math.sqrt(dx * dx + dy * dy);

                if (tempSegAcc + segLen >= targetDist) {
                    const ratio = (targetDist - tempSegAcc) / segLen;
                    px = p1.x + dx * ratio;
                    py = p1.y + dy * ratio;
                    angle = Math.atan2(dy, dx);
                    pathIndex = i;
                    segAcc = tempSegAcc;
                    found = true;
                    break;
                }
                tempSegAcc += segLen;
            }

            if (!found && path.length > 1) {
                const last = path[path.length - 1];
                const secondLast = path[path.length - 2];
                px = last.x;
                py = last.y;
                angle = Math.atan2(last.y - secondLast.y, last.x - secondLast.x);
            }

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(angle);
            ctx.fillText(ch, 0, 0);
            ctx.restore();

            currentDist += charWidth;
            placed++;
        }

        ctx.restore();
        return placed;
    }

    calcPathLength(path) {
        let len = 0;
        for (let i = 1; i < path.length; i++) {
            const dx = path[i].x - path[i - 1].x;
            const dy = path[i].y - path[i - 1].y;
            len += Math.sqrt(dx * dx + dy * dy);
        }
        return len;
    }

    // ========== 缓动函数 ==========
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    // ========== 浮动元素 ==========
    generateFloatElements() {
        this.floatElements = [];
        const count = this.state.floatDensity;
        const w = this.canvas.width || 720;
        const h = this.canvas.height || 720;

        for (let i = 0; i < count; i++) {
            this.floatElements.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: Math.random() * 15 + 5,
                speedX: (Math.random() - 0.5) * 0.5,
                speedY: (Math.random() - 0.5) * 0.5 - 0.3,
                opacity: Math.random() * 0.4 + 0.1,
                type: Math.random() > 0.5 ? 'heart' : 'dot',
                phase: Math.random() * Math.PI * 2
            });
        }

        this.particles = [];
        for (let i = 0; i < count * 2; i++) {
            this.particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: Math.random(),
                size: Math.random() * 3 + 1,
                color: this.randomParticleColor()
            });
        }
    }

    randomParticleColor() {
        const colors = ['#ff6b9d', '#c44569', '#f8b500', '#4ecdc4', '#44a08d', '#96e6a1'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    drawFloatElements(ctx, time) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        if (this.state.effects.floatHearts) {
            this.floatElements.forEach(el => {
                const x = el.x + Math.sin(time * 0.001 + el.phase) * 20;
                const y = el.y + Math.cos(time * 0.0008 + el.phase) * 10;
                const floatY = ((y + time * 0.02) % h + h) % h;

                ctx.save();
                ctx.globalAlpha = el.opacity * 0.6;
                ctx.fillStyle = '#ff6b9d';
                this.drawHeart(ctx, x, floatY, el.size);
                ctx.restore();
            });
        }

        if (this.state.effects.floatBokeh) {
            this.floatElements.forEach(el => {
                const x = el.x + Math.sin(time * 0.0005 + el.phase) * 30;
                const y = el.y + Math.cos(time * 0.0007 + el.phase) * 20;

                ctx.save();
                ctx.globalAlpha = el.opacity * 0.3;
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, el.size * 2);
                gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
                gradient.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, el.size * 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
        }

        if (this.state.effects.floatSnow) {
            this.particles.forEach(p => {
                p.y += p.vy + 0.5;
                p.x += p.vx + Math.sin(time * 0.001 + p.life) * 0.5;
                if (p.y > h) { p.y = -5; p.x = Math.random() * w; }
                if (p.x > w) p.x = 0;
                if (p.x < 0) p.x = w;

                ctx.save();
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
        }

        if (this.state.effects.floatRain) {
            for (let i = 0; i < this.state.floatDensity; i++) {
                const x = (i * 37 + time * 0.1) % w;
                const y = (time * 2 + i * 50) % (h + 100) - 50;
                const len = 15 + (i % 7) * 3;

                ctx.save();
                ctx.globalAlpha = 0.3;
                ctx.strokeStyle = '#aaddff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x - 2, y + len);
                ctx.stroke();
                ctx.restore();
            }
        }

        if (this.state.effects.floatDust) {
            this.particles.forEach(p => {
                p.x += p.vx * 0.3;
                p.y += p.vy * 0.3;
                if (p.x < 0 || p.x > w) p.vx *= -1;
                if (p.y < 0 || p.y > h) p.vy *= -1;

                ctx.save();
                ctx.globalAlpha = 0.4;
                ctx.fillStyle = '#d4c4a8';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
        }

        if (this.state.effects.floatParticles) {
            this.particles.forEach(p => {
                p.life -= 0.005;
                if (p.life <= 0) {
                    p.life = 1;
                    p.x = Math.random() * w;
                    p.y = Math.random() * h;
                }
                p.x += p.vx;
                p.y += p.vy;

                ctx.save();
                ctx.globalAlpha = p.life * 0.6;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
        }
    }

    drawHeart(ctx, x, y, size) {
        ctx.beginPath();
        ctx.moveTo(x, y + size * 0.3);
        ctx.bezierCurveTo(x, y, x - size * 0.5, y, x - size * 0.5, y + size * 0.3);
        ctx.bezierCurveTo(x - size * 0.5, y + size * 0.7, x, y + size, x, y + size);
        ctx.bezierCurveTo(x, y + size, x + size * 0.5, y + size * 0.7, x + size * 0.5, y + size * 0.3);
        ctx.bezierCurveTo(x + size * 0.5, y, x, y, x, y + size * 0.3);
        ctx.fill();
    }

    // ========== 视觉特效 ==========
    applyEffects(ctx, w, h) {
        if (this.state.effects.noise) {
            const imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const n = (Math.random() - 0.5) * 30;
                data[i] = Math.min(255, Math.max(0, data[i] + n));
                data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
                data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
            }
            ctx.putImageData(imageData, 0, 0);
        }

        if (this.state.effects.pixel) {
            this.applyPixelate(ctx, w, h);
        }

        if (this.state.effects.rgb) {
            this.applyRGBSplit(ctx, w, h);
        }

        if (this.state.effects.glitch) {
            this.applyGlitch(ctx, w, h);
        }

        if (this.state.effects.scanline) {
            this.applyScanlines(ctx, w, h);
        }

        if (this.state.effects.crt) {
            this.applyCRT(ctx, w, h);
        }

        if (this.state.effects.vignette) {
            this.applyVignette(ctx, w, h);
        }
    }

    applyPixelate(ctx, w, h) {
        const size = this.state.pixelSize;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(ctx.canvas, 0, 0);

        ctx.imageSmoothingEnabled = false;
        const smallW = Math.ceil(w / size);
        const smallH = Math.ceil(h / size);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(tempCanvas, 0, 0, smallW, smallH, 0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
    }

    applyRGBSplit(ctx, w, h) {
        const offset = this.state.rgbOffset;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(ctx.canvas, 0, 0);

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.7;
        ctx.drawImage(tempCanvas, offset, 0);
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.7;
        ctx.drawImage(tempCanvas, -offset, 0);
        ctx.restore();
    }

    applyGlitch(ctx, w, h) {
        const numSlices = Math.floor(Math.random() * 5) + 3;
        for (let i = 0; i < numSlices; i++) {
            const y = Math.floor(Math.random() * h);
            const sliceH = Math.floor(Math.random() * 20) + 5;
            const safeH = Math.min(sliceH, h - y);
            if (safeH <= 0) continue;
            const offset = Math.floor((Math.random() - 0.5) * 30);
            try {
                const imageData = ctx.getImageData(0, y, w, safeH);
                ctx.putImageData(imageData, offset, y);
            } catch (e) {}
        }
    }

    applyScanlines(ctx, w, h) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#000';
        for (let y = 0; y < h; y += 3) {
            ctx.fillRect(0, y, w, 1);
        }
        ctx.restore();
    }

    applyCRT(ctx, w, h) {
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#000';
        for (let y = 0; y < h; y += 2) {
            ctx.fillRect(0, y, w, 1);
        }
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, 'rgba(255,255,255,0.02)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.04)');
        gradient.addColorStop(1, 'rgba(255,255,255,0.02)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    applyVignette(ctx, w, h) {
        const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }

    // ========== 贴纸与肌理（使用确定性种子） ==========
    drawStickersAndTextures(ctx, w, h) {
        let seed = this.stickerSeed;

        const nextRand = () => {
            seed++;
            return this.seededRandom(seed);
        };

        if (this.state.effects.stickerText) {
            const fragments = ['LOVE', '心', '恋', '想', '等', '永', '远', 'KISS', 'DREAM'];
            ctx.save();
            for (let i = 0; i < 8; i++) {
                const x = nextRand() * w;
                const y = nextRand() * h;
                const rot = (nextRand() - 0.5) * 1;
                ctx.globalAlpha = 0.15;
                const palIdx = Math.floor(nextRand() * this.state.colorPalette.length);
                ctx.fillStyle = this.state.colorPalette[palIdx];
                ctx.font = `bold ${Math.floor(nextRand() * 20 + 10)}px sans-serif`;
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(rot);
                ctx.fillText(fragments[Math.floor(nextRand() * fragments.length)], 0, 0);
                ctx.restore();
            }
            ctx.restore();
        }

        if (this.state.effects.stickerGeo) {
            ctx.save();
            for (let i = 0; i < 6; i++) {
                ctx.globalAlpha = 0.1;
                ctx.fillStyle = nextRand() > 0.5 ? '#ff6b9d' : '#4ecdc4';
                ctx.beginPath();
                const x = nextRand() * w;
                const y = nextRand() * h;
                const size = nextRand() * 30 + 10;
                if (nextRand() > 0.5) {
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                } else {
                    ctx.moveTo(x, y - size);
                    ctx.lineTo(x + size, y + size);
                    ctx.lineTo(x - size, y + size);
                }
                ctx.fill();
            }
            ctx.restore();
        }

        if (this.state.effects.stickerPaper) {
            ctx.save();
            for (let i = 0; i < 4; i++) {
                const x = nextRand() * w;
                const y = nextRand() * h;
                const pw = nextRand() * 60 + 40;
                const ph = nextRand() * 40 + 30;
                ctx.globalAlpha = 0.2;
                ctx.fillStyle = '#f5f0e8';
                ctx.fillRect(x, y, pw, ph);
                ctx.strokeStyle = '#d0c8b8';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, pw, ph);
            }
            ctx.restore();
        }

        if (this.state.effects.stickerTape) {
            ctx.save();
            for (let i = 0; i < 3; i++) {
                const x = nextRand() * w;
                const y = nextRand() * h;
                const tw = nextRand() * 80 + 40;
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = '#e8d5a3';
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate((nextRand() - 0.5) * 0.5);
                ctx.fillRect(-tw / 2, -8, tw, 16);
                ctx.restore();
            }
            ctx.restore();
        }

        if (this.state.effects.textureScratch) {
            ctx.save();
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < 20; i++) {
                ctx.beginPath();
                ctx.moveTo(nextRand() * w, nextRand() * h);
                ctx.lineTo(nextRand() * w, nextRand() * h);
                ctx.stroke();
            }
            ctx.restore();
        }

        if (this.state.effects.textureDust) {
            ctx.save();
            for (let i = 0; i < 100; i++) {
                ctx.globalAlpha = nextRand() * 0.3;
                ctx.fillStyle = nextRand() > 0.5 ? '#fff' : '#000';
                ctx.fillRect(nextRand() * w, nextRand() * h, nextRand() * 2 + 1, nextRand() * 2 + 1);
            }
            ctx.restore();
        }

        if (this.state.effects.textureInk) {
            ctx.save();
            for (let i = 0; i < 5; i++) {
                const x = nextRand() * w;
                const y = nextRand() * h;
                const r = nextRand() * 40 + 20;
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
                gradient.addColorStop(0, `rgba(0,0,0,${nextRand() * 0.1 + 0.05})`);
                gradient.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        if (this.state.effects.borderTorn) {
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 5, 3, 5]);
            ctx.strokeRect(10, 10, w - 20, h - 20);
            ctx.restore();
        }
    }

    // ========== 几何变换 ==========
    applyGeometricEffects(ctx, w, h) {
        if (this.state.effects.geoSlice) {
            const sliceY = Math.floor(h * 0.5);
            const offset = 20;
            try {
                const imageData = ctx.getImageData(0, sliceY, w, h - sliceY);
                ctx.putImageData(imageData, offset, sliceY);
            } catch (e) {}
        }

        if (this.state.effects.geoSplit) {
            const midX = Math.floor(w / 2);
            const offset = 15;
            try {
                const leftData = ctx.getImageData(0, 0, midX, h);
                const rightData = ctx.getImageData(midX, 0, w - midX, h);
                ctx.putImageData(leftData, -offset, 0);
                ctx.putImageData(rightData, midX + offset, 0);
            } catch (e) {}
        }

        if (this.state.effects.geoHole) {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            let seed = this.stickerSeed + 100;
            for (let i = 0; i < 5; i++) {
                seed++;
                const x = this.seededRandom(seed) * w;
                const y = this.seededRandom(seed + 1) * h;
                const r = this.seededRandom(seed + 2) * 30 + 10;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        if (this.state.effects.geoShift) {
            try {
                const imageData = ctx.getImageData(0, 0, w, h);
                ctx.putImageData(imageData, 10, 5);
                ctx.globalAlpha = 0.5;
                ctx.putImageData(imageData, 0, 0);
                ctx.globalAlpha = 1;
            } catch (e) {}
        }

        if (this.state.effects.geoMosaic) {
            const blockSize = 20;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(ctx.canvas, 0, 0);

            ctx.clearRect(0, 0, w, h);
            for (let y = 0; y < h; y += blockSize) {
                for (let x = 0; x < w; x += blockSize) {
                    const sx = Math.min(x + Math.floor(this.seededRandom(x * y) * blockSize * 0.5), w - blockSize);
                    const sy = Math.min(y + Math.floor(this.seededRandom(x + y) * blockSize * 0.5), h - blockSize);
                    ctx.drawImage(tempCanvas, sx, sy, blockSize, blockSize, x, y, blockSize, blockSize);
                }
            }
        }

        if (this.state.effects.geoBarcode) {
            ctx.save();
            let seed = this.stickerSeed + 200;
            for (let i = 0; i < 10; i++) {
                seed++;
                const y = this.seededRandom(seed) * h;
                const bh = this.seededRandom(seed + 1) * 5 + 2;
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = this.seededRandom(seed + 2) > 0.5 ? '#000' : '#fff';
                ctx.fillRect(0, y, w, bh);
            }
            ctx.restore();
        }
    }

    // ========== 背景绘制 ==========
    drawBackground(ctx, w, h) {
        switch (this.state.bgType) {
            case 'white':
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, w, h);
                break;
            case 'cream':
                ctx.fillStyle = '#F5F0E8';
                ctx.fillRect(0, 0, w, h);
                break;
            case 'dark':
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, w, h);
                break;
            case 'gradient':
                const grad = ctx.createLinearGradient(0, 0, w, h);
                grad.addColorStop(0, this.state.gradientColor1);
                grad.addColorStop(1, this.state.gradientColor2);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, w, h);
                break;
            case 'custom':
                ctx.fillStyle = this.state.bgColor;
                ctx.fillRect(0, 0, w, h);
                break;
            case 'image':
                if (this.state.bgImage) {
                    ctx.drawImage(this.state.bgImage, 0, 0, w, h);
                } else {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, w, h);
                }
                break;
        }
    }

    // ========== 主渲染（随机纹路出现 + 指纹识别扫描效果） ==========
    render() {
        try {
            this._renderImpl();
        } catch (e) {
            console.error('Render error:', e);
        }
    }

    _renderImpl() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.drawBackground(ctx, w, h);

        const ridges = this.getRidges();
        if (!this._cachedLines || this._cachedText !== this.state.text) {
            this._cachedLines = this.state.text.split('\n').filter(l => l.trim());
            this._cachedText = this.state.text;
        }
        const lines = this._cachedLines;
        if (lines.length === 0 || ridges.length === 0) {
            document.getElementById('frameInfo').textContent = `进度: ${Math.floor(this.state.animProgress * 100)}%`;
            return;
        }

        const progress = this.state.animProgress;
        const totalRidges = ridges.length;
        const appearOrder = this.ridgeAppearOrder;
        const ridgesVisible = Math.ceil(progress * totalRidges);
        const sortedRidgeIndices = this.ridgeLengths ? this.ridgeLengths.map(r => r.idx) : ridges.map((_, i) => i);

        if (this.state.animPattern === 'scan') {
            this.renderScanMode(ctx, ridges, lines, appearOrder, totalRidges, sortedRidgeIndices);
        } else if (this.state.textLayout === 'continuous') {
            this.renderContinuousMode(ctx, ridges, lines, appearOrder, ridgesVisible, progress, totalRidges);
        } else {
            this.renderPerRidgeMode(ctx, ridges, lines, appearOrder, ridgesVisible, progress, totalRidges);
        }

        this.drawFloatElements(ctx, this.getRenderNow());
        this.drawStickersAndTextures(ctx, w, h);
        this.applyGeometricEffects(ctx, w, h);
        this.applyEffects(ctx, w, h);

        document.getElementById('frameInfo').textContent = `进度: ${Math.floor(this.state.animProgress * 100)}%`;
    }

    renderPerRidgeMode(ctx, ridges, lines, appearOrder, ridgesVisible, progress, totalRidges) {
        const sortedRidgeIndices = this.ridgeLengths ? this.ridgeLengths.map(r => r.idx) : ridges.map((_, i) => i);

        for (let orderIdx = 0; orderIdx < totalRidges; orderIdx++) {
            const ridgeIdx = appearOrder[orderIdx];
            const ridge = ridges[ridgeIdx];
            if (!ridge) continue;

            const lengthRank = sortedRidgeIndices.indexOf(ridgeIdx);
            const lineIdx = lengthRank < lines.length ? lengthRank : (ridgeIdx % lines.length);
            const line = lines[lineIdx] || lines[0];
            const color = this.ridgeColorMap[ridgeIdx] || this.state.colorPalette[0];

            if (orderIdx >= ridgesVisible) continue;

            let ridgeAlpha = 1;
            if (orderIdx === ridgesVisible - 1) {
                const rawP = progress * totalRidges;
                const frac = rawP - Math.floor(rawP);
                ridgeAlpha = frac > 0 ? frac : 1;
            }

            ctx.save();
            ctx.globalAlpha = ridgeAlpha;
            this.renderTextAlongPath(ctx, line, ridge, color, 1);
            ctx.restore();
        }
    }

    measureCharWidth(ctx, ch, cache) {
        if (!cache.has(ch)) {
            cache.set(ch, ctx.measureText(ch).width);
        }
        return cache.get(ch);
    }

    getScanMetrics(ctx, ridges, lines, appearOrder, totalRidges, sortedRidgeIndices) {
        const cacheKey = [
            this.cachedRidgeParams || '',
            this.canvas.width,
            this.canvas.height,
            this.state.fontSize,
            this.state.letterSpacing,
            this.state.animSpeed,
            this.state.textLayout,
            this.state.text,
            appearOrder.join(',')
        ].join('|');

        if (this._scanMetricsCache && this._scanMetricsCache.key === cacheKey) {
            return this._scanMetricsCache.metrics;
        }

        const charFadeMs = 70 * (5 / this.state.animSpeed);
        const isContinuous = this.state.textLayout === 'continuous';
        const fullText = isContinuous ? lines.join('') : '';
        const charWidths = new Map();
        const lengthRankByRidge = new Map();
        sortedRidgeIndices.forEach((ridgeIdx, rank) => lengthRankByRidge.set(ridgeIdx, rank));

        ctx.save();
        ctx.font = `${this.state.fontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
        const getCharWidth = (ch) => this.measureCharWidth(ctx, ch, charWidths);

        const batchCount = 5;
        const batchSize = Math.ceil(totalRidges / batchCount);
        const charsPerRidge = [];
        const lineByOrder = [];

        for (let i = 0; i < totalRidges; i++) {
            const ridgeIdx = appearOrder[i];
            const ridge = ridges[ridgeIdx];
            if (!ridge || ridge.length < 2) {
                charsPerRidge.push(0);
                lineByOrder.push('');
                continue;
            }

            const line = isContinuous ? fullText : (() => {
                const lengthRank = lengthRankByRidge.get(ridgeIdx) ?? -1;
                const lineIdx = lengthRank < lines.length ? lengthRank : (ridgeIdx % lines.length);
                return lines[lineIdx] || lines[0];
            })();
            lineByOrder.push(line);

            if (!line) {
                charsPerRidge.push(0);
                continue;
            }

            const totalPathLen = this.calcPathLength(ridge);
            let maxC = 0;
            let testD = 0;
            while (true) {
                const ch = line[maxC % line.length];
                const cw = getCharWidth(ch) + this.state.letterSpacing;
                if (testD + cw > totalPathLen) break;
                testD += cw;
                maxC++;
            }
            charsPerRidge.push(maxC);
        }
        ctx.restore();

        const charOffsets = [0];
        for (let i = 0; i < totalRidges; i++) {
            charOffsets.push(charOffsets[i] + charsPerRidge[i]);
        }

        const batchStartMs = [0];
        for (let b = 0; b < batchCount - 1; b++) {
            const start = b * batchSize;
            const end = Math.min(start + batchSize, totalRidges);
            let maxC = 0;
            for (let i = start; i < end; i++) {
                maxC = Math.max(maxC, charsPerRidge[i]);
            }
            batchStartMs.push(batchStartMs[b] + maxC * charFadeMs);
        }

        const lastStart = (batchCount - 1) * batchSize;
        let lastMaxC = 0;
        for (let i = lastStart; i < totalRidges; i++) {
            lastMaxC = Math.max(lastMaxC, charsPerRidge[i]);
        }
        const totalScanMs = batchStartMs[batchCount - 1] + lastMaxC * charFadeMs + charFadeMs;

        const metrics = {
            batchSize,
            batchStartMs,
            charFadeMs,
            charOffsets,
            charsPerRidge,
            charWidths,
            fullText,
            isContinuous,
            lineByOrder,
            totalScanMs
        };
        this._scanMetricsCache = { key: cacheKey, metrics };
        return metrics;
    }

    renderScanMode(ctx, ridges, lines, appearOrder, totalRidges, sortedRidgeIndices) {
        const metrics = this.getScanMetrics(ctx, ridges, lines, appearOrder, totalRidges, sortedRidgeIndices);
        const totalScanMs = metrics.totalScanMs;
        this._scanTotalMs = totalScanMs;

        const elapsed = this._scanProgressOverride !== null
            ? this._scanProgressOverride * totalScanMs
            : this.getRenderNow() - this.animStartTime;
        const getCharWidth = (ch) => this.measureCharWidth(ctx, ch, metrics.charWidths);

        for (let orderIdx = 0; orderIdx < totalRidges; orderIdx++) {
            const ridgeIdx = appearOrder[orderIdx];
            const ridge = ridges[ridgeIdx];
            if (!ridge || ridge.length < 2) continue;

            const line = metrics.lineByOrder[orderIdx];
            const color = this.ridgeColorMap[ridgeIdx] || this.state.colorPalette[0];
            const maxChars = metrics.charsPerRidge[orderIdx];

            if (!line || maxChars === 0) continue;

            const batchIndex = Math.min(Math.floor(orderIdx / metrics.batchSize), metrics.batchStartMs.length - 1);
            const batchStart = metrics.batchStartMs[batchIndex];
            const startCharIdx = metrics.isContinuous ? metrics.charOffsets[orderIdx] : 0;

            this.renderScanRidgeChars(
                ctx,
                line,
                ridge,
                color,
                maxChars,
                batchStart,
                elapsed,
                metrics.charFadeMs,
                getCharWidth,
                startCharIdx
            );
        }

        if (this._scanProgressOverride !== null) {
            this.state.animProgress = Math.max(0, Math.min(1, elapsed / totalScanMs));
            return;
        }

        if (elapsed >= totalScanMs) {
            if (this.state.loopAnim) {
                this.animStartTime = this.getRenderNow();
            } else if (this.state.isPlaying) {
                this.state.animProgress = 1;
                this.stopAnimation();
                return;
            }
        } else {
            this.state.animProgress = elapsed / totalScanMs;
        }
    }

    renderScanRidgeChars(ctx, text, path, color, maxChars, batchStartMs, elapsedMs, charFadeMs, getCharWidth, startCharIdx) {
        const totalPathLen = this.calcPathLength(path);
        if (totalPathLen < 1 || maxChars === 0) return;

        ctx.save();
        ctx.font = `${this.state.fontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;

        let currentDist = 0;
        let pathIndex = 0;
        let segAcc = 0;

        for (let charIdx = 0; charIdx < maxChars; charIdx++) {
            const globalIdx = (startCharIdx || 0) + charIdx;
            const ch = text[globalIdx % text.length];
            const charWidth = getCharWidth(ch) + this.state.letterSpacing;

            const charAppearMs = batchStartMs + charIdx * charFadeMs;
            const timeSinceAppear = elapsedMs - charAppearMs;

            if (timeSinceAppear <= 0) {
                currentDist += charWidth;
                continue;
            }

            const charAlpha = Math.min(1, timeSinceAppear / charFadeMs);

            let targetDist = currentDist + charWidth / 2;
            let found = false;
            let px = path[0].x, py = path[0].y;
            let angle = 0;

            let tempSegAcc = segAcc;
            for (let i = pathIndex; i < path.length - 1; i++) {
                const p1 = path[i];
                const p2 = path[i + 1];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const segLen = Math.sqrt(dx * dx + dy * dy);

                if (tempSegAcc + segLen >= targetDist) {
                    const ratio = (targetDist - tempSegAcc) / segLen;
                    px = p1.x + dx * ratio;
                    py = p1.y + dy * ratio;
                    angle = Math.atan2(dy, dx);
                    pathIndex = i;
                    segAcc = tempSegAcc;
                    found = true;
                    break;
                }
                tempSegAcc += segLen;
            }

            if (!found && path.length > 1) {
                const last = path[path.length - 1];
                const secondLast = path[path.length - 2];
                px = last.x;
                py = last.y;
                angle = Math.atan2(last.y - secondLast.y, last.x - secondLast.x);
            }

            ctx.save();
            ctx.globalAlpha = charAlpha;
            ctx.translate(px, py);
            ctx.rotate(angle);
            ctx.fillText(ch, 0, 0);
            ctx.restore();

            currentDist += charWidth;
        }

        ctx.restore();
    }

    renderContinuousMode(ctx, ridges, lines, appearOrder, ridgesVisible, progress, totalRidges) {
        const fullText = lines.join('');
        if (!fullText) return;

        const sortedVisible = [];
        for (let orderIdx = 0; orderIdx < ridgesVisible; orderIdx++) {
            sortedVisible.push(appearOrder[orderIdx]);
        }
        sortedVisible.sort((a, b) => a - b);

        const rawP = progress * totalRidges;
        const frac = rawP - Math.floor(rawP);
        const latestRidgeIdx = ridgesVisible > 0 ? appearOrder[ridgesVisible - 1] : -1;

        let charOffset = 0;

        for (let i = 0; i < sortedVisible.length; i++) {
            const ridgeIdx = sortedVisible[i];
            const ridge = ridges[ridgeIdx];
            if (!ridge) continue;

            const isLatestRidge = (ridgeIdx === latestRidgeIdx);
            let ridgeProgress = 1;
            if (isLatestRidge) {
                ridgeProgress = frac > 0 ? frac : 1;
            }

            const color = this.ridgeColorMap[ridgeIdx] || this.state.colorPalette[0];

            ctx.save();
            const placed = this.renderTextAlongPathFrom(ctx, fullText, charOffset, ridge, color, ridgeProgress);
            ctx.restore();

            charOffset += placed;
        }
    }

    // ========== 渲染到指定canvas（独立渲染，不影响主画布） ==========
    renderToCanvas(targetCanvas, targetCtx, progress) {
        const savedCanvas = this.canvas;
        const savedCtx = this.ctx;
        const savedProgress = this.state.animProgress;
        const savedRidges = this.cachedRidges;
        const savedRidgeParams = this.cachedRidgeParams;
        const savedAnimStartTime = this.animStartTime;
        const savedRenderTimeOverride = this._renderTimeOverride;
        const savedScanProgressOverride = this._scanProgressOverride;
        const savedScanMetricsCache = this._scanMetricsCache;

        this.canvas = targetCanvas;
        this.ctx = targetCtx;
        this.state.animProgress = progress;
        this.cachedRidges = null;
        this.cachedRidgeParams = null;
        this._scanMetricsCache = null;
        this._scanProgressOverride = this.state.animPattern === 'scan' ? progress : null;
        this._renderTimeOverride = progress * (this._scanTotalMs || (11 - this.state.animSpeed) * 1000);

        try {
            this.render();
        } finally {
            this.canvas = savedCanvas;
            this.ctx = savedCtx;
            this.state.animProgress = savedProgress;
            this.cachedRidges = savedRidges;
            this.cachedRidgeParams = savedRidgeParams;
            this.animStartTime = savedAnimStartTime;
            this._renderTimeOverride = savedRenderTimeOverride;
            this._scanProgressOverride = savedScanProgressOverride;
            this._scanMetricsCache = savedScanMetricsCache;
        }
    }

    setupPreviewCanvas(dims) {
        const previewCanvas = document.getElementById('previewCanvas');
        const aspect = dims.width / dims.height;

        const vv = window.visualViewport;
        const vpW = vv ? vv.width : window.innerWidth;
        const vpH = vv ? vv.height : window.innerHeight;
        const isMobile = vpW <= 768;
        const maxDisplayW = isMobile ? vpW * 0.85 : 400;
        const maxDisplayH = isMobile ? vpH * 0.45 : 400;

        let displayW, displayH;
        if (aspect > maxDisplayW / maxDisplayH) {
            displayW = maxDisplayW;
            displayH = maxDisplayW / aspect;
        } else {
            displayH = maxDisplayH;
            displayW = maxDisplayH * aspect;
        }
        displayW = Math.max(60, Math.round(displayW));
        displayH = Math.max(60, Math.round(displayH));

        const maxInternalDim = 400;
        let pw, ph;
        if (dims.width >= dims.height) {
            pw = maxInternalDim;
            ph = Math.round(maxInternalDim / aspect);
        } else {
            ph = maxInternalDim;
            pw = Math.round(maxInternalDim * aspect);
        }

        previewCanvas.width = pw;
        previewCanvas.height = ph;
        previewCanvas.style.width = displayW + 'px';
        previewCanvas.style.height = displayH + 'px';
        previewCanvas.style.aspectRatio = dims.width + ' / ' + dims.height;
    }

    getExportDimensions() {
        const w = Math.max(100, Math.min(4096, parseInt(document.getElementById('exportWidth').value) || 720));
        const h = Math.max(100, Math.min(4096, parseInt(document.getElementById('exportHeight').value) || 960));
        return { width: w, height: h };
    }

    updateExportPreview() {
        const dims = this.getExportDimensions();
        const infoEl = document.getElementById('exportPreviewInfo');
        const dimInfoEl = document.getElementById('exportDimInfo');
        if (infoEl) infoEl.textContent = `${dims.width} × ${dims.height}`;
        if (dimInfoEl) dimInfoEl.textContent = `导出: ${dims.width} × ${dims.height}`;

        const overlay = document.getElementById('exportFrameOverlay');
        if (overlay) {
            const canvas = this.canvas;
            const canvasAspect = canvas.width / canvas.height;
            const exportAspect = dims.width / dims.height;

            const clientW = canvas.clientWidth || canvas.width;
            const clientH = canvas.clientHeight || canvas.height;

            let overlayW, overlayH;
            if (exportAspect > canvasAspect) {
                overlayW = clientW;
                overlayH = clientW / exportAspect;
            } else {
                overlayH = clientH;
                overlayW = clientH * exportAspect;
            }

            overlay.style.width = overlayW + 'px';
            overlay.style.height = overlayH + 'px';
            overlay.style.left = ((clientW - overlayW) / 2) + 'px';
            overlay.style.top = ((clientH - overlayH) / 2) + 'px';
        }
    }

    // ========== 动画系统 ==========
    toggleAnimation() {
        if (this.state.isPlaying) {
            this.stopAnimation();
        } else {
            this.startAnimation();
        }
    }

    startAnimation() {
        this.state.isPlaying = true;
        document.getElementById('playAnim').textContent = '暂停动画';
        this.state.animProgress = 0;
        this.animStartTime = performance.now();
        this.animate();
    }

    stopAnimation() {
        this.state.isPlaying = false;
        this.state.animProgress = 1;
        document.getElementById('playAnim').textContent = '播放动画';
        if (this.animFrame) {
            cancelAnimationFrame(this.animFrame);
            this.animFrame = null;
        }
        this.render();
    }

    animate() {
        if (!this.state.isPlaying) return;

        try {
            if (this.state.animPattern === 'scan') {
                this.render();
                if (this.state.isPlaying) {
                    this.animFrame = requestAnimationFrame(() => this.animate());
                }
                return;
            }

            const elapsed = performance.now() - this.animStartTime;
            const duration = (11 - this.state.animSpeed) * 1000;
            this.state.animProgress = Math.min(1, elapsed / duration);

            this.render();

            if (this.state.animProgress >= 1) {
                if (this.state.loopAnim) {
                    this.state.animProgress = 0;
                    this.animStartTime = performance.now();
                } else {
                    this.stopAnimation();
                    return;
                }
            }
        } catch (e) {
            console.error('Animation error:', e);
        }

        if (this.state.isPlaying) {
            this.animFrame = requestAnimationFrame(() => this.animate());
        }
    }

    // ========== 导出功能 ==========
    showModal(show) {
        document.getElementById('exportModal').classList.toggle('active', show);
    }

    showPreviewArea(show) {
        document.getElementById('exportPreviewArea').style.display = show ? 'flex' : 'none';
    }

    showProgressArea(show) {
        document.getElementById('exportProgressArea').style.display = show ? 'flex' : 'none';
        if (show) {
            this.startCatLoader();
        } else {
            this.stopCatLoader();
        }
    }

    updateProgress(percent, status) {
        document.getElementById('progressFill').style.width = percent + '%';
        if (status) document.getElementById('exportStatus').textContent = status;
    }

    getExportUtils() {
        if (!window.ExportUtils) {
            throw new Error('导出工具未加载，请刷新页面后重试');
        }
        return window.ExportUtils;
    }

    buildExportPlan(format, fps) {
        return this.getExportUtils().buildExportRenderPlan({
            dims: this.getExportDimensions(),
            format,
            fps,
            isIOS: this.isIOSDevice()
        });
    }

    buildFramePlan(durationMs, fps, maxFrames) {
        return this.getExportUtils().buildFramePlan({ durationMs, fps, maxFrames });
    }

    selectVideoRecorderType() {
        if (!window.MediaRecorder || typeof window.MediaRecorder.isTypeSupported !== 'function') {
            return null;
        }
        return this.getExportUtils().selectVideoRecorderType({
            isTypeSupported: window.MediaRecorder.isTypeSupported.bind(window.MediaRecorder)
        });
    }

    recordCanvasVideo(canvases, framePlan, duration, isScanMode, recorderProfile) {
        const canvas = canvases.outputCanvas;
        if (!canvas.captureStream || !window.MediaRecorder || !recorderProfile) {
            throw new Error('当前浏览器不支持可播放视频录制');
        }

        const chunks = [];
        const captureFps = Math.max(1, Math.round(Number(framePlan.fps) || 1));
        const stream = canvas.captureStream(captureFps);
        const options = recorderProfile.mimeType ? { mimeType: recorderProfile.mimeType } : {};
        let recorder;

        try {
            recorder = new window.MediaRecorder(stream, options);
        } catch (error) {
            stream.getTracks().forEach(track => track.stop());
            throw error;
        }

        const videoTrack = stream.getVideoTracks()[0];
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const stopTracks = () => stream.getTracks().forEach(track => track.stop());
        const recorderMimeType = recorder.mimeType || recorderProfile.mimeType;

        const stopRecorder = () => {
            if (recorder.state !== 'inactive') {
                if (typeof recorder.requestData === 'function') recorder.requestData();
                recorder.stop();
            }
        };

        return new Promise((resolve, reject) => {
            let settled = false;

            const fail = (error) => {
                if (settled) return;
                settled = true;
                stopTracks();
                try {
                    if (recorder.state !== 'inactive') recorder.stop();
                } catch (stopError) {
                    console.warn('停止视频录制失败:', stopError);
                }
                reject(error);
            };

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) chunks.push(event.data);
            };
            recorder.onerror = (event) => {
                fail(event.error || new Error('视频编码失败'));
            };
            recorder.onstop = () => {
                stopTracks();
                if (settled) return;
                settled = true;
                resolve(new Blob(chunks, { type: recorderMimeType }));
            };

            try {
                recorder.start();
            } catch (error) {
                fail(error);
                return;
            }

            (async () => {
                try {
                    for (let i = 0; i < framePlan.totalFrames; i++) {
                        if (this.exportCancel) throw new Error('cancelled');

                        const progress = framePlan.progressAt(i);
                        this.renderExportFrame(canvases, progress, duration, isScanMode);
                        if (videoTrack && typeof videoTrack.requestFrame === 'function') {
                            videoTrack.requestFrame();
                        }

                        this.updateProgress(Math.floor(((i + 1) / framePlan.totalFrames) * 95), '录制视频...');
                        await wait(framePlan.frameDurationMs);
                    }

                    this.updateProgress(95, '整理视频...');
                    stopRecorder();
                } catch (error) {
                    fail(error);
                }
            })();
        });
    }

    makeExportCanvases(plan) {
        const layoutCanvas = this.createOffscreenCanvas(plan.layoutDims);
        const layoutCtx = layoutCanvas.getContext('2d');
        let outputCanvas = layoutCanvas;
        let outputCtx = layoutCtx;

        if (plan.usesScaledOutput) {
            outputCanvas = this.createOffscreenCanvas(plan.outputDims);
            outputCtx = outputCanvas.getContext('2d');
            outputCtx.imageSmoothingEnabled = true;
            outputCtx.imageSmoothingQuality = 'high';
        }

        return { layoutCanvas, layoutCtx, outputCanvas, outputCtx };
    }

    removeExportCanvases(canvases) {
        this.removeOffscreenCanvas(canvases.outputCanvas);
        if (canvases.outputCanvas !== canvases.layoutCanvas) {
            this.removeOffscreenCanvas(canvases.layoutCanvas);
        }
    }

    syncOutputCanvas(canvases) {
        if (canvases.outputCanvas === canvases.layoutCanvas) return;
        canvases.outputCtx.clearRect(0, 0, canvases.outputCanvas.width, canvases.outputCanvas.height);
        canvases.outputCtx.drawImage(
            canvases.layoutCanvas,
            0,
            0,
            canvases.outputCanvas.width,
            canvases.outputCanvas.height
        );
    }

    renderExportFrame(canvases, progress, durationMs, isScanMode) {
        this.state.animProgress = progress;
        this._scanProgressOverride = isScanMode ? progress : null;
        this._renderTimeOverride = progress * durationMs;
        this.render();
        this.syncOutputCanvas(canvases);
    }

    getCurrentExportDurationMs(isScanMode) {
        return isScanMode
            ? (this._scanTotalMs || 4000)
            : (11 - this.state.animSpeed) * 1000;
    }

    formatScaledInfo(plan) {
        if (!plan.usesScaledOutput) return '';
        return ` · 源画幅 ${plan.layoutDims.width}×${plan.layoutDims.height}`;
    }

    startCatLoader() {
        const canvas = document.getElementById('catLoaderCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        const px = 4;

        const pink = '#FF6B9D';
        const darkPink = '#E84A7A';
        const lightPink = '#FFB3D0';
        const black = '#1a1a1a';
        const white = '#fff';

        const catFrames = [
            [
                [0,0,0,1,1,1,0,0],
                [0,0,1,0,0,1,0,0],
                [0,1,1,1,1,1,1,0],
                [0,1,2,1,1,2,1,0],
                [0,1,1,3,3,1,1,0],
                [0,0,1,1,1,1,0,0],
                [0,0,1,0,0,1,0,0],
                [0,1,1,0,0,1,1,0]
            ],
            [
                [0,0,0,1,1,1,0,0],
                [0,0,1,0,0,1,0,0],
                [0,1,1,1,1,1,1,0],
                [0,1,2,1,1,2,1,0],
                [0,1,1,3,3,1,1,0],
                [0,0,1,1,1,1,0,0],
                [0,1,1,0,0,0,0,0],
                [1,1,0,0,0,0,1,0]
            ],
            [
                [0,0,0,1,1,1,0,0],
                [0,0,1,0,0,1,0,0],
                [0,1,1,1,1,1,1,0],
                [0,1,2,1,1,2,1,0],
                [0,1,1,3,3,1,1,0],
                [0,0,1,1,1,1,0,0],
                [0,0,0,0,0,1,1,0],
                [0,1,0,0,0,0,1,1]
            ],
            [
                [0,0,0,1,1,1,0,0],
                [0,0,1,0,0,1,0,0],
                [0,1,1,1,1,1,1,0],
                [0,1,2,1,1,2,1,0],
                [0,1,1,3,3,1,1,0],
                [0,0,1,1,1,1,0,0],
                [0,1,1,0,0,0,0,0],
                [1,1,0,0,0,0,1,0]
            ]
        ];

        const colorMap = { 1: pink, 2: white, 3: darkPink };

        const yarnBall = [
            [0,0,4,4,0,0],
            [0,4,5,5,4,0],
            [4,5,4,5,5,4],
            [4,5,5,4,5,4],
            [0,4,5,5,4,0],
            [0,0,4,4,0,0]
        ];

        const yarnColorMap = { 4: lightPink, 5: darkPink };

        let frame = 0;
        let catX = 10;
        let direction = 1;
        let tailAngle = 0;
        let blinkTimer = 0;
        let isBlinking = false;

        const drawPixel = (x, y, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(x * px, y * px, px, px);
        };

        const drawSprite = (sprite, ox, oy, cMap) => {
            for (let r = 0; r < sprite.length; r++) {
                for (let c = 0; c < sprite[r].length; c++) {
                    const v = sprite[r][c];
                    if (v && cMap[v]) drawPixel(ox + c, oy + r, cMap[v]);
                }
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, W, H);

            frame++;
            blinkTimer++;
            if (blinkTimer > 60 && !isBlinking) {
                isBlinking = true;
                blinkTimer = 0;
            }
            if (isBlinking && blinkTimer > 6) {
                isBlinking = false;
                blinkTimer = 0;
            }

            const catFrame = Math.floor(frame / 8) % catFrames.length;

            catX += direction * 0.35;
            if (catX > 55) direction = -1;
            if (catX < 3) direction = 1;

            const yarnX = catX + (direction > 0 ? 9 : -7);
            const yarnY = 3;

            drawSprite(yarnBall, Math.round(yarnX), yarnY, yarnColorMap);

            const yarnStringStart = { x: Math.round(yarnX) + 3, y: yarnY + 5 };
            const catPawX = Math.round(catX) + (direction > 0 ? 6 : 0);
            const catPawY = 7;
            ctx.strokeStyle = lightPink;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(yarnStringStart.x * px, yarnStringStart.y * px);
            const midX = (yarnStringStart.x + catPawX) / 2 * px;
            const midY = (yarnStringStart.y + catPawY) / 2 * px - 4;
            ctx.quadraticCurveTo(midX, midY, catPawX * px, catPawY * px);
            ctx.stroke();

            for (let i = 0; i < 3; i++) {
                const tx = Math.round(catX) + (direction > 0 ? -2 - i : 7 + i);
                const ty = 6 + Math.round(Math.sin(tailAngle + i * 0.6) * 1);
                drawPixel(tx, ty, pink);
                drawPixel(tx, ty + 1, pink);
            }
            tailAngle += 0.18;

            const catSprite = catFrames[catFrame];
            drawSprite(catSprite, Math.round(catX), 2, colorMap);

            if (!isBlinking) {
                drawPixel(Math.round(catX) + 2, 4, black);
                drawPixel(Math.round(catX) + 5, 4, black);
            } else {
                ctx.fillStyle = black;
                ctx.fillRect((Math.round(catX) + 2) * px, 4 * px + px * 0.6, px, 1);
                ctx.fillRect((Math.round(catX) + 5) * px, 4 * px + px * 0.6, px, 1);
            }

            drawPixel(Math.round(catX) + 3, 5, black);

            const earX1 = Math.round(catX) + 1;
            const earX2 = Math.round(catX) + 5;
            drawPixel(earX1, 2, darkPink);
            drawPixel(earX2, 2, darkPink);

            for (let i = 0; i < 3; i++) {
                const sparkX = Math.round(catX) + 8 + i * 2;
                const sparkY = 3 + Math.round(Math.sin(frame * 0.15 + i * 1.2) * 1.5);
                if (frame % 20 < 10 + i * 3) {
                    drawPixel(sparkX, sparkY, lightPink);
                }
            }

            const heartX = Math.round(catX) + (direction > 0 ? -4 : 8);
            const heartY = 1 + Math.round(Math.sin(frame * 0.08) * 0.5);
            if (frame % 40 < 25) {
                drawPixel(heartX, heartY, darkPink);
                drawPixel(heartX + 1, heartY, darkPink);
                drawPixel(heartX - 1, heartY + 1, darkPink);
                drawPixel(heartX, heartY + 1, darkPink);
                drawPixel(heartX + 1, heartY + 1, darkPink);
                drawPixel(heartX, heartY + 2, darkPink);
            }

            this._catLoaderFrame = requestAnimationFrame(animate);
        };

        this.stopCatLoader();
        this._catLoaderFrame = requestAnimationFrame(animate);
    }

    stopCatLoader() {
        if (this._catLoaderFrame) {
            cancelAnimationFrame(this._catLoaderFrame);
            this._catLoaderFrame = null;
        }
    }

    async exportPNG() {
        const dims = this.getExportDimensions();
        const offCanvas = document.createElement('canvas');
        offCanvas.width = dims.width;
        offCanvas.height = dims.height;
        offCanvas.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
        document.body.appendChild(offCanvas);
        const offCtx = offCanvas.getContext('2d');

        const saved = {
            canvas: this.canvas, ctx: this.ctx,
            animProgress: this.state.animProgress,
            animStartTime: this.animStartTime,
            cachedRidges: this.cachedRidges,
            cachedRidgeParams: this.cachedRidgeParams,
            ridgeAppearOrder: [...this.ridgeAppearOrder],
            ridgeColorMap: [...this.ridgeColorMap]
        };
        this.canvas = offCanvas;
        this.ctx = offCtx;
        this.cachedRidges = null;
        this.cachedRidgeParams = null;
        this.state.animProgress = 1;

        try {
            this.render();

            this.setupPreviewCanvas(dims);
            const previewCanvas = document.getElementById('previewCanvas');
            const previewCtx = previewCanvas.getContext('2d');
            previewCtx.drawImage(offCanvas, 0, 0, previewCanvas.width, previewCanvas.height);

            document.getElementById('previewSizeInfo').textContent = `${dims.width} × ${dims.height} px`;

            this.showPreviewArea(true);
            this.showProgressArea(false);
            this.showModal(true);

            this._pendingExportBlob = null;
            this._pendingExportExt = 'png';

            offCanvas.toBlob((blob) => {
                this._pendingExportBlob = blob;
            }, 'image/png');

            const confirmHandler = () => {
                if (this._pendingExportBlob) this.downloadBlob(this._pendingExportBlob, 'png');
                this.showModal(false);
                cleanup();
            };

            const cancelHandler = () => {
                this.showModal(false);
                cleanup();
            };

            const cleanup = () => {
                document.getElementById('confirmExport').removeEventListener('click', confirmHandler);
                document.getElementById('cancelPreview').removeEventListener('click', cancelHandler);
            };

            document.getElementById('confirmExport').addEventListener('click', confirmHandler);
            document.getElementById('cancelPreview').addEventListener('click', cancelHandler);
        } finally {
            this.canvas = saved.canvas;
            this.ctx = saved.ctx;
            this.state.animProgress = saved.animProgress;
            this.animStartTime = saved.animStartTime;
            this.cachedRidges = saved.cachedRidges;
            this.cachedRidgeParams = saved.cachedRidgeParams;
            this.ridgeAppearOrder = saved.ridgeAppearOrder;
            this.ridgeColorMap = saved.ridgeColorMap;
            if (offCanvas.parentNode) document.body.removeChild(offCanvas);
        }
    }

    async exportGIF() {
        this.exporting = true;
        this.exportCancel = false;
        this.showPreviewArea(false);
        this.showProgressArea(true);
        this.showModal(true);
        this.updateProgress(0, '准备中...');

        const isScanMode = this.state.animPattern === 'scan';
        const plan = this.buildExportPlan('gif', this.state.gifFps);
        const canvases = this.makeExportCanvases(plan);

        const saved = {
            canvas: this.canvas, ctx: this.ctx,
            animProgress: this.state.animProgress,
            animStartTime: this.animStartTime,
            cachedRidges: this.cachedRidges,
            cachedRidgeParams: this.cachedRidgeParams,
            ridgeAppearOrder: [...this.ridgeAppearOrder],
            ridgeColorMap: [...this.ridgeColorMap],
            renderTimeOverride: this._renderTimeOverride,
            scanProgressOverride: this._scanProgressOverride,
            scanMetricsCache: this._scanMetricsCache,
            scanTotalMs: this._scanTotalMs
        };
        this.canvas = canvases.layoutCanvas;
        this.ctx = canvases.layoutCtx;
        this.cachedRidges = null;
        this.cachedRidgeParams = null;
        this._scanMetricsCache = null;

        try {
            const frames = [];

            this.renderExportFrame(canvases, 0, 4000, isScanMode);
            const duration = this.getCurrentExportDurationMs(isScanMode);
            const framePlan = this.buildFramePlan(duration, plan.fps, plan.maxFrames);

            for (let i = 0; i < framePlan.totalFrames; i++) {
                if (this.exportCancel) throw new Error('cancelled');

                const progress = framePlan.progressAt(i);
                this.renderExportFrame(canvases, progress, duration, isScanMode);

                const imageData = canvases.outputCtx.getImageData(0, 0, plan.outputDims.width, plan.outputDims.height);
                frames.push({
                    data: imageData.data,
                    width: plan.outputDims.width,
                    height: plan.outputDims.height,
                    delay: framePlan.frameDelayMs
                });

                this.updateProgress(Math.floor(((i + 1) / framePlan.totalFrames) * 70), '渲染中...');
                if (i % 3 === 0) await new Promise(r => setTimeout(r, 0));
            }

            this.updateProgress(70, '编码GIF...');
            await new Promise(r => setTimeout(r, 50));

            const blob = await this.encodeGIF(frames, (p) => {
                this.updateProgress(70 + Math.floor(p * 30), '编码中...');
            });

            this.renderExportFrame(canvases, 1, duration, isScanMode);

            this.setupPreviewCanvas(plan.outputDims);
            const previewCanvas = document.getElementById('previewCanvas');
            const previewCtx = previewCanvas.getContext('2d');
            previewCtx.drawImage(canvases.outputCanvas, 0, 0, previewCanvas.width, previewCanvas.height);

            const sizeMB = blob ? (blob.size / 1024 / 1024).toFixed(1) : '?';
            document.getElementById('previewSizeInfo').textContent =
                `${plan.outputDims.width} × ${plan.outputDims.height} px · ${framePlan.totalFrames}帧 · ${plan.fps}fps${this.formatScaledInfo(plan)} · ${sizeMB}MB`;

            this._pendingExportBlob = blob;
            this._pendingExportExt = 'gif';

            this.showPreviewArea(true);
            this.showProgressArea(false);

            const confirmHandler = () => {
                this.downloadBlob(this._pendingExportBlob, 'gif');
                this.showModal(false);
                cleanup();
            };

            const cancelHandler = () => {
                this.showModal(false);
                cleanup();
            };

            const cleanup = () => {
                document.getElementById('confirmExport').removeEventListener('click', confirmHandler);
                document.getElementById('cancelPreview').removeEventListener('click', cancelHandler);
            };

            document.getElementById('confirmExport').addEventListener('click', confirmHandler);
            document.getElementById('cancelPreview').addEventListener('click', cancelHandler);

        } catch (e) {
            if (e.message !== 'cancelled') {
                console.error('GIF export error:', e);
                alert('GIF导出失败: ' + e.message);
            }
            this.showModal(false);
        } finally {
            this.canvas = saved.canvas;
            this.ctx = saved.ctx;
            this.state.animProgress = saved.animProgress;
            this.animStartTime = saved.animStartTime;
            this.cachedRidges = saved.cachedRidges;
            this.cachedRidgeParams = saved.cachedRidgeParams;
            this.ridgeAppearOrder = saved.ridgeAppearOrder;
            this.ridgeColorMap = saved.ridgeColorMap;
            this._renderTimeOverride = saved.renderTimeOverride;
            this._scanProgressOverride = saved.scanProgressOverride;
            this._scanMetricsCache = saved.scanMetricsCache;
            this._scanTotalMs = saved.scanTotalMs;
            this.removeExportCanvases(canvases);
            this.exporting = false;
            this.render();
        }
    }

    async encodeGIF(frames, onProgress) {
        const w = frames[0].width;
        const h = frames[0].height;

        const palette = this.buildPalette(frames);
        const colorTable = palette.colors;
        const paletteSize = 256;

        const chunks = [];
        let curChunk = new Uint8Array(65536);
        let curPos = 0;

        const flush = () => {
            if (curPos > 0) {
                chunks.push(curChunk.slice(0, curPos));
                curChunk = new Uint8Array(65536);
                curPos = 0;
            }
        };

        const ensure = (n) => {
            if (curPos + n > curChunk.length) flush();
        };

        const writeByte = (b) => {
            if (curPos >= curChunk.length) flush();
            curChunk[curPos++] = b & 0xff;
        };
        const writeShort = (s) => { writeByte(s); writeByte(s >> 8); };
        const writeString = (s) => { for (let i = 0; i < s.length; i++) writeByte(s.charCodeAt(i)); };
        const writeBytes = (arr) => { for (let i = 0; i < arr.length; i++) writeByte(arr[i]); };

        writeString('GIF89a');
        writeShort(w);
        writeShort(h);
        writeByte(0xf7);
        writeByte(0);
        writeByte(0);

        for (let i = 0; i < paletteSize; i++) {
            if (i < colorTable.length) {
                writeByte(colorTable[i][0]);
                writeByte(colorTable[i][1]);
                writeByte(colorTable[i][2]);
            } else {
                writeByte(0); writeByte(0); writeByte(0);
            }
        }

        writeByte(0x21);
        writeByte(0xff);
        writeByte(11);
        writeString('NETSCAPE2.0');
        writeByte(3);
        writeByte(1);
        writeShort(0);
        writeByte(0);

        for (let f = 0; f < frames.length; f++) {
            if (onProgress) onProgress(f / frames.length);
            await new Promise(r => setTimeout(r, 0));

            const frame = frames[f];
            const indexed = this.quantizeFrame(frame, palette);

            writeByte(0x21);
            writeByte(0xf9);
            writeByte(4);
            writeByte(0x00);
            writeShort(Math.max(1, Math.round(frame.delay / 10)));
            writeByte(0);
            writeByte(0);

            writeByte(0x2c);
            writeShort(0);
            writeShort(0);
            writeShort(w);
            writeShort(h);
            writeByte(0);

            const minCodeSize = 8;
            writeByte(minCodeSize);

            const lzwData = this.lzwEncode(indexed, minCodeSize);
            let offset = 0;
            while (offset < lzwData.length) {
                const chunkSize = Math.min(255, lzwData.length - offset);
                writeByte(chunkSize);
                for (let i = 0; i < chunkSize; i++) {
                    writeByte(lzwData[offset + i]);
                }
                offset += chunkSize;
            }
            writeByte(0);
        }

        writeByte(0x3b);
        flush();

        return new Blob(chunks, { type: 'image/gif' });
    }

    buildPalette(frames) {
        const colorMap = new Map();
        const step = Math.max(1, Math.floor(frames.length / 5));

        for (let f = 0; f < frames.length; f += step) {
            const data = frames[f].data;
            const pixelStep = Math.max(1, Math.floor(data.length / 4 / 5000));
            for (let i = 0; i < data.length; i += 4 * pixelStep) {
                const r = data[i] >> 4;
                const g = data[i + 1] >> 4;
                const b = data[i + 2] >> 4;
                const key = (r << 8) | (g << 4) | b;
                colorMap.set(key, (colorMap.get(key) || 0) + 1);
            }
        }

        const sorted = [...colorMap.entries()].sort((a, b) => b[1] - a[1]);
        const colors = [];
        const indexMap = new Map();

        for (let i = 0; i < Math.min(255, sorted.length); i++) {
            const key = sorted[i][0];
            const r = (key >> 8) & 0xf;
            const g = (key >> 4) & 0xf;
            const b = key & 0xf;
            const fullR = r << 4 | r;
            const fullG = g << 4 | g;
            const fullB = b << 4 | b;
            colors.push([fullR, fullG, fullB]);
            indexMap.set(key, i);
        }

        while (colors.length < 256) {
            colors.push([0, 0, 0]);
        }

        const lut = new Uint8Array(4096);
        for (let key = 0; key < 4096; key++) {
            if (indexMap.has(key)) {
                lut[key] = indexMap.get(key);
            } else {
                const r4 = (key >> 8) & 0xf;
                const g4 = (key >> 4) & 0xf;
                const b4 = key & 0xf;
                const fullR = r4 << 4 | r4;
                const fullG = g4 << 4 | g4;
                const fullB = b4 << 4 | b4;
                let bestDist = Infinity;
                let bestIdx = 0;
                for (let c = 0; c < colors.length; c++) {
                    const dr = fullR - colors[c][0];
                    const dg = fullG - colors[c][1];
                    const db = fullB - colors[c][2];
                    const dist = dr * dr + dg * dg + db * db;
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestIdx = c;
                    }
                }
                lut[key] = bestIdx;
            }
        }

        return { colors, indexMap, lut };
    }

    quantizeFrame(frame, palette) {
        const lut = palette.lut;
        const data = frame.data;
        const w = frame.width;
        const h = frame.height;
        const indexed = new Uint8Array(w * h);

        for (let i = 0; i < w * h; i++) {
            const r = data[i * 4] >> 4;
            const g = data[i * 4 + 1] >> 4;
            const b = data[i * 4 + 2] >> 4;
            indexed[i] = lut[(r << 8) | (g << 4) | b];
        }

        return indexed;
    }

    lzwEncode(indexed, minCodeSize) {
        const clearCode = 1 << minCodeSize;
        const eoiCode = clearCode + 1;
        let codeSize = minCodeSize + 1;
        let nextCode = eoiCode + 1;

        const codeTable = new Map();

        const output = [];
        let bitBuf = 0;
        let bitCount = 0;

        const writeBits = (code, size) => {
            bitBuf |= (code << bitCount);
            bitCount += size;
            while (bitCount >= 8) {
                output.push(bitBuf & 0xff);
                bitBuf >>= 8;
                bitCount -= 8;
            }
        };

        writeBits(clearCode, codeSize);

        let currentCode = indexed[0];

        for (let i = 1; i < indexed.length; i++) {
            const ch = indexed[i];
            const key = currentCode * 65536 + ch;

            if (codeTable.has(key)) {
                currentCode = codeTable.get(key);
            } else {
                writeBits(currentCode, codeSize);

                if (nextCode < 4096) {
                    codeTable.set(key, nextCode);
                    if (nextCode >= (1 << codeSize)) {
                        codeSize++;
                    }
                    nextCode++;
                } else {
                    writeBits(clearCode, codeSize);
                    codeTable.clear();
                    codeSize = minCodeSize + 1;
                    nextCode = eoiCode + 1;
                }

                currentCode = ch;
            }
        }

        writeBits(currentCode, codeSize);
        writeBits(eoiCode, codeSize);

        if (bitCount > 0) {
            output.push(bitBuf & 0xff);
        }

        return output;
    }

    async exportMP4() {
        this.exporting = true;
        this.exportCancel = false;
        this.showPreviewArea(false);
        this.showProgressArea(true);
        this.showModal(true);
        this.updateProgress(0, '准备中...');

        const isScanMode = this.state.animPattern === 'scan';
        const plan = this.buildExportPlan('mp4', 24);
        const canvases = this.makeExportCanvases(plan);

        const saved = {
            canvas: this.canvas, ctx: this.ctx,
            animProgress: this.state.animProgress,
            animStartTime: this.animStartTime,
            cachedRidges: this.cachedRidges,
            cachedRidgeParams: this.cachedRidgeParams,
            ridgeAppearOrder: [...this.ridgeAppearOrder],
            ridgeColorMap: [...this.ridgeColorMap],
            renderTimeOverride: this._renderTimeOverride,
            scanProgressOverride: this._scanProgressOverride,
            scanMetricsCache: this._scanMetricsCache,
            scanTotalMs: this._scanTotalMs
        };
        this.canvas = canvases.layoutCanvas;
        this.ctx = canvases.layoutCtx;
        this.cachedRidges = null;
        this.cachedRidgeParams = null;
        this._scanMetricsCache = null;

        try {
            let videoBlob;
            let ext = 'mp4';

            this.renderExportFrame(canvases, 0, 4000, isScanMode);
            const duration = this.getCurrentExportDurationMs(isScanMode);
            const framePlan = this.buildFramePlan(duration, plan.fps, plan.maxFrames);

            const encodeGifFallback = async (status) => {
                const gifFrames = [];
                for (let i = 0; i < framePlan.totalFrames; i++) {
                    if (this.exportCancel) throw new Error('cancelled');

                    const progress = framePlan.progressAt(i);
                    this.renderExportFrame(canvases, progress, duration, isScanMode);

                    const imgData = canvases.outputCtx.getImageData(0, 0, plan.outputDims.width, plan.outputDims.height);
                    gifFrames.push({
                        data: imgData.data,
                        width: plan.outputDims.width,
                        height: plan.outputDims.height,
                        delay: framePlan.frameDelayMs
                    });

                    this.updateProgress(Math.floor(((i + 1) / framePlan.totalFrames) * 70), '渲染中...');
                    if (i % 3 === 0) await new Promise(r => setTimeout(r, 0));
                }

                this.updateProgress(70, status || '编码GIF...');
                await new Promise(r => setTimeout(r, 50));

                return this.encodeGIF(gifFrames, (p) => {
                    this.updateProgress(70 + Math.floor(p * 25), '编码中...');
                });
            };

            const recorderProfile = this.selectVideoRecorderType();
            if (recorderProfile) {
                try {
                    videoBlob = await this.recordCanvasVideo(canvases, framePlan, duration, isScanMode, recorderProfile);
                    ext = recorderProfile.ext;
                } catch (recordError) {
                    if (recordError.message === 'cancelled') throw recordError;
                    console.warn('Native video recording failed, falling back to GIF:', recordError);
                    videoBlob = await encodeGifFallback('视频录制不可用，生成GIF...');
                    ext = 'gif';
                }
            } else {
                videoBlob = await encodeGifFallback('当前浏览器不支持可播放视频，生成GIF...');
                ext = 'gif';
            }

            this.renderExportFrame(canvases, 1, duration, isScanMode);

            this.setupPreviewCanvas(plan.outputDims);
            const previewCanvas = document.getElementById('previewCanvas');
            const previewCtx = previewCanvas.getContext('2d');
            previewCtx.drawImage(canvases.outputCanvas, 0, 0, previewCanvas.width, previewCanvas.height);

            const sizeMB = videoBlob ? (videoBlob.size / 1024 / 1024).toFixed(1) : '?';
            document.getElementById('previewSizeInfo').textContent =
                `${plan.outputDims.width} × ${plan.outputDims.height} px · ${framePlan.totalFrames}帧 · ${plan.fps}fps${this.formatScaledInfo(plan)} · ${ext.toUpperCase()} · ${sizeMB}MB`;

            this._pendingExportBlob = videoBlob;
            this._pendingExportExt = ext;

            this.showPreviewArea(true);
            this.showProgressArea(false);

            const confirmHandler = () => {
                this.downloadBlob(this._pendingExportBlob, this._pendingExportExt);
                this.showModal(false);
                cleanup();
            };

            const cancelHandler = () => {
                this.showModal(false);
                cleanup();
            };

            const cleanup = () => {
                document.getElementById('confirmExport').removeEventListener('click', confirmHandler);
                document.getElementById('cancelPreview').removeEventListener('click', cancelHandler);
            };

            document.getElementById('confirmExport').addEventListener('click', confirmHandler);
            document.getElementById('cancelPreview').addEventListener('click', cancelHandler);

        } catch (e) {
            if (e.message !== 'cancelled') {
                console.error('Video export error:', e);
                alert('视频导出失败: ' + e.message);
            }
            this.showModal(false);
        } finally {
            this.canvas = saved.canvas;
            this.ctx = saved.ctx;
            this.state.animProgress = saved.animProgress;
            this.animStartTime = saved.animStartTime;
            this.cachedRidges = saved.cachedRidges;
            this.cachedRidgeParams = saved.cachedRidgeParams;
            this.ridgeAppearOrder = saved.ridgeAppearOrder;
            this.ridgeColorMap = saved.ridgeColorMap;
            this._renderTimeOverride = saved.renderTimeOverride;
            this._scanProgressOverride = saved.scanProgressOverride;
            this._scanMetricsCache = saved.scanMetricsCache;
            this._scanTotalMs = saved.scanTotalMs;
            this.removeExportCanvases(canvases);
            this.exporting = false;
            this.render();
        }
    }

    encodeMP4MJPEG(frames, width, height, fps, onProgress) {
        const numFrames = frames.length;
        const timescale = fps;
        const duration = numFrames;

        const uint32BE = (v) => {
            const b = new Uint8Array(4);
            b[0] = (v >> 24) & 0xff; b[1] = (v >> 16) & 0xff;
            b[2] = (v >> 8) & 0xff; b[3] = v & 0xff;
            return b;
        };
        const uint16BE = (v) => new Uint8Array([(v >> 8) & 0xff, v & 0xff]);
        const str4 = (s) => {
            const b = new Uint8Array(4);
            for (let i = 0; i < 4; i++) b[i] = s.charCodeAt(i);
            return b;
        };
        const concat = (...arrs) => {
            let len = 0;
            for (const a of arrs) len += a.length;
            const r = new Uint8Array(len);
            let off = 0;
            for (const a of arrs) { r.set(a, off); off += a.length; }
            return r;
        };
        const box = (type, ...data) => {
            const c = concat(...data);
            return concat(uint32BE(8 + c.length), str4(type), c);
        };
        const fullbox = (type, ver, flags, ...data) => {
            const c = concat(...data);
            return concat(uint32BE(12 + c.length), str4(type),
                new Uint8Array([ver, (flags >> 16) & 0xff, (flags >> 8) & 0xff, flags & 0xff]), c);
        };

        const ftyp = box('ftyp', str4('isom'), uint32BE(0x200), str4('isom'), str4('iso2'), str4('mp41'));

        const stts = fullbox('stts', 0, 0, uint32BE(1), uint32BE(numFrames), uint32BE(1));
        const stsc = fullbox('stsc', 0, 0, uint32BE(1), uint32BE(1), uint32BE(numFrames), uint32BE(1));

        const stszParts = [uint32BE(0), uint32BE(numFrames)];
        for (let i = 0; i < numFrames; i++) stszParts.push(uint32BE(frames[i].length));
        const stsz = fullbox('stsz', 0, 0, concat(...stszParts));

        const stcoPlaceholder = fullbox('stco', 0, 0, uint32BE(1), uint32BE(0));

        const mjpgEntry = concat(
            str4('mjpg'), new Uint8Array(6), uint16BE(1), new Uint8Array(16),
            uint16BE(width), uint16BE(height),
            uint32BE(0x00480000), uint32BE(0x00480000),
            uint32BE(0), uint16BE(1), new Uint8Array(32),
            uint16BE(0x0018), new Uint8Array([0xff, 0xff])
        );
        const stsd = fullbox('stsd', 0, 0, uint32BE(1), mjpgEntry);

        const stbl = box('stbl', stsd, stts, stsc, stsz, stcoPlaceholder);
        const urlBox = fullbox('url ', 0, 1);
        const dref = fullbox('dref', 0, 0, uint32BE(1), urlBox);
        const dinf = box('dinf', dref);
        const vmhd = fullbox('vmhd', 0, 1, uint16BE(0), uint16BE(0), uint16BE(0), uint16BE(0));
        const minf = box('minf', vmhd, dinf, stbl);

        const hdlrData = concat(uint32BE(0), str4('vide'), new Uint8Array(12),
            new Uint8Array([0x56, 0x69, 0x64, 0x65, 0x6F, 0x48, 0x61, 0x6E, 0x64, 0x6C, 0x65, 0x72, 0x00]));
        const hdlr = fullbox('hdlr', 0, 0, hdlrData);

        const mdhd = fullbox('mdhd', 0, 0, uint32BE(0), uint32BE(0), uint32BE(timescale), uint32BE(duration), uint16BE(0x55C4), uint16BE(0));
        const mdia = box('mdia', mdhd, hdlr, minf);

        const tkhd = fullbox('tkhd', 0, 3,
            uint32BE(0), uint32BE(0),
            uint32BE(1), uint32BE(0), uint32BE(duration),
            new Uint8Array(8), uint16BE(0), uint16BE(0), uint16BE(0), uint16BE(0),
            uint32BE(0x00010000), uint32BE(0), uint32BE(0),
            uint32BE(0), uint32BE(0x00010000), uint32BE(0),
            uint32BE(0), uint32BE(0), uint32BE(0x40000000),
            uint32BE(width << 16), uint32BE(height << 16));
        const trak = box('trak', tkhd, mdia);

        const mvhd = fullbox('mvhd', 0, 0,
            uint32BE(0), uint32BE(0),
            uint32BE(timescale), uint32BE(duration), uint32BE(0x00010000),
            uint16BE(0x0100), uint16BE(0), new Uint8Array(10),
            uint32BE(0x00010000), uint32BE(0), uint32BE(0),
            uint32BE(0), uint32BE(0x00010000), uint32BE(0),
            uint32BE(0), uint32BE(0), uint32BE(0x40000000),
            new Uint8Array(24), uint32BE(2));
        const moov = box('moov', mvhd, trak);

        const mdatHeaderSize = 8;
        const chunkOffset = ftyp.length + moov.length + mdatHeaderSize;

        const stco = fullbox('stco', 0, 0, uint32BE(1), uint32BE(chunkOffset));
        const stbl2 = box('stbl', stsd, stts, stsc, stsz, stco);
        const minf2 = box('minf', vmhd, dinf, stbl2);
        const mdia2 = box('mdia', mdhd, hdlr, minf2);
        const trak2 = box('trak', tkhd, mdia2);
        const moov2 = box('moov', mvhd, trak2);

        let finalMoov = moov2;
        if (moov2.length !== moov.length) {
            const co2 = ftyp.length + moov2.length + mdatHeaderSize;
            const stco3 = fullbox('stco', 0, 0, uint32BE(1), uint32BE(co2));
            const stbl3 = box('stbl', stsd, stts, stsc, stsz, stco3);
            const minf3 = box('minf', vmhd, dinf, stbl3);
            const mdia3 = box('mdia', mdhd, hdlr, minf3);
            const trak3 = box('trak', tkhd, mdia3);
            finalMoov = box('moov', mvhd, trak3);
        }

        const mdatParts = [];
        for (let i = 0; i < numFrames; i++) {
            if (onProgress && i % 10 === 0) onProgress(i / numFrames);
            mdatParts.push(frames[i]);
        }
        const mdat = box('mdat', concat(...mdatParts));

        return new Blob([concat(ftyp, finalMoov, mdat)], { type: 'video/mp4' });
    }

    getExportMimeType(ext) {
        return this.getExportUtils().getExportMimeType(ext);
    }

    getExportFileName(ext) {
        return `fingerprint-text-${Date.now()}.${ext}`;
    }

    tryShareExportFile(blob, ext) {
        if (!blob || !this.isMobileDevice() || typeof navigator.share !== 'function' || typeof File !== 'function') {
            return false;
        }

        const fileName = this.getExportFileName(ext);
        const file = new File([blob], fileName, { type: blob.type || this.getExportMimeType(ext) });
        const shareData = {
            files: [file],
            title: '指纹文字导出'
        };

        if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: shareData.files })) {
            return false;
        }

        try {
            const sharePromise = navigator.share(shareData);
            if (sharePromise && typeof sharePromise.catch === 'function') {
                sharePromise.catch((error) => {
                    if (error && error.name === 'AbortError') return;
                    console.warn('系统分享失败，改用下载:', error);
                    this.downloadBlobFallback(blob, ext);
                });
            }
            return true;
        } catch (error) {
            console.warn('系统分享不可用，改用下载:', error);
            return false;
        }
    }

    downloadBlobFallback(blob, ext) {
        if (!blob) return;
        const fileName = this.getExportFileName(ext);
        const isIOS = this.isIOSDevice();
        if (isIOS && ext !== 'png') {
            const url = URL.createObjectURL(blob);
            if (ext === 'gif') {
                const overlay = document.createElement('div');
                overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
                const img = document.createElement('img');
                img.src = url;
                img.style.cssText = 'max-width:90%;max-height:60vh;border-radius:8px;object-fit:contain;';
                const tip = document.createElement('p');
                tip.style.cssText = 'color:#FF6B9D;font-size:14px;margin-top:16px;text-align:center;';
                tip.textContent = '长按图片 → 保存到相册';
                const closeBtn = document.createElement('button');
                closeBtn.textContent = '关闭';
                closeBtn.style.cssText = 'margin-top:12px;padding:8px 24px;background:#333;color:#fff;border:1px solid #555;border-radius:6px;font-size:14px;';
                closeBtn.onclick = () => {
                    document.body.removeChild(overlay);
                    URL.revokeObjectURL(url);
                };
                overlay.appendChild(img);
                overlay.appendChild(tip);
                overlay.appendChild(closeBtn);
                document.body.appendChild(overlay);
            } else {
                const win = window.open(url, '_blank');
                if (!win) {
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
                setTimeout(() => URL.revokeObjectURL(url), 60000);
            }
        } else {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = fileName;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    }

    downloadBlob(blob, ext) {
        if (!blob) return;
        if (ext !== 'png' && this.tryShareExportFile(blob, ext)) return;
        this.downloadBlobFallback(blob, ext);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new FingerprintTextApp();
    app.state.text = document.getElementById('textInput').value;
    app.render();
});
