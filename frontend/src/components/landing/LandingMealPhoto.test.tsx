import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import LandingMealPhoto from './LandingMealPhoto';

vi.mock('next/image', () => ({
  default: ({ src, onLoad, onError }: { src: string; onLoad: () => void; onError: () => void }) => (
    // Native events stand in for the Next image decoder in this unit test.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" onLoad={onLoad} onError={onError} />
  ),
}));

it('settles a failed remote photo with a neutral local fallback so its column can move again', () => {
  const onSettled = vi.fn();
  const { container } = render(<LandingMealPhoto src="/synthetic.jpg" name="Synthetic recipe" onSettled={onSettled} />);
  expect(screen.getByText('Loading recipe photo')).toBeInTheDocument();
  fireEvent.error(container.querySelector('img')!);
  expect(screen.getByText('Recipe photo unavailable')).toBeInTheDocument();
  expect(container.querySelector('img')).toBeNull();
  expect(onSettled).toHaveBeenCalledWith('Synthetic recipe');
});

it('reveals the loaded photo and removes its loading surface', () => {
  const onSettled = vi.fn();
  const { container } = render(<LandingMealPhoto src="/synthetic.jpg" name="Synthetic recipe" onSettled={onSettled} />);
  fireEvent.load(container.querySelector('img')!);
  expect(screen.queryByText('Loading recipe photo')).not.toBeInTheDocument();
  expect(container.querySelector('[data-gallery-photo-state]')).toHaveAttribute('data-gallery-photo-state', 'loaded');
  expect(onSettled).toHaveBeenCalledWith('Synthetic recipe');
});
