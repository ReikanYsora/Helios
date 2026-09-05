import '../src/helios-card';
import { HeliosCard } from '../src/helios-card';
import { HeliosEngine } from '../src/scene/helios-engine';
import { MockHassManager, defaultSandboxConfig, type SandboxSimState } from './mock-hass';
import type { HeliosConfig } from '../src/core/config/helios-config';

const STORAGE_KEY_CONFIG = 'helios_sandbox_config';
const STORAGE_KEY_SIM = 'helios_sandbox_sim';
const STORAGE_KEY_UI = 'helios_sandbox_ui';

// ══════════════════════════════════════════════════════════════════════════════
// Sandbox-only overrides (monkey-patches on HeliosEngine prototype)
// These replicate features from the development patch without modifying src/.
// ══════════════════════════════════════════════════════════════════════════════

const DEFAULT_ARC_ZOOM  = 1;
const MIN_ARC_ZOOM      = 0.25;
const MAX_ARC_ZOOM      = 2;
const MIN_SCENE_ZOOM    = 0.25;
const MAX_SCENE_ZOOM    = 2;
const DEFAULT_SCENE_ZOOM = 1;

/** Read arc-zoom from config (continuous [0.25, 2], default 1). */
function readArcZoom(config: HeliosConfig | undefined): number {
    const raw = config?.['arc-zoom' as keyof HeliosConfig];
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= MIN_ARC_ZOOM && n <= MAX_ARC_ZOOM ? n : DEFAULT_ARC_ZOOM;
}

/** Read scene-zoom as a continuous value [0.25, 2] instead of the original discrete [1, 1.5, 2]. */
function continuousSceneZoom(config: HeliosConfig | undefined): number {
    const raw = config?.['scene-zoom' as keyof HeliosConfig];
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= MIN_SCENE_ZOOM && n <= MAX_SCENE_ZOOM ? n : DEFAULT_SCENE_ZOOM;
}

// ── Patch _sunArcScale: multiply the base arc scale by the arc-zoom factor ──
// Mathematically equivalent to the full src/ patch: max(a,min(b,c))*k === max(a*k,min(b*k,c*k)) for k>0.
const _origSunArcScale = (HeliosEngine.prototype as any)._sunArcScale;
(HeliosEngine.prototype as any)._sunArcScale = function (): number {
    const az = readArcZoom(this.cfg);
    return _origSunArcScale.call(this) * az;
};

// ── Patch updateConfig: continuous scene-zoom + arc-zoom cache invalidation ──
const _origUpdateConfig = HeliosEngine.prototype.updateConfig;
HeliosEngine.prototype.updateConfig = function (cfg: HeliosConfig): void {
    const prevCZ = continuousSceneZoom(this.cfg);
    const prevAZ = readArcZoom(this.cfg);

    _origUpdateConfig.call(this, cfg);

    const nextCZ = continuousSceneZoom(this.cfg);
    const nextAZ = readArcZoom(this.cfg);
    const renderer = (this as any)._renderer;

    // Continuous scene-zoom: the original only detects discrete [1, 1.5, 2] transitions;
    // apply the continuous value so intermediate slider positions take effect.
    if (nextCZ !== prevCZ && renderer) {
        renderer.setZoom(nextCZ);
        (this as any)._arcScaleMemo       = undefined;
        (this as any)._arcInputsCache     = undefined;
        (this as any)._moonArcInputsCache = undefined;
        renderer.scheduleRedraw();
    }

    // Arc-zoom: invalidate the arc projection caches so the next frame recomputes
    // with the new multiplier.
    if (nextAZ !== prevAZ) {
        (this as any)._arcScaleMemo       = undefined;
        (this as any)._arcInputsCache     = undefined;
        (this as any)._moonArcInputsCache = undefined;
        if (renderer) renderer.scheduleRedraw();
    }
};

// ══════════════════════════════════════════════════════════════════════════════

interface SandboxUIState {
    darkMode: boolean;
    sidebarCollapsed: boolean;
    activeTab: string;
    viewport: string;
    miniatureBlurEnabled: boolean;
    miniatureBlurLevel: number;
    miniatureVignetteOpacity: number;
}

