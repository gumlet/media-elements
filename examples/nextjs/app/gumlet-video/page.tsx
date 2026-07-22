import { Metadata } from 'next';
import GumletVideo from 'gumlet-video-element/react';
import Player from '../player';

export const metadata: Metadata = {
  title: 'Gumlet Video - Media Elements',
};

export default function Page() {
  return (
    <>
      <section>
        <Player
          as={GumletVideo}
          src="https://play.gumlet.io/embed/64bfb0913ed6e5096d66dc1e"
          config={{
            start_high_res: true,
          }}
        />
      </section>
    </>
  );
}
