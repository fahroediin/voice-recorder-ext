import React, { useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Bold, Italic, List, ListOrdered, RotateCcw } from 'lucide-react';

interface PlainTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

export const PlainTextEditor: React.FC<PlainTextEditorProps> = ({
  content,
  onChange,
  placeholder = "Start typing your meeting notes...",
  className = ""
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }, [content]);

  // Apply text formatting
  const applyFormat = (format: 'bold' | 'italic' | 'bullet' | 'numbered') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    let formattedText = '';

    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'bullet':
        formattedText = `• ${selectedText || 'List item'}`;
        break;
      case 'numbered':
        formattedText = `1. ${selectedText || 'List item'}`;
        break;
    }

    const newContent = content.substring(0, start) + formattedText + content.substring(end);
    onChange(newContent);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
    }, 0);
  };

  // Clear content
  const clearContent = () => {
    if (window.confirm('Are you sure you want to clear all notes?')) {
      onChange('');
      textareaRef.current?.focus();
    }
  };

  return (
    <div className={`border border-input rounded-md ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-input bg-muted/50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyFormat('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyFormat('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyFormat('bullet')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyFormat('numbered')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={clearContent}
          title="Clear All"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-3 border-0 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none min-h-[200px]"
        style={{ minHeight: '200px' }}
      />

      {/* Character count */}
      <div className="px-3 py-2 border-t border-input bg-muted/30">
        <div className="text-xs text-muted-foreground">
          {content.length} characters • {content.split(/\s+/).filter(word => word.length > 0).length} words • {content.split('\n').length} lines
        </div>
      </div>

      {/* Formatting help */}
      <div className="px-3 py-2 border-t border-input bg-muted/30">
        <div className="text-xs text-muted-foreground">
          <strong>Quick Tips:</strong> Use **text** for bold, *text* for italic, • for bullets, 1. for numbered lists
        </div>
      </div>
    </div>
  );
};