class SandboxApp {
    private _hassManager = new MockHassManager();
    private _config: HeliosConfig = { ...defaultSandboxConfig };
    private _cardElement: HeliosCard | null = null;
    private _sidebarCollapsed = false;
    private _miniatureBlurEnabled = false;
    private _miniatureBlurLevel = 10;
    private _miniatureVignetteOpacity = 50;
    private _activeTab = 'config';
    private _activeViewport = 'desktop';

    public init(): void {
        this._cardElement = document.querySelector('helios-card') as HeliosCard;
        if (!this._cardElement) {
            console.error('Helios card element not found in DOM');
            return;
        }

        // Restore saved states from localStorage if present
        this._loadSavedState();

        // Connect mock Hass and initial config
        this._cardElement.setConfig(this._config);
        this._cardElement.hass = this._hassManager.createHassObject();

        // Listen for Hass state changes
        this._hassManager.onChange(() => {
            if (this._cardElement) {
                this._cardElement.hass = this._hassManager.createHassObject();
                this._cardElement.requestUpdate();
            }
        });

        this._bindUI();
        this._restoreSavedUI();
        this._updateConfigUI();
        this._updateSimUI();
        this._syncYamlUI();
        this._syncMiniatureVignette();
        this._syncShadowDOMOverrides();
    }

    private _loadSavedState(): void {
        try {
            // 1. Config
            const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
            if (savedConfig) {
                const parsedConfig = JSON.parse(savedConfig);
                this._config = { ...defaultSandboxConfig, ...parsedConfig };
                // Also sync coordinates to hassManager config if present
                if (typeof this._config['home-latitude'] === 'number' && typeof this._config['home-longitude'] === 'number') {
                    this._hassManager.updateConfig({
                        latitude: this._config['home-latitude'],
                        longitude: this._config['home-longitude'],
                    });
                }
            }

            // 2. SimState
            const savedSim = localStorage.getItem(STORAGE_KEY_SIM);
            if (savedSim) {
                const parsedSim = JSON.parse(savedSim);
                this._hassManager.updateSimState(parsedSim);
            }

            // 3. UI State
            const savedUI = localStorage.getItem(STORAGE_KEY_UI);
            if (savedUI) {
                const ui: Partial<SandboxUIState> = JSON.parse(savedUI);
                if (typeof ui.darkMode === 'boolean') {
                    this._hassManager.setDarkMode(ui.darkMode);
                }
                if (typeof ui.sidebarCollapsed === 'boolean') {
                    this._sidebarCollapsed = ui.sidebarCollapsed;
                }
                if (typeof ui.miniatureBlurEnabled === 'boolean') {
                    this._miniatureBlurEnabled = ui.miniatureBlurEnabled;
                }
                if (typeof ui.miniatureBlurLevel === 'number') {
                    this._miniatureBlurLevel = ui.miniatureBlurLevel;
                }
                if (typeof ui.miniatureVignetteOpacity === 'number') {
                    this._miniatureVignetteOpacity = ui.miniatureVignetteOpacity;
                }
                if (ui.activeTab) {
                    this._activeTab = ui.activeTab;
                }
                if (ui.viewport) {
                    this._activeViewport = ui.viewport;
                }
            }
        } catch (e) {
            console.warn('Failed to load sandbox saved state from localStorage:', e);
        }
    }

