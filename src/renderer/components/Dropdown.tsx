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
    <div className="relative h-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className={`w-full h-full p-2 border-2 rounded-xl text-sm flex justify-between items-center bg-white transition-all duration-200 ${
          isOpen
            ? 'border-blue-400 shadow-md ring-2 ring-blue-100'
            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {value ? (
            <>
              <div
                className={`p-1.5 rounded-lg flex-shrink-0 ${value.isCustom ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'}`}
              >
                {value.isCustom ? (
                  <Sparkles size={14} className="text-white" />
                ) : (
                  <FileCode size={14} className="text-white" />
                )}
              </div>
              <span className="truncate font-medium text-gray-800">
                {value.name}
              </span>
            </>
          ) : (
            <>
              <div className="p-1.5 rounded-lg flex-shrink-0 bg-gray-100">
                <FileCode size={14} className="text-gray-400" />
              </div>
              <span className="text-gray-400">{placeholder}</span>
            </>
          )}
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 w-full mt-2 bg-white border-2 border-gray-100 rounded-xl shadow-xl max-h-80 overflow-auto"
        >
          {options.length === 0 ? (
            <li className="px-4 py-6 text-center text-gray-400 text-sm">
              No templates available
            </li>
          ) : (
            options.map((option) => (
              <li
                key={option.id}
                role="none"
                className={`border-b border-gray-50 last:border-b-0 ${
                  value && value.id === option.id
                    ? 'bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center gap-2 p-3">
                  <button
                    type="button"
                    role="option"
                    aria-selected={!!value && value.id === option.id}
                    onClick={() => {
                      onChange(option);
                      setIsOpen(false);
                    }}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded-lg ${option.isCustom ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'}`}
                      >
                        {option.isCustom ? (
                          <Sparkles size={12} className="text-white" />
                        ) : (
                          <FileCode size={12} className="text-white" />
                        )}
                      </div>
                      <span className="font-semibold text-gray-800">
                        {option.name}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 ml-9">
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
                        className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <Edit2 size={14} className="text-blue-600" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete?.(option.id);
                        }}
                        aria-label={`Delete template ${option.name}`}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} className="text-red-600" />
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
