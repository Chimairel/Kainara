import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GroceryTable from './GroceryTable';
import type { GroceryItem } from './current-grocery';

const mockItems: GroceryItem[] = [
  {
    id: 'item-1',
    ingredientName: 'Garlic (minced)',
    category: 'Produce',
    isChecked: false,
    quantity: 3,
    unit: 'cloves',
    sourceMealCount: 2,
    isPantryStaple: false,
  },
  {
    id: 'item-2',
    ingredientName: 'Chicken breast (skinless)',
    category: 'Meat & Poultry',
    isChecked: true,
    quantity: 500,
    unit: 'g',
    sourceMealCount: 3,
    isPantryStaple: false,
  },
  {
    id: 'item-3',
    ingredientName: 'Soy sauce',
    category: 'Condiments',
    isChecked: false,
    quantity: 2,
    unit: 'tbsp',
    sourceMealCount: 1,
    isPantryStaple: true,
  },
];

describe('GroceryTable', () => {
  const defaultProps = {
    items: mockItems,
    canCheckItems: true,
    onToggleItem: vi.fn(),
    onTogglePantry: vi.fn(),
    onRefresh: vi.fn(),
    sortField: 'name' as const,
    sortOrder: 'asc' as const,
    onSort: vi.fn(),
    onToggleAllVisible: vi.fn(),
    allVisibleChecked: false,
  };

  it('renders all grocery items in the table with formatted names and categories', () => {
    render(<GroceryTable {...defaultProps} />);

    // Cleaned name and prep notes
    expect(screen.getByText('Garlic')).toBeInTheDocument();
    expect(screen.getByText('minced')).toBeInTheDocument();
    expect(screen.getByText('Chicken breast')).toBeInTheDocument();
    expect(screen.getByText('skinless')).toBeInTheDocument();
    expect(screen.getByText('Soy sauce')).toBeInTheDocument();

    // Categories
    expect(screen.getByText('Produce')).toBeInTheDocument();
    expect(screen.getByText('Meat & Poultry')).toBeInTheDocument();
    expect(screen.getByText('Condiments')).toBeInTheDocument();

    // Summary count
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('calls onSort when a sortable column header is clicked', () => {
    const onSort = vi.fn();
    render(<GroceryTable {...defaultProps} onSort={onSort} />);

    const ingredientHeaderBtn = screen.getByRole('button', { name: /ingredient/i });
    fireEvent.click(ingredientHeaderBtn);
    expect(onSort).toHaveBeenCalledWith('name');

    const categoryHeaderBtn = screen.getByRole('button', { name: /category/i });
    fireEvent.click(categoryHeaderBtn);
    expect(onSort).toHaveBeenCalledWith('category');

    const quantityHeaderBtn = screen.getByRole('button', { name: /quantity/i });
    fireEvent.click(quantityHeaderBtn);
    expect(onSort).toHaveBeenCalledWith('quantity');
  });

  it('calls onToggleItem when an item checkbox button is clicked', () => {
    const onToggleItem = vi.fn();
    render(<GroceryTable {...defaultProps} onToggleItem={onToggleItem} />);

    const garlicCheckbox = screen.getByRole('button', { name: /Mark fully purchased: Garlic/i });
    fireEvent.click(garlicCheckbox);
    expect(onToggleItem).toHaveBeenCalledWith('item-1');
  });

  it('calls onTogglePantry when a pantry button is clicked', () => {
    const onTogglePantry = vi.fn();
    render(<GroceryTable {...defaultProps} onTogglePantry={onTogglePantry} />);

    const pantryBtn = screen.getByRole('button', { name: /Mark Garlic as in pantry/i });
    fireEvent.click(pantryBtn);
    expect(onTogglePantry).toHaveBeenCalledWith('item-1');
  });

  it('calls onToggleAllVisible when the header select-all button is clicked', () => {
    const onToggleAllVisible = vi.fn();
    render(<GroceryTable {...defaultProps} onToggleAllVisible={onToggleAllVisible} />);

    const selectAllBtn = screen.getByRole('button', { name: /Mark all visible items purchased/i });
    fireEvent.click(selectAllBtn);
    expect(onToggleAllVisible).toHaveBeenCalledTimes(1);
  });
});
