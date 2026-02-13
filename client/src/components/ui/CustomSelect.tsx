import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  color?: string; // Optional color dot
  icon?: React.ReactNode; // Optional icon
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const CustomSelect: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div
      className={`custom-select-container ${className} ${disabled ? 'disabled' : ''}`}
      ref={containerRef}
    >
      <div
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="selected-value">
          {selectedOption ? (
            <div className="option-content">
              {selectedOption.color && (
                <span
                  className="color-dot"
                  style={{ backgroundColor: selectedOption.color }}
                />
              )}
              {selectedOption.icon && (
                <span className="option-icon">{selectedOption.icon}</span>
              )}
              {selectedOption.label}
            </div>
          ) : (
            <span className="placeholder">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={`arrow-icon ${isOpen ? 'rotate' : ''}`} size={16} />
      </div>

      {isOpen && (
        <div className="custom-select-dropdown">
          {options.length > 0 ? (
            options.map((option) => (
              <div
                key={option.value}
                className={`custom-select-option ${
                  option.value === value ? 'selected' : ''
                }`}
                onClick={() => handleSelect(option.value)}
              >
                <div className="option-content">
                  {option.color && (
                    <span
                      className="color-dot"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  {option.icon && (
                    <span className="option-icon">{option.icon}</span>
                  )}
                  {option.label}
                </div>
                {option.value === value && <Check size={14} className="check-icon" />}
              </div>
            ))
          ) : (
            <div className="custom-select-option no-results">No options</div>
          )}
        </div>
      )}
    </div>
  );
};
