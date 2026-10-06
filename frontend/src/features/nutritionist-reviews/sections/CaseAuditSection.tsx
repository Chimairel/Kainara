'use client';

import Badge from '@/components/ui/Badge';

import MealImage from '@/components/user/MealImage';

import type { PublicMealImage } from '@/types';
import { Flame, Plus, Trash2 } from 'lucide-react';

import IngredientEvidenceList from '@/features/nutritionist-reviews/IngredientEvidenceList';

import type { useCaseReviewWorkspaceModel } from './useCaseReviewWorkspaceModel';
type Model = Extract<ReturnType<typeof useCaseReviewWorkspaceModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'isEditing'
    | 'editForm'
    | 'setEditForm'
    | 'detailData'
    | 'addIngredientField'
    | 'updateIngredientField'
    | 'removeIngredientField'
  >;
};
export default function CaseAuditSection({ model }: SectionProps) {
  const {
    isEditing,
    editForm,
    setEditForm,
    detailData,
    addIngredientField,
    updateIngredientField,
    removeIngredientField,
  } = model;
  if (!detailData) return null;
  return (
    <>
      <div className="space-y-4 rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card">
        <div className="border-b border-brand-border pb-3 flex justify-between items-start">
          <div>
            <h2 className="text-sm font-bold text-brand-muted uppercase tracking-wider">Meal Details</h2>
            {isEditing ? (
              <input
                type="text"
                value={editForm.mealName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, mealName: e.target.value }))}
                className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 text-sm font-extrabold w-full mt-2 focus:outline-none focus:border-brand-green"
              />
            ) : (
              <h3 className="text-base font-extrabold text-brand-text mt-1">{detailData.mealPlan.mealName}</h3>
            )}
            <p className="text-xs text-brand-muted mt-1 uppercase">
              {detailData.mealPlan.mealType} • Generated {new Date(detailData.mealPlan.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Meal Image Visual */}
        <div className="overflow-hidden rounded-2xl border border-brand-border/60">
          <MealImage
            mealName={detailData.mealPlan.mealName}
            mealType={detailData.mealPlan.mealType}
            image={(detailData.mealPlan as { image?: PublicMealImage | null }).image ?? null}
            variant="card"
            className="h-44 w-full sm:h-52"
            showAttributionLinks
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-brand-muted">Description</h4>
          {isEditing ? (
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-brand-green resize-none"
            />
          ) : (
            <p className="text-xs text-brand-muted leading-relaxed">
              {detailData.mealPlan.description || 'No description available.'}
            </p>
          )}
        </div>

        {/* Nutrition targets */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-brand-muted">Nutrition Data</h4>
          {isEditing ? (
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block text-[10px] text-brand-muted">Calories</label>
                <input
                  type="number"
                  value={editForm.calories}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, calories: parseFloat(e.target.value) || 0 }))}
                  className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                />
              </div>
              <div>
                <label className="block text-[10px] text-brand-muted">Protein (g)</label>
                <input
                  type="number"
                  value={editForm.proteinG}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, proteinG: parseFloat(e.target.value) || 0 }))}
                  className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                />
              </div>
              <div>
                <label className="block text-[10px] text-brand-muted">Carbs (g)</label>
                <input
                  type="number"
                  value={editForm.carbsG}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, carbsG: parseFloat(e.target.value) || 0 }))}
                  className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                />
              </div>
              <div>
                <label className="block text-[10px] text-brand-muted">Fat (g)</label>
                <input
                  type="number"
                  value={editForm.fatG}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, fatG: parseFloat(e.target.value) || 0 }))}
                  className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-4 text-xs text-brand-muted items-center">
              <span className="flex items-center gap-1 font-bold text-amber-500">
                <Flame className="w-3.5 h-3.5 fill-current" />
                <span>{detailData.mealPlan.calories.toFixed(0)} kcal</span>
              </span>
              <span>
                P: <strong>{detailData.mealPlan.proteinG.toFixed(1)}g</strong>
              </span>
              <span>
                C: <strong>{detailData.mealPlan.carbsG.toFixed(1)}g</strong>
              </span>
              <span>
                F: <strong>{detailData.mealPlan.fatG.toFixed(1)}g</strong>
              </span>
            </div>
          )}
        </div>

        {/* Ingredients list */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-brand-muted flex justify-between items-center">
            <span>Ingredients</span>
            {isEditing && (
              <button
                onClick={addIngredientField}
                className="text-brand-green hover:underline text-[11px] flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" /> Add Ingredient
              </button>
            )}
          </h4>
          <div className="space-y-2">
            {isEditing ? (
              editForm.ingredients.map((ing, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={ing.name}
                    onChange={(e) => updateIngredientField(idx, e.target.value)}
                    placeholder="Ingredient name..."
                    className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 text-xs flex-grow focus:outline-none focus:border-brand-green"
                  />
                  <Badge
                    variant={
                      ing.dataSource === 'FNRI' ? 'verified' : ing.dataSource === 'SOURCE_RECIPE' ? 'user' : 'pending'
                    }
                    className="text-[8px] uppercase select-none"
                  >
                    {ing.dataSource === 'FNRI' ? 'FNRI' : ing.dataSource === 'SOURCE_RECIPE' ? 'Source' : 'AI est.'}
                  </Badge>
                  <button
                    onClick={() => removeIngredientField(idx)}
                    className="p-1 text-red-500 hover:bg-red-950/20 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            ) : (
              <IngredientEvidenceList ingredients={detailData.ingredients} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
