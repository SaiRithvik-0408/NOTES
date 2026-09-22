import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  useTheme,
  Chip,
} from '@mui/material';
import {
  FormatBold,
  FormatItalic,
  Code,
  FormatListBulleted,
  FormatListNumbered,
  CheckBoxOutlined,
  FormatQuote,
  TableChart,
  Title,
  Link as LinkIcon,
  Lightbulb,
  Terminal,
} from '@mui/icons-material';
import './editor.css';

interface TipTapEditorProps {
  initialContent: string;
  onChange: (html: string, plainText: string) => void;
  onNavigateBacklink?: (title: string) => void;
  editable?: boolean;
  onRequireAuth?: () => void;
}

interface SlashCommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  action: (editor: any) => void;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  initialContent,
  onChange,
  onNavigateBacklink,
  editable = true,
  onRequireAuth,
}) => {
  const theme = useTheme();
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: "Press '/' for commands or start typing...",
      }),
      CharacterCount,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: initialContent,
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      onChange(html, text);
    },
  });

  // Keep editor content synchronized if external note changes
  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      // Avoid resetting if active typing
      if (!editor.isFocused) {
        editor.commands.setContent(initialContent, false);
      }
    }
  }, [initialContent, editor]);

  // Keep editor editable state synchronized with prop
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Slash commands registry
  const slashCommands: SlashCommandItem[] = [
    {
      title: 'Heading 1',
      description: 'Big section heading',
      icon: <Title fontSize="small" />,
      action: (ed) => ed.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      title: 'Heading 2',
      description: 'Medium section heading',
      icon: <Title fontSize="small" style={{ transform: 'scale(0.85)' }} />,
      action: (ed) => ed.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      title: 'Bullet List',
      description: 'Create a simple bulleted list',
      icon: <FormatListBulleted fontSize="small" />,
      action: (ed) => ed.chain().focus().toggleBulletList().run(),
    },
    {
      title: 'Numbered List',
      description: 'Create a numbered sequential list',
      icon: <FormatListNumbered fontSize="small" />,
      action: (ed) => ed.chain().focus().toggleOrderedList().run(),
    },
    {
      title: 'Task Checklist',
      description: 'Track tasks with checkboxes',
      icon: <CheckBoxOutlined fontSize="small" />,
      action: (ed) => ed.chain().focus().toggleTaskList().run(),
    },
    {
      title: 'Code Block',
      description: 'Syntax-highlighted code container',
      icon: <Terminal fontSize="small" />,
      action: (ed) => ed.chain().focus().toggleCodeBlock().run(),
    },
    {
      title: 'Quote',
      description: 'Capture a memorable quote or callout',
      icon: <FormatQuote fontSize="small" />,
      action: (ed) => ed.chain().focus().toggleBlockquote().run(),
    },
    {
      title: 'Data Table',
      description: 'Insert a 3x3 interactive table',
      icon: <TableChart fontSize="small" />,
      action: (ed) => ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      title: 'Callout Box',
      description: 'Emphasize crucial information',
      icon: <Lightbulb fontSize="small" />,
      action: (ed) =>
        ed
          .chain()
          .focus()
          .insertContent(
            '<div class="nexus-callout"><div class="nexus-callout-icon">💡</div><div class="nexus-callout-content"><p><strong>Note:</strong> Insert your highlight or warning here.</p></div></div>'
          )
          .run(),
    },
  ];

  // Intercept "/" key for slash menu
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && editor.isFocused) {
        // Calculate coordinates of cursor
        const { from } = editor.state.selection;
        const coords = editor.view.coordsAtPos(from);
        setMenuAnchor({ top: coords.bottom + 8, left: coords.left });
      } else if (event.key === 'Escape') {
        setMenuAnchor(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor]);

  const executeSlashCommand = (cmd: SlashCommandItem) => {
    if (!editor) return;
    // Remove the trailing slash typed by user
    const { from } = editor.state.selection;
    editor.commands.deleteRange({ from: Math.max(0, from - 1), to: from });
    cmd.action(editor);
    setMenuAnchor(null);
  };

  if (!editor) {
    return null;
  }

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      {/* Floating Bubble Toolbar */}
      {editor && editable && (
        <BubbleMenu editor={editor}>
          <Paper
            elevation={4}
            sx={{
              display: 'flex',
              alignItems: 'center',
              background: theme.palette.mode === 'dark' ? '#141d32' : '#ffffff',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              padding: '4px 6px',
              gap: '2px',
            }}
          >
            <Tooltip title="Bold">
              <IconButton
                size="small"
                color={editor.isActive('bold') ? 'primary' : 'default'}
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <FormatBold fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Italic">
              <IconButton
                size="small"
                color={editor.isActive('italic') ? 'primary' : 'default'}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                <FormatItalic fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Inline Code">
              <IconButton
                size="small"
                color={editor.isActive('code') ? 'primary' : 'default'}
                onClick={() => editor.chain().focus().toggleCode().run()}
              >
                <Code fontSize="small" />
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Tooltip title="Heading 2">
              <IconButton
                size="small"
                color={editor.isActive('heading', { level: 2 }) ? 'primary' : 'default'}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                <Title fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Quote">
              <IconButton
                size="small"
                color={editor.isActive('blockquote') ? 'primary' : 'default'}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              >
                <FormatQuote fontSize="small" />
              </IconButton>
            </Tooltip>
          </Paper>
        </BubbleMenu>
      )}

      {/* Editor Content Area */}
      <Box
        className="nexus-editor-content"
        onClick={() => {
          if (!editable && onRequireAuth) {
            onRequireAuth();
          }
        }}
        sx={{
          cursor: !editable ? 'pointer' : 'text',
        }}
      >
        <EditorContent editor={editor} />
      </Box>

      {/* Slash Command Palette Menu */}
      <Menu
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorReference="anchorPosition"
        anchorPosition={menuAnchor ? { top: menuAnchor.top, left: menuAnchor.left } : undefined}
        PaperProps={{
          sx: {
            width: 280,
            maxHeight: 340,
            borderRadius: '12px',
            backgroundColor: theme.palette.mode === 'dark' ? '#141d32' : '#ffffff',
            boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            border: `1px solid ${theme.palette.divider}`,
            py: 0.5,
          },
        }}
      >
        <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>
            Insert Block
          </Typography>
        </Box>
        {slashCommands.map((cmd) => (
          <MenuItem
            key={cmd.title}
            onClick={() => executeSlashCommand(cmd)}
            sx={{
              py: 1,
              px: 1.5,
              borderRadius: '6px',
              mx: 0.5,
              my: 0.2,
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(79, 70, 229, 0.08)',
              },
            }}
          >
            <ListItemIcon sx={{ color: 'primary.main', minWidth: 36 }}>{cmd.icon}</ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {cmd.title}
                </Typography>
              }
              secondary={
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {cmd.description}
                </Typography>
              }
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Word & Character Count Pill */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 2, gap: 1 }}>
        <Chip
          label={`${editor.storage.characterCount.words()} words`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.75rem', opacity: 0.7 }}
        />
        <Chip
          label={`${editor.storage.characterCount.characters()} characters`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.75rem', opacity: 0.7 }}
        />
      </Box>
    </Box>
  );
};
