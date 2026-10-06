import { ShoppingCart } from 'lucide-react';

import { type DocsChapter } from './chapter-types';
export const groceriesChapter: DocsChapter = {
  id: 'groceries',
  title: 'Grocery lists',
  shortTitle: 'Grocery lists',
  group: 'Use KAINARA',
  icon: ShoppingCart,
  tone: 'accent',
  summary: 'The grocery page groups ingredients from your saved meals and helps track purchases.',
  sections: [
    {
      id: 'groceries-list',
      title: 'Using the list',
      content: (
        <>
          <p>
            Check the linked recipes and actual household portions before shopping. Quantities, units, and availability
            can be incomplete. A changed meal or plan can make an older grocery list stale.
          </p>
          <p>
            Choose Current week or Next week to view the ingredients available for that cycle. Both tabs can be
            selected. If no upcoming cycle is available, the page shows “No grocery list for next week yet”. Switching
            tabs does not create a plan. Lists include available cleared ingredients and may remain partial while other
            meals are pending. Marking an item purchased is a checklist action; it does not verify the amount bought or
            the safety of a particular product. Check package labels, substitutions, and household serving sizes
            yourself.
          </p>
          <p>
            When a meal is swapped, paused, or regenerated, review the list again. An earlier screen capture or printout
            may still contain ingredients from the old plan, while a newly generated list reflects the recorded meals at
            its creation time.
          </p>
        </>
      ),
    },
    {
      id: 'groceries-export',
      title: 'PDF export',
      content: (
        <>
          <p>
            Where offered, the PDF reflects the recorded list at that point in time. It is a shopping aid, not a
            guarantee that every listed quantity covers a prepared recipe.
          </p>
          <p>
            Keep the export alongside the source recipes if you need preparation detail. Ingredient names, household
            measures, edible weights, and package sizes do not always translate exactly into one another. Use the PDF as
            a checklist and confirm the quantities needed for the way you intend to cook.
          </p>
        </>
      ),
    },
  ],
};
