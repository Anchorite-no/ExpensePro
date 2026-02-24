import React from 'react';
import { extractTags } from '../../utils/tags';
import './NoteWithTags.css';

interface NoteWithTagsProps {
  note: string | null | undefined;
  className?: string;
}

const NoteWithTags: React.FC<NoteWithTagsProps> = ({ note, className = '' }) => {
  if (!note) return null;

  // Render simple text without any processing if no hashtag pattern found
  // to save computation
  if (!/(?:^|\s)#[^\s#]+/.test(note)) {
    return <span className={className}>{note}</span>;
  }

  // We need to parse the note to separate normal text from hashtags
  // Split the text by hashtag pattern
  // We use capture group so the split output contains the matched tags
  const parts = note.split(/(#(?:[^\s#]+))/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        // If it starts with # and isn't just a #, it's a tag
        if (part.startsWith('#') && part.length > 1) {
          const tagName = part.substring(1); // remove the #
          return (
            <span key={i} className="tag-pill" title={`标签: ${tagName}`}>
              {part}
            </span>
          );
        }
        // It's normal text, don't render empty spans
        return part ? <span key={i}>{part}</span> : null;
      })}
    </span>
  );
};

export default NoteWithTags;
