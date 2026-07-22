export const MATCH_SRC: RegExp;

export function canPlay(src: string): boolean;

export interface GumletConfig {
  /** Start playback automatically */
  autoplay?: boolean;
  /** Start muted */
  muted?: boolean;
  /** Loop playback */
  loop?: boolean;
  /** Start time in seconds */
  t?: number;
  /** DRM token for protected content */
  drm_token?: string;
  /** VAST tag URL for ads */
  vast_tag_url?: string;
  /** Start in highest available resolution */
  start_high_res?: boolean;
  /** Disable seek controls */
  disable_seek?: boolean;
  /** Hide all player controls */
  disable_player_controls?: boolean;
  /** Watermark text overlay */
  watermark_text?: string;
  [key: string]: unknown;
}

export default class GumletVideoElement extends HTMLVideoElement {
  static readonly observedAttributes: string[];
  static getTemplateHTML: (
    attrs: Record<string, string>,
    props?: { config?: GumletConfig | null }
  ) => string;
  config: GumletConfig | null;
  attributeChangedCallback(
    attrName: string,
    oldValue?: string | null,
    newValue?: string | null
  ): void;
  connectedCallback(): void;
  disconnectedCallback(): void;
}
