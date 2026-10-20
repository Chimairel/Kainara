import assert from 'node:assert/strict';
import test from 'node:test';
import { cookingLinkForMeal } from '../src/domain/meal-cooking-link.policy';

test('prepared portions retain their governed cooking source', () => {
  assert.equal(
    cookingLinkForMeal({
      sourceRawRecipeCandidate: {
        recipeName: 'Chicken Adobo',
        sourceName: 'DEMO_STANDARD_PORTION',
        sourceUrl: 'https://panlasangpinoy.com/chicken-adobo/',
        sourceImageUrl: null,
        sourceVideoUrl: null,
      },
    })?.url,
    'https://panlasangpinoy.com/chicken-adobo/'
  );
});

test('a Panlasang corpus meal opens its exact article even without a stored video', () => {
  assert.deepEqual(
    cookingLinkForMeal({
      sourceRawRecipeCandidate: {
        recipeName: 'Chicken Adobo Fried Rice and Tortang Corned Beef',
        sourceName: 'PANLASANG_PINOY',
        sourceUrl: 'https://panlasangpinoy.com/chicken-adobo-fried-rice-and-tortang-corned-beef/',
        sourceImageUrl: null,
        sourceVideoUrl: null,
      },
    }),
    {
      url: 'https://panlasangpinoy.com/chicken-adobo-fried-rice-and-tortang-corned-beef/',
      kind: 'PANLASANG_RECIPE',
    }
  );
});

test('linked YouTube videos take priority over articles, and spoofed hosts are rejected', () => {
  assert.equal(
    cookingLinkForMeal({
      libraryDescription: 'Source: https://panlasangpinoy.com/adobo/\nVideo: https://youtu.be/uXi6QDOdhGg',
    })?.kind,
    'SOURCE_VIDEO'
  );
  assert.deepEqual(cookingLinkForMeal({ libraryDescription: 'Video: https://youtu.be/uXi6QDOdhGg' }), {
    url: 'https://www.youtube.com/watch?v=uXi6QDOdhGg',
    kind: 'SOURCE_VIDEO',
  });
  assert.equal(
    cookingLinkForMeal({ libraryDescription: 'Source: https://panlasangpinoy.com.evil.example/recipe/' }),
    null
  );
  assert.equal(
    cookingLinkForMeal({ libraryDescription: 'Video: https://youtube.com.evil.example/watch?v=uXi6QDOdhGg' }),
    null
  );
});
