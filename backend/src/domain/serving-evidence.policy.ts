type ServingEvidence = {
  componentType: string;
  evidenceSource: string;
  foodItem: { compositionRevision: number } | null;
};

/** Approval and member availability must agree on the saved rice revision. */
export function hasCurrentRiceEvidence(components: readonly ServingEvidence[] = []): boolean {
  return components.every(
    (component) =>
      component.componentType !== 'COOKED_RICE' ||
      (!!component.foodItem && component.evidenceSource === `FNRI:${component.foodItem.compositionRevision}`)
  );
}
