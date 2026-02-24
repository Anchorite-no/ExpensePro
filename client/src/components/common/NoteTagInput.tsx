import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import './NoteTagInput.css';

interface NoteTagInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag?: (tag: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function NoteTagInput({
  value,
  onChange,
  onKeyDown,
  placeholder = "备注 (输入 # 呼出标签)",
  tags,
  onAddTag,
  onRemoveTag,
  className = '',
  style
}: NoteTagInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, flipUp: false });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Compute dropdown position relative to viewport (for portal/fixed)
  const updateCoords = useCallback(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const dropdownMaxHeight = 200;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const flipUp = spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow;
      setCoords({
        top: flipUp ? rect.top : rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 260),
        flipUp,
      });
    }
  }, []);

  // Parse input to decide whether to show dropdown
  // Match # anywhere — even at the very start or after any character
  useEffect(() => {
    if (!inputRef.current) return;
    const pos = inputRef.current.selectionStart || 0;
    const textBeforeCursor = value.substring(0, pos);

    // Match # followed by optional non-space/non-# chars at end of text before cursor
    const match = textBeforeCursor.match(/#([^\s#]*)$/);
    if (match) {
      setShowDropdown(true);
      setFilter(match[1]);
      setCursorPos(pos);
      setSelectedIndex(0);
      updateCoords();
    } else {
      setShowDropdown(false);
    }
  }, [value, updateCoords]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const dropdownEl = document.getElementById('note-tag-dropdown-portal');
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node) &&
        dropdownEl &&
        !dropdownEl.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on external scroll
  useEffect(() => {
    if (!showDropdown) return;
    const handleScroll = (e: Event) => {
      const dropdownEl = document.getElementById('note-tag-dropdown-portal');
      if (dropdownEl && dropdownEl.contains(e.target as Node)) return;
      setShowDropdown(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [showDropdown]);

  const filteredTags = tags.filter(t => t.toLowerCase().includes(filter.toLowerCase()));
  const exactMatchExists = tags.some(t => t.toLowerCase() === filter.toLowerCase());

  const showCreateOption = filter.length > 0 && !exactMatchExists;

  const options = showCreateOption
    ? [{ isNew: true, label: filter }, ...filteredTags.map(t => ({ isNew: false, label: t }))]
    : filteredTags.map(t => ({ isNew: false, label: t }));

  const insertTag = (tag: string, isNew: boolean) => {
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');

    if (lastHashIndex !== -1) {
      const textAfterCursor = value.substring(cursorPos);
      const newText = value.substring(0, lastHashIndex) + '#' + tag + ' ' + textAfterCursor;
      onChange(newText);

      setTimeout(() => {
        if (inputRef.current) {
          const newPos = lastHashIndex + tag.length + 2;
          inputRef.current.setSelectionRange(newPos, newPos);
          inputRef.current.focus();
        }
      }, 0);
    }

    if (isNew) {
      onAddTag(tag);
    }

    setShowDropdown(false);
  };

  const handleRemoveTag = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    if (onRemoveTag) {
      onRemoveTag(tag);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && options.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % options.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + options.length) % options.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selectedOption = options[selectedIndex];
        insertTag(selectedOption.label, selectedOption.isNew);
        return;
      }
      if (e.key === 'Escape') {
        setShowDropdown(false);
        return;
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <div className={`note-tag-input-wrapper ${className}`} style={style} ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        onClick={() => {
          if (inputRef.current) {
            setCursorPos(inputRef.current.selectionStart || 0);
          }
        }}
        onKeyUp={() => {
          if (inputRef.current) {
            setCursorPos(inputRef.current.selectionStart || 0);
          }
        }}
      />

      {showDropdown && createPortal(
        <div
          id="note-tag-dropdown-portal"
          className={`tag-dropdown-menu ${coords.flipUp ? 'flip-up' : ''}`}
          ref={dropdownRef}
          style={{
            position: 'fixed',
            ...(coords.flipUp
              ? { bottom: window.innerHeight - coords.top + 4 }
              : { top: coords.top }),
            left: coords.left,
            width: coords.width,
            maxWidth: 320,
            zIndex: 9999,
          }}
        >
          <div className="tag-dropdown-header">标签词库</div>
          {options.length > 0 ? (
            <div className="tag-dropdown-list">
              {options.map((option, idx) => (
                <div
                  key={`${option.label}-${option.isNew}`}
                  className={`tag-dropdown-item ${idx === selectedIndex ? 'selected' : ''} ${option.isNew ? 'is-new' : ''}`}
                  onClick={() => insertTag(option.label, option.isNew)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  {option.isNew ? (
                    <span className="create-new-text"><Plus size={12} /> 创建 "#{option.label}"</span>
                  ) : (
                    <span className="tag-label-text">#{option.label}</span>
                  )}
                  {!option.isNew && onRemoveTag && (
                    <button
                      className="tag-delete-btn"
                      onClick={(e) => handleRemoveTag(e, option.label)}
                      title="删除标签"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="tag-dropdown-empty">
              没有匹配的标签
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

/**
 * Utility: render a note string with #tags as styled pills.
 * Use this in table cells / display areas.
 */
export function renderNoteWithTags(note: string): React.ReactNode {
  if (!note) return null;

  // Split by #tag pattern, keep both text and tags
  const parts = note.split(/(#[^\s#]+)/g);
  if (parts.length <= 1) return note;

  return (
    <span className="note-with-tags">
      {parts.map((part, i) => {
        if (part.startsWith('#') && part.length > 1) {
          return (
            <span key={i} className="note-tag-pill">
              {part}
            </span>
          );
        }
        return part ? <span key={i}>{part}</span> : null;
      })}
    </span>
  );
}
