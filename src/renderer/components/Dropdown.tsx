import React, { useState, useRef, useEffect, useCallback } from 'react';
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 border border-gray-300 rounded text-sm flex justify-between items-center bg-white dark:bg-background-textarea dark:border-border-dark dark:text-text-lightDark"
      >
        <span>{value ? value.name : placeholder}</span>
        <ChevronDown size={18} />
      </button>
      <div
        className={`dark:bg-background-dark dark:border-border-dark absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-96 overflow-auto ${
          isOpen ? '' : 'hidden'
        }`}
      >
        {options.map((option) => (
          <div
            key={option.id}
            className={`dark:hover:bg-background-textarea dark:text-text-lightDark p-2 hover:bg-gray-100 cursor-pointer ${
              value && value.id === option.id
                ? 'bg-blue-100 dark:bg-background-textarea'
                : ''
            }`}
          >
            <div className="flex justify-between items-center">
              <div
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className="flex-1"
              >
                <div className="font-semibold">{option.name}</div>
                <div className="text-xs text-gray-500">
                  {option.description}
                </div>
              </div>
              {option.isCustom && (
                <div className="flex space-x-2 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.({ id: option.id });
                    }}
                    className="p-1 hover:bg-blue-100 rounded"
                  >
                    <Edit2 size={16} className="text-blue-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(option.id);
                    }}
                    className="p-1 hover:bg-red-100 rounded"
                  >
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dropdown;
