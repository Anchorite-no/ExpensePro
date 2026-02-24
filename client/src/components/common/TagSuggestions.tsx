import React, { useMemo } from 'react';
import { getTopTags } from '../../utils/tags';
import './TagSuggestions.css';

interface TagSuggestionsProps {
  expenses: Array<{ note?: string | null }>;
  currentNote: string;
  onSelectTag: (tag: string) => void;
  limit?: number;
}

const TagSuggestions: React.FC<TagSuggestionsProps> = ({ 
  expenses, 
  currentNote, 
  onSelectTag, 
  limit = 4 
}) => {
  const topTags = useMemo(() => {
    return getTopTags(expenses, limit);
  }, [expenses, limit]);

  if (topTags.length === 0) return null;

  return (
    <div className="tag-suggestions">
      {topTags.map(tag => (
        <button
          key={tag}
          className="tag-suggestion-btn"
          onClick={(e) => {
            e.preventDefault();
            onSelectTag(tag);
          }}
          type="button"
          title={`添加标签: #${tag}`}
        >
          #{tag}
        </button>
      ))}
    </div>
  );
};

export default TagSuggestions;
