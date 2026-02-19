import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import './Select.css';

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

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{
    top?: number;
    left: number;
    width: number;
    bottom?: number;
  }>({ left: 0, width: 0 });

  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside the trigger AND the dropdown (which is portaled)
      const dropdown = document.getElementById('select-dropdown-portal');
      
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdown &&
        !dropdown.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    // Close on scroll to prevent floating menu issues
    const handleScroll = () => {
      if (isOpen) setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true); // Capture phase to catch scroll in any container
    window.addEventListener('resize', handleScroll);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  const toggleOpen = () => {
    if (disabled) return;
    
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const DROPDOWN_MAX_HEIGHT = 260; // 250px + padding/margin

      // Decide whether to flip: if not enough space below AND more space above
      if (spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow) {
        // Render ABOVE
        setCoords({
          bottom: window.innerHeight - rect.top + 4, // 4px margin from top of trigger
          left: rect.left,
          width: rect.width,
          top: undefined
        });
      } else {
        // Render BELOW (Default)
        setCoords({
          top: rect.bottom + 4, // 4px margin from bottom of trigger
          left: rect.left,
          width: rect.width,
          bottom: undefined
        });
      }
    }
    setIsOpen(!isOpen);
  };

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
        onClick={toggleOpen}
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

      {isOpen && createPortal(
        <div 
          id="select-dropdown-portal"
          className="custom-select-dropdown"
          style={{
            position: 'fixed',
            top: coords.top !== undefined ? coords.top : 'auto',
            bottom: coords.bottom !== undefined ? coords.bottom : 'auto',
            left: coords.left,
            width: coords.width,
            zIndex: 9999, // Ensure it's on top
            transformOrigin: coords.bottom !== undefined ? 'bottom center' : 'top center'
          }}
        >
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
        </div>,
        document.body
      )}
    </div>
  );
};