    private _saveConfigState(): void {
        try {
            localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this._config));
        } catch (e) {
            console.warn('Failed to save config to localStorage:', e);
        }
    }

    private _saveSimState(): void {
        try {
            localStorage.setItem(STORAGE_KEY_SIM, JSON.stringify(this._hassManager.simState));
        } catch (e) {
            console.warn('Failed to save simState to localStorage:', e);
        }
    }

    private _saveUIState(): void {
        try {
            const uiState: SandboxUIState = {
                darkMode: this._hassManager.darkMode,
                sidebarCollapsed: this._sidebarCollapsed,
                activeTab: this._activeTab,
                viewport: this._activeViewport,
                miniatureBlurEnabled: this._miniatureBlurEnabled,
                miniatureBlurLevel: this._miniatureBlurLevel,
                miniatureVignetteOpacity: this._miniatureVignetteOpacity,
            };
            localStorage.setItem(STORAGE_KEY_UI, JSON.stringify(uiState));
        } catch (e) {
            console.warn('Failed to save UI state to localStorage:', e);
        }
    }

    private _restoreSavedUI(): void {
        // Theme
        const isDark = this._hassManager.darkMode;
        document.body.classList.toggle('light-theme', !isDark);
        const btnTheme = document.getElementById('btn-theme-toggle');
        if (btnTheme) {
            btnTheme.innerHTML = isDark
                ? '<svg class="sb-icon" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg><span>Sombre</span>'
                : '<svg class="sb-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg><span>Clair</span>';
        }

        // Sidebar
        const sidebar = document.getElementById('sandbox-sidebar');
        const toggleBtn = document.getElementById('btn-toggle-sidebar');
        if (sidebar && toggleBtn) {
            sidebar.classList.toggle('collapsed', this._sidebarCollapsed);
            toggleBtn.classList.toggle('collapsed', this._sidebarCollapsed);
            toggleBtn.textContent = this._sidebarCollapsed ? '◀' : '▶';
        }

        // Tabs
        const tabs = document.querySelectorAll<HTMLButtonElement>('.sidebar-tab');
        const panes = document.querySelectorAll<HTMLElement>('.tab-pane');
        tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === this._activeTab));
        panes.forEach((p) => p.classList.toggle('active', p.id === `tab-${this._activeTab}`));

        // Viewport
        const frame = document.getElementById('card-frame');
        document.querySelectorAll<HTMLButtonElement>('.viewport-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.viewport === this._activeViewport);
        });
        if (frame) {
            frame.classList.remove('viewport-desktop', 'viewport-tablet', 'viewport-mobile');
            frame.classList.add(`viewport-${this._activeViewport}`);
        }
    }

    private _syncMiniatureVignette(): void {
        if (!this._cardElement) return;
        const shadow = this._cardElement.shadowRoot;
        if (!shadow) {
            requestAnimationFrame(() => this._syncMiniatureVignette());
            return;
        }

        const blurPx = Math.max(0, this._miniatureBlurLevel);
        const vignetteAlpha = Math.max(0, Math.min(1, this._miniatureVignetteOpacity / 100));

        // Ensure the CSS rules exist inside the shadowRoot so the class works
        let styleTag = shadow.getElementById('miniature-vignette-style') as HTMLStyleElement | null;
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'miniature-vignette-style';
            shadow.appendChild(styleTag);
        }

        styleTag.textContent = `
            .blur-vignette {
                position: absolute;
                background-image: radial-gradient(
                    circle at center,
                    rgba(0, 0, 0, 0) 0%,
                    rgba(0, 0, 0, ${vignetteAlpha}) 85%
                );
                inset: 0;
                object-fit: cover;
                backdrop-filter: blur(${blurPx}px);
                -webkit-backdrop-filter: blur(${blurPx}px);
                mask-image: radial-gradient(
                    circle at center,
                    rgba(0, 0, 0, 0) 0%,
                    rgba(0, 0, 0, 1) 85%
                );
                -webkit-mask-image: radial-gradient(
                    circle at center,
                    rgba(0, 0, 0, 0) 0%,
                    rgba(0, 0, 0, 1) 85%
                );
                pointer-events: none;
                border-radius: inherit;
                z-index: 2;
            }
        `;

        const mapContainer = shadow.getElementById('map-container');
        const haCard = shadow.querySelector('ha-card');
        const parent = mapContainer ?? haCard;
        if (!parent) {
            requestAnimationFrame(() => this._syncMiniatureVignette());
            return;
        }

        let vignette = shadow.querySelector('.blur-vignette');
        if (this._miniatureBlurEnabled && (blurPx > 0 || vignetteAlpha > 0)) {
            if (!vignette) {
                vignette = document.createElement('div');
                vignette.className = 'blur-vignette';
                vignette.setAttribute('id', 'miniature-blur-vignette');
                parent.appendChild(vignette);
            }
        } else {
            vignette?.remove();
        }
    }

    /**
     * Inject battery-above-arc CSS rules and toggle the ha-card class
     * inside the card's Shadow DOM. Same injection pattern as _syncMiniatureVignette.
     */
    private _syncShadowDOMOverrides(): void {
        if (!this._cardElement) return;
        const shadow = this._cardElement.shadowRoot;
        if (!shadow) {
            requestAnimationFrame(() => this._syncShadowDOMOverrides());
            return;
        }

        // 1. Ensure the override <style> exists inside the shadow root
        let overrideStyle = shadow.getElementById('sandbox-override-style') as HTMLStyleElement | null;
        if (!overrideStyle) {
            overrideStyle = document.createElement('style');
            overrideStyle.id = 'sandbox-override-style';
            shadow.appendChild(overrideStyle);
        }
        overrideStyle.textContent = `
            /* battery-above-arc: elevate energy pills/chips above the solar arc (z 11) and sun disc (z 12). */
            ha-card.battery-above-arc .pv-pct-label,
            ha-card.battery-above-arc .battery-pct-label,
            ha-card.battery-above-arc .grid-label,
            ha-card.battery-above-arc .group-label,
            ha-card.battery-above-arc .home-pill,
            ha-card.battery-above-arc .home-ring
            {
                z-index: 13;
            }
            ha-card.battery-above-arc .helios-corner-chips
            {
                z-index: 13;
            }
            ha-card.battery-above-arc .pv-home-leader-svg,
            ha-card.battery-above-arc .battery-leader-svg,
            ha-card.battery-above-arc .grid-leader-svg,
            ha-card.battery-above-arc .group-leader-svg
            {
                z-index: 12;
            }
        `;

        // 2. Toggle the battery-above-arc class on <ha-card>
        const haCard = shadow.querySelector('ha-card');
        if (haCard) {
            const enabled = this._config['battery-above-arc' as keyof HeliosConfig] === true;
            haCard.classList.toggle('battery-above-arc', enabled);
        } else {
            // ha-card not rendered yet — retry next frame
            requestAnimationFrame(() => this._syncShadowDOMOverrides());
        }
    }

    private _applyConfig(newConfig: HeliosConfig): void {
        this._config = { ...newConfig };
        if (this._cardElement) {
            this._cardElement.setConfig(this._config);

            // arc-zoom and battery-above-arc are NOT in the original VISUAL_CONFIG_KEYS,
            // so setConfig alone won't push them to the engine via updateConfig.
            // Force the call directly on the engine instance (available as _engine on the card).
            const engine = (this._cardElement as any)._engine as HeliosEngine | undefined;
            if (engine) {
                engine.updateConfig(this._config);
            }
        }
        this._saveConfigState();
        this._syncYamlUI();
        this._syncMiniatureVignette();
        this._syncShadowDOMOverrides();
    }

    private _bindUI(): void {
        // Tabs
        const tabs = document.querySelectorAll<HTMLButtonElement>('.sidebar-tab');
        const panes = document.querySelectorAll<HTMLElement>('.tab-pane');
        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                if (!target) return;
                tabs.forEach((t) => t.classList.remove('active'));
                panes.forEach((p) => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`tab-${target}`)?.classList.add('active');
                this._activeTab = target;
                this._saveUIState();
            });
        });

        // Toggle Sidebar
        const toggleBtn = document.getElementById('btn-toggle-sidebar');
        const sidebar = document.getElementById('sandbox-sidebar');
        toggleBtn?.addEventListener('click', () => {
            this._sidebarCollapsed = !this._sidebarCollapsed;
            sidebar?.classList.toggle('collapsed', this._sidebarCollapsed);
            toggleBtn.classList.toggle('collapsed', this._sidebarCollapsed);
            toggleBtn.textContent = this._sidebarCollapsed ? '◀' : '▶';
            this._saveUIState();
        });

        // Dark / Light theme toggle
        const btnTheme = document.getElementById('btn-theme-toggle');
        btnTheme?.addEventListener('click', () => {
            const isDark = !this._hassManager.darkMode;
            this._hassManager.setDarkMode(isDark);
            document.body.classList.toggle('light-theme', !isDark);
            if (btnTheme) {
                btnTheme.innerHTML = isDark
                    ? '<svg class="sb-icon" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg><span>Sombre</span>'
                    : '<svg class="sb-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg><span>Clair</span>';
            }
            this._saveUIState();
        });

        // Viewport switcher
        const frame = document.getElementById('card-frame');
        document.querySelectorAll<HTMLButtonElement>('.viewport-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.viewport-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                const vp = btn.dataset.viewport;
                frame?.classList.remove('viewport-desktop', 'viewport-tablet', 'viewport-mobile');
                if (vp) {
                    frame?.classList.add(`viewport-${vp}`);
                    this._activeViewport = vp;
                    this._saveUIState();
                }
            });
        });

        // Reset cache button
        document.getElementById('btn-reset-cache')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('helios-data-cache-reset'));
            alert('Cache réinitialisé !');
        });

        // Bind Simulator controls
        this._bindSlider('sim-solar', 'val-solar', (v) => {
            this._hassManager.updateSimState({ solarPower: v });
            this._saveSimState();
        });
        this._bindSlider('sim-grid', 'val-grid', (v) => {
            this._hassManager.updateSimState({ gridPower: v });
            this._saveSimState();
        });
        this._bindSlider('sim-battery-power', 'val-battery-power', (v) => {
            this._hassManager.updateSimState({ batteryPower: v });
            this._saveSimState();
        });
        this._bindSlider('sim-battery-soc', 'val-battery-soc', (v) => {
            this._hassManager.updateSimState({ batterySoc: v });
            this._saveSimState();
        });
        this._bindSlider('sim-temp', 'val-temp', (v) => {
            this._hassManager.updateSimState({ temperature: v });
            this._saveSimState();
        });
        this._bindSlider('sim-humidity', 'val-humidity', (v) => {
            this._hassManager.updateSimState({ humidity: v });
            this._saveSimState();
        });

        const weatherSelect = document.getElementById('sim-weather') as HTMLSelectElement;
        weatherSelect?.addEventListener('change', () => {
            this._hassManager.updateSimState({ weatherCondition: weatherSelect.value });
            this._saveSimState();
        });

        // Presets
        document.querySelectorAll<HTMLButtonElement>('.preset-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const p = btn.dataset.preset;
                this._applyPreset(p);
                this._saveSimState();
            });
        });

        // Bind Config controls
        this._bindConfigSlider('cfg-radius', 'val-cfg-radius', 'display-radius');
        this._bindConfigSlider('cfg-bld-count', 'val-cfg-bld-count', 'building-count');
        this._bindConfigSlider('cfg-bld-opacity', 'val-cfg-bld-opacity', 'building-opacity', (v) => v / 100);
        this._bindConfigSlider('cfg-shadow-opacity', 'val-cfg-shadow-opacity', 'shadow-opacity', (v) => v / 100);
        this._bindConfigSlider('cfg-max-power', 'val-cfg-max-power', 'max-expected-power');

        this._bindConfigSwitch('cfg-shadows', 'shadows-enabled');
        this._bindConfigSwitch('cfg-bld-real-size', 'building-real-size');
        this._bindConfigSwitch('cfg-weather', 'weather-enabled');
        this._bindConfigSwitch('cfg-timeline', 'show-timeline');
        this._bindConfigSwitch('cfg-detail-panel', 'show-detail-panel');
        this._bindConfigSwitch('cfg-auto-rotate', 'auto-rotate-enabled');
        this._bindConfigSwitch('cfg-cam-locked', 'camera-locked');
        this._bindConfigSwitch('cfg-battery-above-arc', 'battery-above-arc');

        const miniatureSwitch = document.getElementById('cfg-miniature-blur') as HTMLInputElement;
        const miniatureBlurContainer = document.getElementById('cfg-miniature-blur-container');
        miniatureSwitch?.addEventListener('change', () => {
            this._miniatureBlurEnabled = miniatureSwitch.checked;
            if (miniatureBlurContainer) {
                miniatureBlurContainer.style.display = miniatureSwitch.checked ? 'flex' : 'none';
            }
            this._syncMiniatureVignette();
            this._saveUIState();
        });

        this._bindSlider('cfg-miniature-blur-level', 'val-cfg-miniature-blur', (val) => {
            this._miniatureBlurLevel = val;
            this._syncMiniatureVignette();
            this._saveUIState();
        });

        this._bindSlider('cfg-miniature-vignette-opacity', 'val-cfg-miniature-vignette-opacity', (val) => {
            this._miniatureVignetteOpacity = val;
            this._syncMiniatureVignette();
            this._saveUIState();
        });

        this._bindConfigSlider('cfg-zoom', 'val-cfg-zoom', 'scene-zoom', (v) => parseFloat(v.toFixed(2)));
        this._bindConfigSlider('cfg-arc-zoom', 'val-cfg-arc-zoom', 'arc-zoom', (v) => parseFloat(v.toFixed(2)));

        const mapModeSelect = document.getElementById('cfg-map-mode') as HTMLSelectElement;
        mapModeSelect?.addEventListener('change', () => {
            this._config['map-theme-mode'] = mapModeSelect.value;
            this._applyConfig(this._config);
        });

        // Coordinates input
        const latInput = document.getElementById('cfg-lat') as HTMLInputElement;
        const lonInput = document.getElementById('cfg-lon') as HTMLInputElement;
        const applyCoords = () => {
            const lat = parseFloat(latInput.value);
            const lon = parseFloat(lonInput.value);
            if (!isNaN(lat) && !isNaN(lon)) {
                this._config['home-latitude'] = lat;
                this._config['home-longitude'] = lon;
                this._hassManager.updateConfig({ latitude: lat, longitude: lon });
                this._applyConfig(this._config);
            }
        };
        latInput?.addEventListener('change', applyCoords);
        lonInput?.addEventListener('change', applyCoords);

        // Geolocation: Current location
        const btnCurrentLocation = document.getElementById('btn-current-location') as HTMLButtonElement | null;
        btnCurrentLocation?.addEventListener('click', () => {
            if (!('geolocation' in navigator)) {
                alert('La géolocalisation n\'est pas supportée par votre navigateur.');
                return;
            }
            const originalText = btnCurrentLocation.innerHTML;
            btnCurrentLocation.disabled = true;
            btnCurrentLocation.innerHTML = '<svg class="sb-icon spin" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span>Détection en cours...</span>';

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    btnCurrentLocation.disabled = false;
                    btnCurrentLocation.innerHTML = originalText;
                    const lat = parseFloat(pos.coords.latitude.toFixed(5));
                    const lon = parseFloat(pos.coords.longitude.toFixed(5));
                    if (latInput) latInput.value = String(lat);
                    if (lonInput) lonInput.value = String(lon);
                    applyCoords();
                },
                (err) => {
                    btnCurrentLocation.disabled = false;
                    btnCurrentLocation.innerHTML = originalText;
                    let msg = 'Impossible d\'obtenir la position actuelle : ';
                    switch (err.code) {
                        case err.PERMISSION_DENIED:
                            msg += 'Autorisation refusée par l\'utilisateur.';
                            break;
                        case err.POSITION_UNAVAILABLE:
                            msg += 'Position indisponible.';
                            break;
                        case err.TIMEOUT:
                            msg += 'Délai d\'attente dépassé.';
                            break;
                        default:
                            msg += err.message;
                    }
                    alert(msg);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000,
                }
            );
        });

        // Predefined city locations
        document.querySelectorAll<HTMLButtonElement>('.city-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const lat = parseFloat(btn.dataset.lat || '0');
                const lon = parseFloat(btn.dataset.lon || '0');
                if (latInput) latInput.value = String(lat);
                if (lonInput) lonInput.value = String(lon);
                applyCoords();
            });
        });

        // YAML Apply
        const yamlTextarea = document.getElementById('yaml-editor') as HTMLTextAreaElement;
        document.getElementById('btn-apply-yaml')?.addEventListener('click', () => {
            try {
                const parsed = JSON.parse(yamlTextarea.value);
                this._applyConfig(parsed);
                this._updateConfigUI();
                alert('Configuration appliquée avec succès !');
            } catch (err) {
                alert('Erreur de parsing JSON : ' + (err as Error).message);
            }
        });

        document.getElementById('btn-reset-yaml')?.addEventListener('click', () => {
            localStorage.removeItem(STORAGE_KEY_CONFIG);
            localStorage.removeItem(STORAGE_KEY_SIM);
            localStorage.removeItem(STORAGE_KEY_UI);
            this._miniatureBlurEnabled = false;
            this._miniatureBlurLevel = 10;
            this._applyConfig(defaultSandboxConfig);
            this._updateConfigUI();
            this._syncYamlUI();
        });
    }

    private _bindSlider(sliderId: string, valueId: string, onValue: (v: number) => void): void {
        const slider = document.getElementById(sliderId) as HTMLInputElement;
        const valueLabel = document.getElementById(valueId);
        slider?.addEventListener('input', () => {
            const val = parseFloat(slider.value);
            if (valueLabel) valueLabel.textContent = slider.value;
            onValue(val);
        });
    }

    private _bindConfigSlider(
        sliderId: string,
        valueId: string,
        key: keyof HeliosConfig,
        transform: (v: number) => number = (v) => v
    ): void {
        const slider = document.getElementById(sliderId) as HTMLInputElement;
        const valueLabel = document.getElementById(valueId);
        slider?.addEventListener('input', () => {
            const val = transform(parseFloat(slider.value));
            if (valueLabel) valueLabel.textContent = slider.value;
            this._config[key] = val;
            this._applyConfig(this._config);
        });
    }

    private _bindConfigSwitch(switchId: string, key: keyof HeliosConfig): void {
        const checkbox = document.getElementById(switchId) as HTMLInputElement;
        checkbox?.addEventListener('change', () => {
            this._config[key] = checkbox.checked;
            this._applyConfig(this._config);
        });
    }

    private _applyPreset(name: string | undefined): void {
        if (!name) return;
        let partial: Partial<SandboxSimState> = {};
        switch (name) {
            case 'noon_summer':
                partial = {
                    solarPower: 5600,
                    gridPower: -2400,
                    batteryPower: 2200,
                    batterySoc: 65,
                    temperature: 31,
                    humidity: 38,
                    weatherCondition: 'sunny',
                };
                break;
            case 'night_discharge':
                partial = {
                    solarPower: 0,
                    gridPower: 150,
                    batteryPower: -1850,
                    batterySoc: 48,
                    temperature: 16,
                    humidity: 75,
                    weatherCondition: 'clear-night',
                };
                break;
            case 'storm_import':
                partial = {
                    solarPower: 180,
                    gridPower: 3400,
                    batteryPower: 0,
                    batterySoc: 22,
                    temperature: 14,
                    humidity: 92,
                    weatherCondition: 'lightning-rainy',
                };
                break;
            case 'winter_snow':
                partial = {
                    solarPower: 450,
                    gridPower: 2800,
                    batteryPower: -500,
                    batterySoc: 30,
                    temperature: -2,
                    humidity: 88,
                    weatherCondition: 'snowy',
                };
                break;
        }
        this._hassManager.updateSimState(partial);
        this._updateSimUI();
    }

    private _updateSimUI(): void {
        const sim = this._hassManager.simState;
        const setVal = (id: string, val: string | number) => {
            const el = document.getElementById(id);
            if (el) el.textContent = String(val);
        };
        const setSlider = (id: string, val: number) => {
            const el = document.getElementById(id) as HTMLInputElement;
            if (el) el.value = String(val);
        };

        setSlider('sim-solar', sim.solarPower);
        setVal('val-solar', sim.solarPower);

        setSlider('sim-grid', sim.gridPower);
        setVal('val-grid', sim.gridPower);

        setSlider('sim-battery-power', sim.batteryPower);
        setVal('val-battery-power', sim.batteryPower);

        setSlider('sim-battery-soc', sim.batterySoc);
        setVal('val-battery-soc', sim.batterySoc);

        setSlider('sim-temp', sim.temperature);
        setVal('val-temp', sim.temperature);

        setSlider('sim-humidity', sim.humidity);
        setVal('val-humidity', sim.humidity);

        const weatherSel = document.getElementById('sim-weather') as HTMLSelectElement;
        if (weatherSel) weatherSel.value = sim.weatherCondition;
    }

    private _updateConfigUI(): void {
        const c = this._config;
        const setCheck = (id: string, val: unknown) => {
            const el = document.getElementById(id) as HTMLInputElement;
            if (el) el.checked = val !== false;
        };
        const setSlider = (id: string, valId: string, val: number) => {
            const el = document.getElementById(id) as HTMLInputElement;
            const lbl = document.getElementById(valId);
            if (el) el.value = String(val);
            if (lbl) lbl.textContent = String(val);
        };

        setSlider('cfg-radius', 'val-cfg-radius', Number(c['display-radius'] ?? 200));
        setSlider('cfg-bld-count', 'val-cfg-bld-count', Number(c['building-count'] ?? 50));
        setSlider('cfg-bld-opacity', 'val-cfg-bld-opacity', Math.round(Number(c['building-opacity'] ?? 0.5) * 100));
        setSlider('cfg-shadow-opacity', 'val-cfg-shadow-opacity', Math.round(Number(c['shadow-opacity'] ?? 0.32) * 100));
        setSlider('cfg-max-power', 'val-cfg-max-power', Number(c['max-expected-power'] ?? 5000));

        setCheck('cfg-shadows', c['shadows-enabled']);
        setCheck('cfg-bld-real-size', c['building-real-size']);
        setCheck('cfg-weather', c['weather-enabled']);
        setCheck('cfg-timeline', c['show-timeline']);
        setCheck('cfg-detail-panel', c['show-detail-panel']);
        setCheck('cfg-auto-rotate', c['auto-rotate-enabled'] === true);
        setCheck('cfg-cam-locked', c['camera-locked'] === true);
        setCheck('cfg-battery-above-arc', c['battery-above-arc'] === true);
        setCheck('cfg-miniature-blur', this._miniatureBlurEnabled);

        const miniatureBlurContainer = document.getElementById('cfg-miniature-blur-container');
        if (miniatureBlurContainer) {
            miniatureBlurContainer.style.display = this._miniatureBlurEnabled ? 'flex' : 'none';
        }
        setSlider('cfg-miniature-blur-level', 'val-cfg-miniature-blur', this._miniatureBlurLevel);
        setSlider('cfg-miniature-vignette-opacity', 'val-cfg-miniature-vignette-opacity', this._miniatureVignetteOpacity);

        setSlider('cfg-zoom', 'val-cfg-zoom', Number(c['scene-zoom'] ?? 1));
        setSlider('cfg-arc-zoom', 'val-cfg-arc-zoom', Number(c['arc-zoom'] ?? 1));

        const mapModeSel = document.getElementById('cfg-map-mode') as HTMLSelectElement;
        if (mapModeSel) mapModeSel.value = String(c['map-theme-mode'] ?? 'auto');

        const latInput = document.getElementById('cfg-lat') as HTMLInputElement;
        if (latInput) latInput.value = String(c['home-latitude'] ?? 48.8566);

        const lonInput = document.getElementById('cfg-lon') as HTMLInputElement;
        if (lonInput) lonInput.value = String(c['home-longitude'] ?? 2.3522);
    }

    private _syncYamlUI(): void {
        const area = document.getElementById('yaml-editor') as HTMLTextAreaElement;
        if (area) {
            area.value = JSON.stringify(this._config, null, 2);
        }
    }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
    const app = new SandboxApp();
    app.init();
});
