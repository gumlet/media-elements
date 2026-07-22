import { test } from 'zora';
import GumletVideoElement, { canPlay, MATCH_SRC } from '../gumlet-video-element.js';

test('canPlay matches Gumlet embed URLs', (t) => {
  t.ok(canPlay('https://play.gumlet.io/embed/64bfb0913ed6e5096d66dc1e'));
  t.ok(canPlay('https://play.gumlet.io/embed/64bfb0913ed6e5096d66dc1e?autoplay=true'));
  t.ok(MATCH_SRC.test('https://play.gumlet.io/embed/abc_123-xyz'));
  t.notOk(canPlay('https://example.com/video'));
  t.notOk(canPlay('https://play.gumlet.io/watch/64bfb0913ed6e5096d66dc1e'));
});

test('registers custom element', (t) => {
  t.ok(customElements.get('gumlet-video'));
  t.ok(GumletVideoElement);
});

function createVideoElement() {
  return fixture(`<gumlet-video
    src="https://play.gumlet.io/embed/64bfb0913ed6e5096d66dc1e"
    muted
  ></gumlet-video>`);
}

test('has default video props', async function (t) {
  const video = await createVideoElement();

  t.equal(video.paused, true, 'is paused on initialization');

  await video.loadComplete;

  t.equal(video.paused, true, 'is paused after load');
  t.ok(!video.ended, 'is not ended');
  t.ok(video.muted, 'is muted');
});

test('loop', async function (t) {
  const video = await createVideoElement();
  await video.loadComplete;

  t.ok(!video.loop, 'loop is false by default');
  video.loop = true;
  t.ok(video.loop, 'loop is true');
});

test('volume', async function (t) {
  const video = await createVideoElement();
  await video.loadComplete;

  video.volume = 1;
  await delay(100);
  t.equal(video.volume, 1, 'is all turned up');
  video.volume = 0.5;
  await delay(100);
  t.equal(video.volume, 0.5, 'is half volume');
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fixture(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const fragment = template.content.cloneNode(true);
  const result = fragment.children.length > 1
    ? [...fragment.children]
    : fragment.children[0];
  document.body.append(fragment);
  return result;
}
