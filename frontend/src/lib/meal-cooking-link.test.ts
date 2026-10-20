import { expect, it } from 'vitest';
import { cookingAction } from './meal-cooking-link';

it('always opens YouTube from cooking help, preferring a linked video to search', () => {
  expect(cookingAction('Chicken Adobo', { kind: 'SOURCE_VIDEO', url: 'https://youtu.be/uXi6QDOdhGg' }).href).toBe(
    'https://youtu.be/uXi6QDOdhGg'
  );
  for (const link of [
    null,
    { kind: 'PANLASANG_RECIPE' as const, url: 'https://panlasangpinoy.com/adobo/' },
    { kind: 'SOURCE_VIDEO' as const, url: 'https://youtube.com.evil.example/watch' },
  ]) {
    const action = cookingAction('Adobo & rice', link);
    expect(new URL(action.href).hostname).toBe('www.youtube.com');
    expect(new URL(action.href).searchParams.get('search_query')).toBe('how to cook Adobo & rice');
  }
});
