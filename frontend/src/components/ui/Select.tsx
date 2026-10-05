'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  className = '',
  triggerClassName = '',
  menuClassName = '',
  disabled = false,
  id,
  name,
  'aria-label': ariaLabel,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0 });
  const generatedId = useId();
  const selectId = id || generatedId;
  const listboxId = `${selectId}-listbox`;

  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const roomBelow = window.innerHeight - rect.bottom;
      const height = Math.min(250, menuRef.current?.offsetHeight || 250);
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        top: roomBelow < height && rect.top > height ? rect.top - height - 6 : rect.bottom + 6,
        width: rect.width,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen]);

  // Sync highlightedIndex when opening
  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex((opt) => opt.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, options, value]);

  // Scroll highlighted item into view if list is long
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl && typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen, highlightedIndex]);

  const handleSelect = (val: string) => {
    if (disabled || options.find((option) => option.value === val)?.disabled) return;
    onChange(val);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const enabledIndices = options.flatMap((option, index) => (option.disabled ? [] : [index]));
    const move = (direction: 1 | -1) => {
      const current = enabledIndices.indexOf(highlightedIndex);
      const next = (current + direction + enabledIndices.length) % enabledIndices.length;
      setHighlightedIndex(enabledIndices[next] ?? -1);
    };

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen) {
          if (highlightedIndex >= 0 && highlightedIndex < options.length) {
            handleSelect(options[highlightedIndex].value);
          }
        } else {
          setIsOpen(true);
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          move(1);
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          move(-1);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;

      case 'Home':
      case 'End':
        if (isOpen) {
          e.preventDefault();
          setHighlightedIndex(e.key === 'Home' ? (enabledIndices[0] ?? -1) : (enabledIndices.at(-1) ?? -1));
        }
        break;

      case 'Tab':
        if (isOpen) {
          setIsOpen(false);
        }
        break;

      default:
        if (isOpen && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const start = Math.max(0, enabledIndices.indexOf(highlightedIndex) + 1);
          const ordered = [...enabledIndices.slice(start), ...enabledIndices.slice(0, start)];
          const match = ordered.find((index) =>
            options[index].label.toLocaleLowerCase().startsWith(e.key.toLocaleLowerCase())
          );
          if (match != null) setHighlightedIndex(match);
        }
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative inline-block w-full text-left ${className}`}>
      {/* Hidden input for HTML form accessibility & test selectors */}
      {name && <input type="hidden" name={name} value={value} />}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-activedescendant={isOpen && highlightedIndex >= 0 ? `${selectId}-option-${highlightedIndex}` : undefined}
        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 text-xs font-semibold transition-all duration-150 outline-none ${
          isOpen
            ? 'border-brand-green bg-brand-surface text-brand-text shadow-sm ring-2 ring-brand-green/20 dark:border-brand-green dark:bg-[#0e271f] dark:text-white dark:ring-brand-green/20'
            : 'border-brand-border bg-brand-surface text-brand-text hover:border-brand-green hover:bg-brand-bgAlt dark:border-[#173e33] dark:bg-[#0e271f] dark:text-white dark:hover:border-emerald-500/40 dark:hover:bg-[#13382c]'
        } ${
          disabled
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer focus-visible:border-brand-green focus-visible:ring-2 focus-visible:ring-brand-green/20 dark:focus-visible:border-brand-green dark:focus-visible:ring-brand-green/20'
        } ${triggerClassName}`}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">
            {selectedOption ? (
              selectedOption.label
            ) : (
              <span className="text-brand-muted dark:text-white/40">{placeholder}</span>
            )}
          </span>
        </span>

        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-brand-muted transition-transform duration-200 dark:text-white/40 ${
            isOpen ? 'rotate-180 text-brand-green' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', ...position }}
            className={`pointer-events-auto z-[150] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-brand-border/80 bg-brand-surface p-1 shadow-card backdrop-blur-md dark:border-[#173e33] dark:bg-[#0e271f] ${menuClassName}`}
          >
            <ul
              ref={listboxRef}
              id={listboxId}
              role="listbox"
              tabIndex={-1}
              aria-activedescendant={highlightedIndex >= 0 ? `${selectId}-option-${highlightedIndex}` : undefined}
              className="max-h-60 overflow-y-auto space-y-0.5 scrollbar-thin"
            >
              {options.map((option, idx) => {
                const isSelected = option.value === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <li
                    key={option.value}
                    id={`${selectId}-option-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    onClick={() => handleSelect(option.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-colors select-none ${option.disabled ? 'opacity-40' : ''} ${
                      isSelected
                        ? 'bg-brand-green/15 text-brand-green dark:bg-brand-accent/20 dark:text-brand-accent font-bold'
                        : isHighlighted
                          ? 'bg-brand-bgAlt/80 text-brand-text dark:bg-white/[0.06] dark:text-white'
                          : 'text-brand-text/90 hover:bg-brand-bgAlt/50 dark:text-white/80 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {option.icon && <span className="shrink-0">{option.icon}</span>}
                      <span className="truncate">{option.label}</span>
                    </span>

                    {isSelected && (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-brand-green dark:text-brand-accent"
                        aria-hidden="true"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
