'use client';
import Dropdown from '@/components/ui/Dropdown';

import Card from '@/components/ui/Card';

import { Search } from 'lucide-react';

import { AVAILABLE_CONDITIONS } from '@/features/nutritionist-library/useNutritionistLibrary';

import type { useSharedMealLibraryModel } from './useSharedMealLibraryModel';
type Props = {
  model: Pick<
    ReturnType<typeof useSharedMealLibraryModel>,
    | 'searchVal'
    | 'setSearchVal'
    | 'mealType'
    | 'setMealType'
    | 'setPage'
    | 'conditionTag'
    | 'setConditionTag'
    | 'status'
    | 'setStatus'
    | 'adminDraftsOnly'
    | 'setAdminDraftsOnly'
    | 'isAdmin'
    | 'verifiedByMe'
    | 'setVerifiedByMe'
    | 'totalCount'
  >;
};
export default function LibraryFilterSection({ model }: Props) {
  const {
    searchVal,
    setSearchVal,
    mealType,
    setMealType,
    setPage,
    conditionTag,
    setConditionTag,
    status,
    setStatus,
    adminDraftsOnly,
    setAdminDraftsOnly,
    isAdmin,
    verifiedByMe,
    setVerifiedByMe,
    totalCount,
  } = model;
  return (
    <>
      <Card className="portal-filter-panel rounded-[22px] border-brand-border/70 bg-brand-surface/90 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="md:col-span-2">
            <label htmlFor="library-search" className="block text-xs font-bold text-brand-muted uppercase mb-1.5">
              Search meal name
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted"
                aria-hidden="true"
              />
              <input
                id="library-search"
                name="search"
                type="text"
                placeholder="Search recipes (e.g. Tinola, Sinigang)..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 pl-10 pr-9 text-xs text-brand-text outline-none transition focus:border-brand-green/60 focus:ring-4 focus:ring-brand-green/10 placeholder:text-brand-muted/60"
              />
              {searchVal && (
                <button
                  type="button"
                  aria-label="Clear meal search"
                  onClick={() => setSearchVal('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Meal Type */}
          <div>
            <label htmlFor="library-meal-type" className="block text-xs font-bold text-brand-muted uppercase mb-1.5">
              Meal Type
            </label>
            <Dropdown
              id="library-meal-type"
              value={mealType}
              onChange={(e) => {
                setMealType(e);
                setPage(1);
              }}
              className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-3 text-xs text-brand-text outline-none transition focus:border-brand-green/60 focus:ring-4 focus:ring-brand-green/10"
            >
              <option value="All">All Types</option>
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="DINNER">Dinner</option>
              <option value="SNACK">Snack</option>
            </Dropdown>
          </div>

          {/* Condition Tag */}
          <div>
            <label htmlFor="library-condition" className="block text-xs font-bold text-brand-muted uppercase mb-1.5">
              Condition Tag
            </label>
            <Dropdown
              id="library-condition"
              value={conditionTag}
              onChange={(e) => {
                setConditionTag(e);
                setPage(1);
              }}
              className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-3 text-xs text-brand-text outline-none transition focus:border-brand-green/60 focus:ring-4 focus:ring-brand-green/10"
            >
              <option value="All">All Conditions</option>
              {AVAILABLE_CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Dropdown>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-3 border-t border-brand-border/40">
          <div className="flex flex-wrap items-center gap-4">
            <label htmlFor="library-meal-status" className="flex items-center gap-2 text-xs font-bold text-brand-text">
              Meal status
              <Dropdown
                id="library-meal-status"
                value={status}
                onChange={(event) => {
                  setStatus(event as typeof status);
                  setPage(1);
                }}
                className="rounded-xl border border-brand-border bg-brand-surface px-3 py-1.5 text-xs text-brand-text shadow-xs outline-none focus:border-brand-green"
              >
                <option value="ALL">All meals</option>
                <option value="APPROVED">Available</option>
                <option value="FLAGGED">Flagged</option>
              </Dropdown>
            </label>

            {/* Owner filter */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-brand-text">
              <input
                type="checkbox"
                checked={adminDraftsOnly}
                onChange={(event) => {
                  setAdminDraftsOnly(event.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-brand-border bg-brand-surface text-brand-green focus:ring-brand-green"
              />
              Admin drafts awaiting evidence review
            </label>

            {!isAdmin && (
              <label
                htmlFor="library-verified-by-me"
                className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-brand-text"
              >
                <input
                  id="library-verified-by-me"
                  type="checkbox"
                  checked={verifiedByMe}
                  onChange={(e) => {
                    setVerifiedByMe(e.target.checked);
                    setPage(1);
                  }}
                  className="h-4 w-4 rounded border-brand-border bg-brand-surface text-brand-green focus:ring-brand-green"
                />
                Show only meals verified by me
              </label>
            )}
          </div>

          {totalCount > 0 && (
            <span className="text-xs text-brand-muted shrink-0">
              {totalCount} total {totalCount === 1 ? 'record' : 'records'}
            </span>
          )}
        </div>
      </Card>
    </>
  );
}
