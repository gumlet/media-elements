// https://docs.gumlet.com/docs/playerjs

export const MATCH_SRC = /play\.gumlet\.io\/embed\/([a-zA-Z0-9_-]+)($|\?)/;

const API_URL = 'https://cdn.jsdelivr.net/npm/@gumlet/player.js@3/dist/main.global.js';
const API_GLOBAL = 'playerjs';

export function canPlay(src) {
  return MATCH_SRC.test(src);
}

function getTemplateHTML(attrs, props = {}) {
  const iframeAttrs = {
    src: serializeIframeUrl(attrs, props) || '',
    frameborder: 0,
    width: '100%',
    height: '100%',
    allow: 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen',
    allowfullscreen: '',
    loading: 'lazy',
    title: 'Gumlet video player',
  };

  if (props.config) {
    // Serialize Gumlet config on iframe so it can be quickly accessed on first load.
    // Required for React SSR because the custom element is initialized long before React client render.
    iframeAttrs['data-config'] = JSON.stringify(props.config);
  }

  return /*html*/ `
    <style>
      :host {
        display: inline-block;
        min-width: 300px;
        min-height: 150px;
        position: relative;
      }
      iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: 0;
      }
      :host(:not([controls])) {
        pointer-events: none;
      }
    </style>
    <iframe${serializeAttributes(iframeAttrs)}></iframe>
  `;
}

function serializeIframeUrl(attrs, props = {}) {
  if (!attrs.src) return;

  const matches = attrs.src.match(MATCH_SRC);
  if (!matches) return;

  const url = new URL(attrs.src);
  const params = {
    ...(props.config || {}),
  };

  if ('autoplay' in attrs) params.autoplay = true;
  if ('muted' in attrs) params.muted = true;
  if ('loop' in attrs) params.loop = true;

  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    if (value === false) {
      url.searchParams.delete(key);
      continue;
    }
    url.searchParams.set(key, value === true || value === '' ? 'true' : String(value));
  }

  return url.toString();
}

class GumletVideoElement extends (globalThis.HTMLElement ?? class {}) {
  static getTemplateHTML = getTemplateHTML;
  static shadowRootOptions = { mode: 'open' };
  static observedAttributes = [
    'autoplay',
    'controls',
    'loop',
    'muted',
    'playsinline',
    'src',
  ];

  loadComplete = new PublicPromise();
  #loadRequested;
  #hasLoaded;
  #muted = false;
  #paused = true;
  #currentTime = 0;
  #duration = NaN;
  #volume = 1;
  #playbackRate = 1;
  #readyState = 0;
  #seeking = false;
  #config = null;
  #iframe = null;
  #api = null;
  #wasDisconnected = false;

  constructor() {
    super();
    this.#upgradeProperty('config');
  }

  get config() {
    return this.#config;
  }

