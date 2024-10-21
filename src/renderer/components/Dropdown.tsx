import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

export interface DropdownOption {
  name: string;
  command: string;
  description: string;
}

interface DropdownProps {
  options: DropdownOption[];
  onChange: (option: DropdownOption) => void;
  value: DropdownOption | null;
  placeholder: string;
}

const Dropdown: React.FC<DropdownProps> = ({
  options,
  onChange,
  value,
  placeholder,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

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
    if (isOpen && optionsRef.current && value) {
      const selectedOption = optionsRef.current.querySelector(
        `[data-value="${value.name}"]`,
      );
      if (selectedOption) {
        selectedOption.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen, value]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 border border-gray-300 rounded text-sm flex justify-between items-center bg-white"
      >
        <span>{value ? value.name : placeholder}</span>
        <ChevronDown size={18} />
      </button>
      {isOpen && (
        <div
          ref={optionsRef}
          className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-72 overflow-auto"
        >
          {options.map((option, index) => (
            <div
              key={index}
              data-value={option.name}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
              className={`p-2 hover:bg-gray-100 cursor-pointer ${
                value && value.name === option.name ? 'bg-blue-100' : ''
              }`}
            >
              <div className="font-semibold">{option.name}</div>
              <div className="text-xs text-gray-500">{option.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
