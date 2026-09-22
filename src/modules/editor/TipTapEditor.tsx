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
  Button,
  Tooltip,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  useTheme,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Snackbar,
  Alert,
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
  Lightbulb,
  Terminal,
  Mic,
  MicOff,
  AutoAwesome,
  Checklist,
  Settings,
  ContentCopy,
  Check,
  Undo,
  Redo,
  ElectricBolt,
} from '@mui/icons-material';
import './editor.css';
import { useSpeechDictation } from '../../utils/speechRecognition';
import {
  summarizeDocument,
  fixGrammarAndPolish,
  extractActionItems,
  extractKeyTakeaways,
  getStoredGeminiKey,
  setStoredGeminiKey,
  htmlToPlainText,
} from '../../utils/aiAssistant';

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
  const [slashMenuAnchor, setSlashMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [aiMenuAnchor, setAiMenuAnchor] = useState<null | HTMLElement>(null);

  // AI Assistant State
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiResultTitle, setAiResultTitle] = useState('');
  const [aiResultContent, setAiResultContent] = useState('');
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: "Press '/' for commands, or use the top toolbar for Voice & AI...",
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

  // Voice Dictation Hook
  const {
    isListening,
    interimTranscript,
    isSupported: isSpeechSupported,
    error: speechError,
    toggleListening,
    stopListening,
  } = useSpeechDictation({
    onTranscript: (text, isFinal) => {
      if (!editor || !editable) return;
      if (isFinal && text.trim()) {
        editor.commands.insertContent(text + ' ');
      }
    },
    onError: (err) => {
      setToastMessage(err);
    },
  });

  // Keep editor content synchronized if external note changes
  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      if (!editor.isFocused && !isListening) {
        editor.commands.setContent(initialContent, false);
      }
    }
  }, [initialContent, editor, isListening]);

  // Keep editor editable state synchronized with prop
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
      if (!editable && isListening) {
        stopListening();
      }
    }
  }, [editor, editable, isListening, stopListening]);

  // Pre-load stored Gemini Key
  useEffect(() => {
    setGeminiApiKeyInput(getStoredGeminiKey());
  }, [aiSettingsOpen]);

  // AI Actions
  const handleRunAiAction = async (
    type: 'summarize' | 'polish' | 'tasks' | 'takeaways'
  ) => {
    if (!editor) return;
    setAiMenuAnchor(null);

    const selectionText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to
    );
    const hasSelection = selectionText.trim().length > 0;
    const contentToProcess = hasSelection ? selectionText : editor.getHTML();

    setIsAiProcessing(true);
    try {
      if (type === 'summarize') {
        const summaryHtml = await summarizeDocument(contentToProcess);
        setAiResultTitle('⚡ AI Document Summary');
        setAiResultContent(summaryHtml);
        setAiModalOpen(true);
      } else if (type === 'polish') {
        const polishedHtml = await fixGrammarAndPolish(contentToProcess);
        setAiResultTitle('✍️ Polished Content');
        setAiResultContent(polishedHtml);
        setAiModalOpen(true);
      } else if (type === 'tasks') {
        const checklistHtml = await extractActionItems(contentToProcess);
        setAiResultTitle('✅ Extracted Action Checklist');
        setAiResultContent(checklistHtml);
        setAiModalOpen(true);
      } else if (type === 'takeaways') {
        const takeawaysHtml = await extractKeyTakeaways(contentToProcess);
        setAiResultTitle('💡 Key Takeaways');
        setAiResultContent(takeawaysHtml);
        setAiModalOpen(true);
      }
    } catch (err: any) {
      setToastMessage(`AI Assistant error: ${err?.message || 'Failed to process'}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleInsertAiResultAtCursor = () => {
    if (!editor || !aiResultContent) return;
    editor.chain().focus().insertContent(aiResultContent).run();
    setAiModalOpen(false);
    setToastMessage('Inserted into note');
  };

  const handleAppendAiResult = () => {
    if (!editor || !aiResultContent) return;
    const currentHtml = editor.getHTML();
    editor.commands.setContent(`${currentHtml}<br/>${aiResultContent}`);
    setAiModalOpen(false);
    setToastMessage('Appended to bottom of note');
  };

  const handleReplaceWithAiResult = () => {
    if (!editor || !aiResultContent) return;
    editor.commands.setContent(aiResultContent);
    setAiModalOpen(false);
    setToastMessage('Note replaced with AI content');
  };

  const handleCopyAiResult = () => {
    const plain = htmlToPlainText(aiResultContent);
    navigator.clipboard.writeText(plain);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const handleSaveGeminiKey = () => {
    setStoredGeminiKey(geminiApiKeyInput);
    setAiSettingsOpen(false);
    setToastMessage(geminiApiKeyInput.trim() ? 'Google Gemini API key saved!' : 'Gemini key cleared. Local NLP active.');
  };

  // Slash commands registry
  const slashCommands: SlashCommandItem[] = [
    {
      title: 'Voice Dictation',
      description: 'Start hands-free speech-to-text',
      icon: <Mic fontSize="small" color="error" />,
      action: () => {
        if (!editable) {
          onRequireAuth?.();
          return;
        }
        toggleListening();
      },
    },
    {
      title: 'AI Summary',
      description: 'Generate concise executive summary',
      icon: <AutoAwesome fontSize="small" color="primary" />,
      action: () => handleRunAiAction('summarize'),
    },
    {
      title: 'AI Action Checklist',
      description: 'Extract to-dos into interactive checkboxes',
      icon: <Checklist fontSize="small" color="success" />,
      action: () => handleRunAiAction('tasks'),
    },
    {
      title: 'AI Key Takeaways',
      description: 'Generate key takeaway callout box',
      icon: <ElectricBolt fontSize="small" color="warning" />,
      action: () => handleRunAiAction('takeaways'),
    },
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
        const { from } = editor.state.selection;
        const coords = editor.view.coordsAtPos(from);
        setSlashMenuAnchor({ top: coords.bottom + 8, left: coords.left });
      } else if (event.key === 'Escape') {
        setSlashMenuAnchor(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor]);

  const executeSlashCommand = (cmd: SlashCommandItem) => {
    if (!editor) return;
    const { from } = editor.state.selection;
    editor.commands.deleteRange({ from: Math.max(0, from - 1), to: from });
    cmd.action(editor);
    setSlashMenuAnchor(null);
  };

  if (!editor) {
    return null;
  }

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      {/* Top Comprehensive Sticky/Header Toolbar */}
      <Paper
        elevation={0}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          p: '6px 10px',
          mb: 2,
          borderRadius: '10px',
          background: theme.palette.mode === 'dark' ? 'rgba(20, 29, 50, 0.85)' : 'rgba(248, 250, 252, 0.95)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${theme.palette.divider}`,
          gap: 0.5,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Left Side: Standard Formatting Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, flexWrap: 'wrap' }}>
          <Tooltip title="Undo">
            <span>
              <IconButton
                size="small"
                disabled={!editable || !editor.can().undo()}
                onClick={() => editor.chain().focus().undo().run()}
              >
                <Undo fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo">
            <span>
              <IconButton
                size="small"
                disabled={!editable || !editor.can().redo()}
                onClick={() => editor.chain().focus().redo().run()}
              >
                <Redo fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 20, alignSelf: 'center' }} />

          <Tooltip title="Bold (Ctrl+B)">
            <IconButton
              size="small"
              disabled={!editable}
              color={editor.isActive('bold') ? 'primary' : 'default'}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <FormatBold fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Italic (Ctrl+I)">
            <IconButton
              size="small"
              disabled={!editable}
              color={editor.isActive('italic') ? 'primary' : 'default'}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <FormatItalic fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Inline Code">
            <IconButton
              size="small"
              disabled={!editable}
              color={editor.isActive('code') ? 'primary' : 'default'}
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <Code fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 20, alignSelf: 'center' }} />

          <Tooltip title="Heading 1">
            <IconButton
              size="small"
              disabled={!editable}
              color={editor.isActive('heading', { level: 1 }) ? 'primary' : 'default'}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <Title fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Heading 2">
            <IconButton
              size="small"
              disabled={!editable}
              color={editor.isActive('heading', { level: 2 }) ? 'primary' : 'default'}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Title fontSize="small" style={{ transform: 'scale(0.85)' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Bullet List">
            <IconButton
              size="small"
              disabled={!editable}
              color={editor.isActive('bulletList') ? 'primary' : 'default'}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <FormatListBulleted fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Numbered List">
            <IconButton
              size="small"
              disabled={!editable}
              color={editor.isActive('orderedList') ? 'primary' : 'default'}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <FormatListNumbered fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Task Checklist">
            <IconButton
              size="small"
              disabled={!editable}
              color={editor.isActive('taskList') ? 'primary' : 'default'}
              onClick={() => editor.chain().focus().toggleTaskList().run()}
            >
              <CheckBoxOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Blockquote">
            <IconButton
              size="small"
              disabled={!editable}
              color={editor.isActive('blockquote') ? 'primary' : 'default'}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <FormatQuote fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Table">
            <IconButton
              size="small"
              disabled={!editable}
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            >
              <TableChart fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Callout Box">
            <IconButton
              size="small"
              disabled={!editable}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .insertContent(
                    '<div class="nexus-callout"><div class="nexus-callout-icon">💡</div><div class="nexus-callout-content"><p><strong>Note:</strong> Insert your note here.</p></div></div>'
                  )
                  .run()
              }
            >
              <Lightbulb fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Right Side: Voice Dictation & AI Assistant Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Voice Dictation Button */}
          <Tooltip
            title={
              !isSpeechSupported
                ? 'Speech recognition requires Chrome, Edge, or Safari'
                : isListening
                ? 'Listening... Click to stop dictation'
                : 'Start Voice Dictation (Speech to Text)'
            }
          >
            <span>
              <Button
                size="small"
                variant={isListening ? 'contained' : 'outlined'}
                color={isListening ? 'error' : 'inherit'}
                className={isListening ? 'mic-listening' : ''}
                disabled={!isSpeechSupported}
                onClick={() => {
                  if (!editable) {
                    onRequireAuth?.();
                    return;
                  }
                  toggleListening();
                }}
                startIcon={
                  isListening ? (
                    <Mic sx={{ color: '#ffffff' }} />
                  ) : !isSpeechSupported ? (
                    <MicOff fontSize="small" />
                  ) : (
                    <Mic sx={{ color: theme.palette.error.main }} />
                  )
                }
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  borderRadius: '8px',
                  px: 1.4,
                  py: 0.4,
                  border: isListening ? 'none' : `1px solid ${theme.palette.divider}`,
                  transition: 'all 0.2s ease',
                }}
              >
                {isListening ? 'Listening...' : 'Voice Dictate'}
              </Button>
            </span>
          </Tooltip>

          {/* AI Assistant Button */}
          <Button
            size="small"
            variant="contained"
            onClick={(e) => {
              if (!editable) {
                onRequireAuth?.();
                return;
              }
              setAiMenuAnchor(e.currentTarget);
            }}
            startIcon={
              isAiProcessing ? (
                <CircularProgress size={16} sx={{ color: '#ffffff' }} />
              ) : (
                <AutoAwesome fontSize="small" />
              )
            }
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              borderRadius: '8px',
              px: 1.6,
              py: 0.4,
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              color: '#ffffff',
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)',
              '&:hover': {
                background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
              },
            }}
          >
            {isAiProcessing ? 'Thinking...' : 'AI Assistant'}
          </Button>

          {/* AI Assistant Dropdown Menu */}
          <Menu
            anchorEl={aiMenuAnchor}
            open={Boolean(aiMenuAnchor)}
            onClose={() => setAiMenuAnchor(null)}
            PaperProps={{
              sx: {
                width: 250,
                borderRadius: '12px',
                backgroundColor: theme.palette.mode === 'dark' ? '#141d32' : '#ffffff',
                boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                border: `1px solid ${theme.palette.divider}`,
                py: 0.5,
              },
            }}
          >
            <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                AI Note Superpowers
              </Typography>
            </Box>

            <MenuItem onClick={() => handleRunAiAction('summarize')} sx={{ py: 1, px: 2 }}>
              <ListItemIcon sx={{ color: '#6366f1', minWidth: 32 }}>
                <AutoAwesome fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>Summarize Note</Typography>}
                secondary={<Typography variant="caption" sx={{ color: 'text.secondary' }}>Executive summary & bullets</Typography>}
              />
            </MenuItem>

            <MenuItem onClick={() => handleRunAiAction('polish')} sx={{ py: 1, px: 2 }}>
              <ListItemIcon sx={{ color: '#a855f7', minWidth: 32 }}>
                <AutoAwesome fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>Fix Grammar & Polish</Typography>}
                secondary={<Typography variant="caption" sx={{ color: 'text.secondary' }}>Correct typos, flow & structure</Typography>}
              />
            </MenuItem>

            <MenuItem onClick={() => handleRunAiAction('tasks')} sx={{ py: 1, px: 2 }}>
              <ListItemIcon sx={{ color: '#10b981', minWidth: 32 }}>
                <Checklist fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>Action Checklist</Typography>}
                secondary={<Typography variant="caption" sx={{ color: 'text.secondary' }}>Extract actionable checkboxes</Typography>}
              />
            </MenuItem>

            <MenuItem onClick={() => handleRunAiAction('takeaways')} sx={{ py: 1, px: 2 }}>
              <ListItemIcon sx={{ color: '#f59e0b', minWidth: 32 }}>
                <ElectricBolt fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>Key Takeaways</Typography>}
                secondary={<Typography variant="caption" sx={{ color: 'text.secondary' }}>Highlight key points banner</Typography>}
              />
            </MenuItem>

            <Divider sx={{ my: 0.5 }} />

            <MenuItem
              onClick={() => {
                setAiMenuAnchor(null);
                setAiSettingsOpen(true);
              }}
              sx={{ py: 0.8, px: 2 }}
            >
              <ListItemIcon sx={{ color: 'text.secondary', minWidth: 32 }}>
                <Settings fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={<Typography variant="body2" sx={{ color: 'text.secondary' }}>AI Settings (Gemini Key)</Typography>}
              />
            </MenuItem>
          </Menu>
        </Box>
      </Paper>

      {/* Voice Dictation Real-Time Speech Banner */}
      {isListening && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: '8px 14px',
            mb: 2,
            borderRadius: '8px',
            background: theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(254, 242, 242, 0.95)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: theme.palette.mode === 'dark' ? '#fca5a5' : '#b91c1c',
          }}
        >
          <Mic className="mic-listening" sx={{ fontSize: 18, borderRadius: '50%' }} />
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem', flex: 1 }}>
            {interimTranscript ? `"${interimTranscript}..."` : '🎙️ Dictating... Speak into your mic. Say "period", "comma", or "new line" for punctuation.'}
          </Typography>
          <Button
            size="small"
            variant="text"
            color="error"
            onClick={stopListening}
            sx={{ textTransform: 'none', py: 0, minWidth: 'auto', fontSize: '0.75rem', fontWeight: 700 }}
          >
            Done
          </Button>
        </Box>
      )}

      {/* Floating Selection Bubble Menu */}
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
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Tooltip title="AI Polish Selection">
              <IconButton
                size="small"
                sx={{ color: '#a855f7' }}
                onClick={() => handleRunAiAction('polish')}
              >
                <AutoAwesome fontSize="small" />
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
        open={Boolean(slashMenuAnchor)}
        onClose={() => setSlashMenuAnchor(null)}
        anchorReference="anchorPosition"
        anchorPosition={slashMenuAnchor ? { top: slashMenuAnchor.top, left: slashMenuAnchor.left } : undefined}
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
            Insert Block or Superpower
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

      {/* AI Result Preview Modal */}
      <Dialog
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#ffffff',
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            {aiResultTitle}
          </Typography>
          <IconButton size="small" onClick={handleCopyAiResult}>
            {copiedNotification ? <Check color="success" fontSize="small" /> : <ContentCopy fontSize="small" />}
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor: theme.palette.divider }}>
          <Box
            sx={{
              p: 2,
              borderRadius: '8px',
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              fontSize: '0.95rem',
              lineHeight: 1.6,
            }}
            dangerouslySetInnerHTML={{ __html: aiResultContent }}
          />
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={() => setAiModalOpen(false)} color="inherit" sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            onClick={handleAppendAiResult}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Append to Bottom
          </Button>
          <Button
            variant="outlined"
            onClick={handleReplaceWithAiResult}
            color="warning"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Replace Note
          </Button>
          <Button
            variant="contained"
            onClick={handleInsertAiResultAtCursor}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            }}
          >
            Insert at Cursor
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI Assistant Settings Dialog */}
      <Dialog
        open={aiSettingsOpen}
        onClose={() => setAiSettingsOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#ffffff',
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Settings fontSize="small" color="primary" /> AI Assistant Settings
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Nexus Notes operates with <strong>instant offline local NLP heuristics</strong> by default (100% free, zero cost).
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Optionally, paste your <strong>Google Gemini API Key</strong> below to unlock ultra-advanced Google 1.5 Flash generative polish and intelligence.
          </Typography>
          <TextField
            fullWidth
            size="small"
            type="password"
            label="Google Gemini API Key (Optional)"
            placeholder="AIzaSy..."
            value={geminiApiKeyInput}
            onChange={(e) => setGeminiApiKeyInput(e.target.value)}
            helperText="Stored locally in your browser's private vault."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAiSettingsOpen(false)} color="inherit" sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveGeminiKey}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>

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

      {/* Notifications Snackbar */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" onClose={() => setToastMessage(null)} sx={{ width: '100%', borderRadius: '8px' }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};
