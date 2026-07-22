# `<gumlet-video>`

[![NPM Version](https://img.shields.io/npm/v/gumlet-video-element?style=flat-square&color=informational)](https://www.npmjs.com/package/gumlet-video-element)
[![NPM Downloads](https://img.shields.io/npm/dm/gumlet-video-element?style=flat-square&color=informational&label=npm)](https://www.npmjs.com/package/gumlet-video-element)
[![jsDelivr hits (npm)](https://img.shields.io/jsdelivr/npm/hm/gumlet-video-element?style=flat-square&color=%23FF5627)](https://www.jsdelivr.com/package/npm/gumlet-video-element)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/gumlet-video-element?style=flat-square&color=success&label=gzip)](https://bundlephobia.com/result?p=gumlet-video-element)

A [custom element](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements)
for the [Gumlet](https://www.gumlet.com/) player with an API that matches the
[`<video>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video) API.

- Compatible [`HTMLMediaElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement) API
- Seamlessly integrates with [Media Chrome](https://github.com/muxinc/media-chrome)

## Example

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/gumlet-video-element@0"></script>
<gumlet-video
  controls
  src="https://play.gumlet.io/embed/64bfb0913ed6e5096d66dc1e"
></gumlet-video>
```

## Installing

`<gumlet-video>` is packaged as a javascript module (es6) only, which is supported by all evergreen browsers and Node v12+.

### Loading into your HTML using `<script>`

Note the `type="module"`, that's important.

> Modules are always loaded asynchronously by the browser, so it's ok to load them in the head, and best for registering web components quickly.

```html
<head>
  <script type="module" src="https://cdn.jsdelivr.net/npm/gumlet-video-element@0"></script>
</head>
```

### Adding to your app via `npm`

```bash
npm install gumlet-video-element --save
```

Or yarn:

```bash
yarn add gumlet-video-element
```

Include in your app javascript (e.g. src/App.js):

```js
import 'gumlet-video-element';
```

This will register the custom elements with the browser so they can be used as HTML.

### React

```jsx
import GumletVideo from 'gumlet-video-element/react';

export default function Player() {
  return (
    <GumletVideo
      controls
      src="https://play.gumlet.io/embed/64bfb0913ed6e5096d66dc1e"
      config={{ start_high_res: true }}
    />
  );
}
```

## Related

- [Gumlet Player.js](https://docs.gumlet.com/docs/playerjs)
- [Media Chrome](https://github.com/muxinc/media-chrome) Your media player's dancing suit.
- [`<youtube-video>`](https://github.com/muxinc/media-elements/tree/main/packages/youtube-video-element)
- [`<vimeo-video>`](https://github.com/muxinc/media-elements/tree/main/packages/vimeo-video-element)
- [`<tiktok-video>`](https://github.com/muxinc/media-elements/tree/main/packages/tiktok-video-element)
