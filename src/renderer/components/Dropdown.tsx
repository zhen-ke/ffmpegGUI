import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { ChevronDown, Edit2, Trash2, FileCode, Sparkles } from 'lucide-react';
import { Template } from '../types/template';

export interface DropdownOption extends Omit<Template, 'name' | 'description'> {
  name: string;
  description: string;
}

interface DropdownProps {
  options: DropdownOption[];
  onChange: (option: DropdownOption) => void;
  value: DropdownOption | null;
  placeholder: string;
  onEdit?: (template: { id: string }) => void;
  onDelete?: (templateId: string) => void;
}

const Dropdown: React.FC<DropdownProps> = ({
  options,
  onChange,
  value,
  placeholder,
  onEdit,
  onDelete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) {
        if (
          event.key === 'Enter' ||
          event.key === ' ' ||
          event.key === 'ArrowDown'
        ) {
          event.preventDefault();
          setIsOpen(true);
          if (options.length > 0) {
            setHighlightedIndex(
              value ? options.findIndex((o) => o.id === value.id) : 0,
            );
          }
        }
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev < options.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : options.length - 1,
          );
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (highlightedIndex >= 0 && options[highlightedIndex]) {
            onChange(options[highlightedIndex]);
            setIsOpen(false);
          }
          break;
        case 'Tab':
          setIsOpen(false);
          break;
      }
    },
    [isOpen, options, highlightedIndex, onChange, value],
  );

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[
        highlightedIndex
      ] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleOptionClick = useCallback(
    (option: DropdownOption) => {
      onChange(option);
      setIsOpen(false);
    },
    [onChange],
  );

  return (
    <div className="relative h-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className={`w-full h-full p-2 border-2 rounded-xl text-sm flex justify-between items-center bg-white dark:bg-slate-800 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
          isOpen
            ? 'border-primary-400 dark:border-primary-600 shadow-md ring-2 ring-primary-100 dark:ring-primary-900/30'
            : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-sm'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {value ? (
            <>
              <div
                className={`p-1.5 rounded-lg flex-shrink-0 ${value.isCustom ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-primary-500 to-cyan-500'}`}
              >
                {value.isCustom ? (
                  <Sparkles size={14} className="text-white" />
                ) : (
                  <FileCode size={14} className="text-white" />
                )}
              </div>
              <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                {value.name}
              </span>
            </>
          ) : (
            <>
              <div className="p-1.5 rounded-lg flex-shrink-0 bg-slate-100 dark:bg-slate-700">
                <FileCode
                  size={14}
                  className="text-slate-400 dark:text-slate-500"
                />
              </div>
              <span className="text-slate-400 dark:text-slate-500">
                {placeholder}
              </span>
            </>
          )}
        </div>
        <ChevronDown
          size={18}
          className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <ul
          id={listboxId}
          ref={listRef}
          role="listbox"
          aria-activedescendant={
            highlightedIndex >= 0 ? `option-${highlightedIndex}` : undefined
          }
          className="absolute z-20 w-full mt-2 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl shadow-xl dark:shadow-slate-900/50 max-h-80 overflow-auto"
        >
          {options.length === 0 ? (
            <li className="px-4 py-6 text-center text-slate-500 dark:text-slate-400 text-sm">
              No templates available
            </li>
          ) : (
            options.map((option, index) => (
              <li
                key={option.id}
                id={`option-${index}`}
                role="none"
                className={`border-b border-slate-50 dark:border-slate-700/50 last:border-b-0 ${
                  value && value.id === option.id
                    ? 'bg-primary-50 dark:bg-primary-900/20'
                    : index === highlightedIndex
                      ? 'bg-slate-100 dark:bg-slate-700/50'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                }`}
              >
                <div className="flex justify-between items-center gap-2 p-3">
                  <button
                    type="button"
                    role="option"
                    aria-selected={!!value && value.id === option.id}
                    onClick={() => handleOptionClick(option)}
                    className="flex-1 text-left min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded-lg ${option.isCustom ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-primary-500 to-cyan-500'}`}
                      >
                        {option.isCustom ? (
                          <Sparkles size={12} className="text-white" />
                        ) : (
                          <FileCode size={12} className="text-white" />
                        )}
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {option.name}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-9">
                      {option.description}
                    </div>
                  </button>
                  {option.isCustom && (
                    <div className="flex gap-1 ml-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit?.({ id: option.id });
                        }}
                        aria-label={`Edit template ${option.name}`}
                        className="p-2 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                      >
                        <Edit2
                          size={14}
                          className="text-primary-600 dark:text-primary-400"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete?.(option.id);
                        }}
                        aria-label={`Delete template ${option.name}`}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <Trash2
                          size={14}
                          className="text-red-600 dark:text-red-400"
                        />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default Dropdown;
