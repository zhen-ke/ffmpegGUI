import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { ChevronDown, Edit2, Trash2 } from 'lucide-react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className="w-full p-2 border border-gray-300 rounded text-sm flex justify-between items-center bg-white dark:bg-background-textarea dark:border-border-dark dark:text-text-lightDark"
      >
        <span className="truncate text-left">{value ? value.name : placeholder}</span>
        <ChevronDown size={18} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="dark:bg-background-dark dark:border-border-dark absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-96 overflow-auto"
        >
          {options.map((option) => (
            <li
              key={option.id}
              role="none"
              className={`dark:hover:bg-background-textarea dark:text-text-lightDark p-2 hover:bg-gray-100 ${
                value && value.id === option.id
                  ? 'bg-blue-100 dark:bg-background-textarea'
                  : ''
              }`}
            >
              <div className="flex justify-between items-center gap-2">
                <button
                  type="button"
                  role="option"
                  aria-selected={!!value && value.id === option.id}
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                  }}
                  className="flex-1 text-left"
                >
                  <div className="font-semibold">{option.name}</div>
                  <div className="text-xs text-gray-500">{option.description}</div>
                </button>
                {option.isCustom && (
                  <div className="flex space-x-2 ml-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit?.({ id: option.id });
                      }}
                      aria-label={`Edit template ${option.name}`}
                      className="p-1 hover:bg-blue-100 rounded"
                    >
                      <Edit2 size={16} className="text-blue-600" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(option.id);
                      }}
                      aria-label={`Delete template ${option.name}`}
                      className="p-1 hover:bg-red-100 rounded"
                    >
                      <Trash2 size={16} className="text-red-600" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Dropdown;