  set config(value) {
    if (JSON.stringify(this.#config) === JSON.stringify(value)) return;
    this.#config = value;
    this.load();
  }

  get api() {
    return this.#api;
  }

  async load() {
    if (this.#loadRequested) return;

    const isFirstLoad = !this.#hasLoaded;

    // Wait 1 tick to allow other attributes to be set.
    this.#loadRequested = Promise.resolve();
    await this.#loadRequested;
    this.#loadRequested = null;

    if (!this.isConnected) {
      this.#hasLoaded = null;
      return;
    }

    this.#currentTime = 0;
    this.#duration = NaN;
    this.#muted = this.defaultMuted;
    this.#paused = !this.autoplay;
    this.#playbackRate = 1;
    this.#readyState = 0;
    this.#seeking = false;
    this.#volume = 1;
    this.#teardownApi();
    this.dispatchEvent(new Event('emptied'));

    if (!this.src) {
      // Nothing to load. Leave loadComplete and #hasLoaded untouched so
      // callers awaiting the existing loadComplete aren't orphaned if a
      // later load() (e.g. triggered by a subsequent src) replaces it.
      if (this.shadowRoot) this.shadowRoot.innerHTML = '';
      return;
    }

    if (this.#hasLoaded) this.loadComplete = new PublicPromise();
    this.#hasLoaded = true;

    this.dispatchEvent(new Event('loadstart'));

    if (!this.shadowRoot) {
      this.attachShadow(GumletVideoElement.shadowRootOptions);
    }

    let iframe = this.shadowRoot.querySelector('iframe');
    const attrs = namedNodeMapToObject(this.attributes);
    // Keep the SSR iframe; rebuild after disconnect so Player.js doesn't miss `ready`.
    const isSsrHydration = Boolean(iframe) && isFirstLoad && !this.#wasDisconnected;

    if (isSsrHydration) {
      try {
        this.#config = JSON.parse(iframe.getAttribute('data-config') || '{}');
      } catch {
        this.#config = null;
      }
    }

    const nextSrc = serializeIframeUrl(attrs, this);
    if (!isSsrHydration && (!iframe?.src || iframe.src !== nextSrc || this.#wasDisconnected)) {
      this.shadowRoot.innerHTML = getTemplateHTML(attrs, this);
      iframe = this.shadowRoot.querySelector('iframe');
    }
    this.#wasDisconnected = false;

    this.#iframe = iframe;
    if (!iframe) {
      this.loadComplete.resolve();
      return;
    }

    const playerjs = await loadScript(API_URL, API_GLOBAL);
    if (!this.isConnected) {
      this.#hasLoaded = null;
      return;
    }

    const api = new playerjs.Player(iframe);
    this.#api = api;
    this.#bindApi(api);
  }

  #teardownApi() {
    this.#api = null;
    this.#iframe = null;
  }

  #bindApi(api) {
    const on = (event, handler) => {
      api.on(event, (...args) => {
        if (this.#api !== api) return;
        return handler(...args);
      });
    };

    on('ready', async () => {
      this.#readyState = 1; // HTMLMediaElement.HAVE_METADATA

      try {
        if (this.loop) await api.setLoop?.(true);
        if (this.muted) await api.mute?.();

        const [duration, volume, muted] = await Promise.all([
          api.getDuration?.() ?? Promise.resolve(NaN),
          api.getVolume?.() ?? Promise.resolve(this.#volume * 100),
          api.getMuted?.() ?? Promise.resolve(this.#muted),
        ]);

        if (typeof duration === 'number') this.#duration = duration;
        if (typeof volume === 'number') this.#volume = volume / 100;
        if (typeof muted === 'boolean') this.#muted = muted;
      } catch {
        // Ignore transient player.js errors while initial state syncs.
      }

      if (this.#api !== api) return;

      this.dispatchEvent(new Event('loadedmetadata'));
      this.dispatchEvent(new Event('durationchange'));
      this.dispatchEvent(new Event('volumechange'));
      this.dispatchEvent(new Event('loadcomplete'));
      this.loadComplete.resolve();
    });

    on('play', () => {
      if (!this.#paused) return;
      this.#paused = false;
      this.#readyState = 3; // HTMLMediaElement.HAVE_FUTURE_DATA
      this.dispatchEvent(new Event('play'));
    });

    on('pause', () => {
      this.#paused = true;
      this.dispatchEvent(new Event('pause'));
    });

    on('ended', () => {
      this.#paused = true;
      this.dispatchEvent(new Event('ended'));
    });

    on('timeupdate', (data) => {
      if (data?.seconds != null) this.#currentTime = data.seconds;
      if (data?.duration != null) {
        this.#duration = data.duration;
        this.dispatchEvent(new Event('durationchange'));
      }
      this.dispatchEvent(new Event('timeupdate'));
    });

    on('progress', () => {
      this.dispatchEvent(new Event('progress'));
    });

    on('seeked', (data) => {
      this.#seeking = false;
      if (typeof data === 'number') {
        this.#currentTime = data;
      } else if (data?.seconds != null) {
        this.#currentTime = data.seconds;
      }
      this.dispatchEvent(new Event('seeked'));
    });

    on('error', () => {
      this.dispatchEvent(new Event('error'));
    });

    on('volumeChange', async () => {
      try {
        const [volume, muted] = await Promise.all([
          api.getVolume?.() ?? Promise.resolve(this.#volume * 100),
          api.getMuted?.() ?? Promise.resolve(this.#muted),
        ]);
        if (typeof volume === 'number') this.#volume = volume / 100;
        if (typeof muted === 'boolean') this.#muted = muted;
      } catch {
        // Ignore transient player.js errors while volume state syncs.
      }
      if (this.#api !== api) return;
      this.dispatchEvent(new Event('volumechange'));
    });

    on('playbackRateChange', async () => {
      try {
        const rate = await api.getPlaybackRate?.();
        if (typeof rate === 'number') this.#playbackRate = rate;
      } catch {
        // Ignore transient player.js errors while rate state syncs.
      }
      if (this.#api !== api) return;
      this.dispatchEvent(new Event('ratechange'));
    });

    on('pipChange', (data) => {
      const inPip = typeof data === 'boolean' ? data : Boolean(data?.isPIP ?? data?.pip);
      this.dispatchEvent(new Event(inPip ? 'enterpictureinpicture' : 'leavepictureinpicture'));
    });
  }

  async attributeChangedCallback(attrName, oldValue, newValue) {
    if (oldValue === newValue) return;

    // This is required to come before the await for resolving loadComplete.
    switch (attrName) {
      case 'autoplay':
      case 'controls':
      case 'src': {
        this.load();
        return;
      }
    }

    await this.loadComplete;

    switch (attrName) {
      case 'loop': {
        await this.#api?.setLoop?.(this.loop);
        break;
      }
      case 'muted': {
        this.muted = newValue != null;
        break;
      }
    }
  }

  connectedCallback() {
    if (this.src && !this.#hasLoaded) {
      this.load();
    }
  }

  disconnectedCallback() {
    this.#wasDisconnected = true;
    this.#loadRequested = null;
    this.#hasLoaded = null;
    this.loadComplete = new PublicPromise();
    this.#teardownApi();
  }

  async play() {
    this.#paused = false;
    this.dispatchEvent(new Event('play'));

    await this.loadComplete;

    try {
      await this.#api?.play?.();
      this.dispatchEvent(new Event('playing'));
    } catch (error) {
      this.#paused = true;
      this.dispatchEvent(new Event('pause'));
      throw error;
    }
  }

  async pause() {
    await this.loadComplete;
    return this.#api?.pause?.();
  }

  get ended() {
    return Number.isFinite(this.#duration) && this.#currentTime >= this.#duration;
  }

  get seeking() {
    return this.#seeking;
  }

  get readyState() {
    return this.#readyState;
  }

  get src() {
    return this.getAttribute('src');
  }

  set src(val) {
    if (this.src == val) return;
    this.setAttribute('src', `${val}`);
  }

  get paused() {
    return this.#paused;
  }

  get duration() {
    return this.#duration;
  }

  get autoplay() {
    return this.hasAttribute('autoplay');
  }

  set autoplay(val) {
    if (this.autoplay == val) return;
    this.toggleAttribute('autoplay', Boolean(val));
  }

  get controls() {
    return this.hasAttribute('controls');
  }

  set controls(val) {
    if (this.controls == val) return;
    this.toggleAttribute('controls', Boolean(val));
  }

  get currentTime() {
    return this.#currentTime;
  }

  set currentTime(val) {
    if (this.currentTime == val) return;
    this.#seeking = true;
    this.#currentTime = val;
    this.dispatchEvent(new Event('seeking'));
    this.loadComplete.then(() => {
      this.#api?.setCurrentTime?.(val)?.catch?.(() => {});
    });
  }

  get defaultMuted() {
    return this.hasAttribute('muted');
  }

  set defaultMuted(val) {
    if (this.defaultMuted == val) return;
    this.toggleAttribute('muted', Boolean(val));
  }

  get loop() {
    return this.hasAttribute('loop');
  }

  set loop(val) {
    if (this.loop == val) return;
    this.toggleAttribute('loop', Boolean(val));
  }

  get muted() {
    return this.#muted;
  }

  set muted(val) {
    if (this.muted == val) return;
    this.#muted = val;
    this.loadComplete.then(() => {
      if (val) this.#api?.mute?.();
      else this.#api?.unmute?.();
    });
  }

  get playbackRate() {
    return this.#playbackRate;
  }

  set playbackRate(val) {
    if (this.playbackRate == val) return;
    this.#playbackRate = val;
    this.loadComplete.then(() => {
      this.#api?.setPlaybackRate?.(val)?.catch?.(() => {});
    });
  }

  get playsInline() {
    return this.hasAttribute('playsinline');
  }

  set playsInline(val) {
    if (this.playsInline == val) return;
    this.toggleAttribute('playsinline', Boolean(val));
  }

  get volume() {
    return this.#volume;
  }

  set volume(val) {
    if (this.volume == val) return;
    this.#volume = val;
    this.loadComplete.then(() => {
      this.#api?.setVolume?.(Math.round(val * 100))?.catch?.(() => {});
    });
  }

  // https://web.dev/custom-elements-best-practices/#make-properties-lazy
  #upgradeProperty(prop) {
    if (Object.prototype.hasOwnProperty.call(this, prop)) {
      const value = this[prop];
      delete this[prop];
      this[prop] = value;
    }
  }
}

function serializeAttributes(attrs) {
  let html = '';
  for (const key in attrs) {
    const value = attrs[key];
    if (value === '') html += ` ${escapeHtml(key)}`;
    else html += ` ${escapeHtml(key)}="${escapeHtml(`${value}`)}"`;
  }
  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/`/g, '&#x60;');
}

function namedNodeMapToObject(namedNodeMap) {
  let obj = {};
  for (let attr of namedNodeMap) {
    obj[attr.name] = attr.value;
  }
  return obj;
}

const loadScriptCache = {};
async function loadScript(src, globalName) {
  if (loadScriptCache[src]) return loadScriptCache[src];
  if (globalName && self[globalName]) {
    await delay(0);
    return self[globalName];
  }
  return (loadScriptCache[src] = new Promise(function (resolve, reject) {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(self[globalName]);
    script.onerror = reject;
    document.head.append(script);
  }));
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A utility to create Promises with convenient public resolve and reject methods.
 * @return {Promise}
 */
class PublicPromise extends Promise {
  constructor(executor = () => {}) {
    let res, rej;
    super((resolve, reject) => {
      executor(resolve, reject);
      res = resolve;
      rej = reject;
    });
    this.resolve = res;
    this.reject = rej;
  }
}

if (globalThis.customElements && !globalThis.customElements.get('gumlet-video')) {
  globalThis.customElements.define('gumlet-video', GumletVideoElement);
}

export default GumletVideoElement;
