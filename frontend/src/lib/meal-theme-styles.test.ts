// @vitest-environment node
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import { BANNER_THEMES } from './meal-banner-theme';
import { THEMES } from './compact-meal-theme';

describe('compiled meal themes', () => {
  it('includes every meal gradient stop in both color modes from the real source scan', async () => {
    const output = await postcss([tailwindcss(config)]).process('@tailwind utilities;', { from: undefined });
    const selectors: string[] = [];
    output.root.walkRules((rule) => {
      selectors.push(rule.selector);
    });
    const cssSelectors = selectors.join('\n');
    for (const theme of [
      ...Object.values(BANNER_THEMES).map((item) => item.bannerBg),
      ...Object.values(THEMES).map((item) => item.cardBg),
    ]) {
      for (const token of theme.split(' ')) {
        const escaped = token.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
        expect(cssSelectors, `Missing compiled meal style: ${token}`).toContain(`.${escaped}`);
      }
    }
  }, 15000);
});
