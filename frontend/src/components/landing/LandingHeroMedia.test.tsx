import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import LandingHeroMedia from './LandingHeroMedia';
it('includes the video poster in the initial HTML with no settings placeholder', () => {
  const poster = 'https://res.cloudinary.com/test/video/upload/so_1/promo.jpg';
  const html = renderToStaticMarkup(
    <LandingHeroMedia
      media={{
        kind: 'video',
        url: 'https://res.cloudinary.com/test/video/upload/promo.mp4',
        posterUrl: poster,
        altText: 'Promotion',
      }}
    />
  );
  expect(html).toContain(`poster="${poster}"`);
  expect(html).not.toContain('Loading website media');
  expect(html).not.toContain('/dashboard-actual.png');
});
it('includes the original screenshot when no publication is available', () => {
  const html = renderToStaticMarkup(<LandingHeroMedia media={null} />);
  expect(html).toContain('/dashboard-actual.png');
});
