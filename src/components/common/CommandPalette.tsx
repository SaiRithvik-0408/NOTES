import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Chip,
  InputAdornment,
  useTheme,
} from '@mui/material';
import {
  Search,
  AddCircleOutline,
  FolderOpen,
  DarkModeOutlined,
  LightModeOutlined,
  Sync,
  HubOutlined,
  ChatBubbleOutline,
  ShareOutlined,
  SettingsOutlined,
  DescriptionOutlined,
  KeyboardCommandKey,
} from '@mui/icons-material';
import { Note } from '../../types/note';

export interface CommandItem {
  id: string;
  title: string;
  category: 'General' | 'Notes' | 'Navigation' | 'Sync';
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  notes: Note[];
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onToggleTheme: () => void;
  onToggleGraph: () => void;
  onTriggerSync: () => void;
}

export const CommandPalette = ({
  open,
  onClose,
  notes,
  onSelectNote,
  onCreateNote,
  onToggleTheme,
  onToggleGraph,
  onTriggerSync,
}: CommandPaletteProps): React.ReactElement => {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Base system commands
  const defaultCommands: CommandItem[] = [
    {
      id: 'cmd-create-note',
      title: 'Create New Note',
      category: 'Notes',
      icon: <AddCircleOutline fontSize="small" sx={{ color: '#6366F1' }} />,
      shortcut: 'Ctrl+N',
      action: () => {
        onCreateNote();
        onClose();
      },
    },
    {
      id: 'cmd-toggle-graph',
      title: 'Toggle 3D Knowledge Graph',
      category: 'Navigation',
      icon: <HubOutlined fontSize="small" sx={{ color: '#A855F7' }} />,
      shortcut: 'Ctrl+G',
      action: () => {
        onToggleGraph();
        onClose();
      },
    },
    {
      id: 'cmd-sync-now',
      title: 'Force Synchronize Mutations',
      category: 'Sync',
      icon: <Sync fontSize="small" sx={{ color: '#10B981' }} />,
      shortcut: 'Ctrl+S',
      action: () => {
        onTriggerSync();
        onClose();
      },
    },
    {
      id: 'cmd-toggle-theme',
      title: theme.palette.mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      category: 'General',
      icon: theme.palette.mode === 'dark' ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />,
      shortcut: 'Ctrl+Shift+L',
      action: () => {
        onToggleTheme();
        onClose();
      },
    },
  ];

  // Dynamically map notes to command items
  const noteCommands: CommandItem[] = useMemo(() => {
    return notes.slice(0, 8).map((note: Note) => ({
      id: `note-${note.id}`,
      title: `Open Note: ${note.title}`,
      category: 'Notes',
      icon: <DescriptionOutlined fontSize="small" sx={{ color: '#818CF8' }} />,
      action: () => {
        onSelectNote(note.id);
        onClose();
      },
    }));
  }, [notes, onSelectNote, onClose]);

  const allCommands = useMemo(() => [...defaultCommands, ...noteCommands], [defaultCommands, noteCommands]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase();
    return allCommands.filter(
      (c) => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  }, [allCommands, query]);

  // Handle keyboard navigation
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: theme.palette.mode === 'dark' ? '#0F1626' : '#FFFFFF',
          backgroundImage: 'none',
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
          top: -80,
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Search Input Bar */}
        <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', alignItems: 'center' }}>
          <TextField
            fullWidth
            autoFocus
            variant="standard"
            placeholder="Type a command or search notes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            InputProps={{
              disableUnderline: true,
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'primary.main', mr: 1 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Chip
                    label="ESC"
                    size="small"
                    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, borderRadius: '4px' }}
                  />
                </InputAdornment>
              ),
              sx: { fontSize: '1.05rem', fontWeight: 500 },
            }}
          />
        </Box>

        {/* Command List */}
        <List sx={{ maxHeight: 380, overflowY: 'auto', p: 1 }}>
          {filteredCommands.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No commands matching "{query}"
              </Typography>
            </Box>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <ListItemButton
                  key={cmd.id}
                  selected={isSelected}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  sx={{
                    borderRadius: '8px',
                    mb: 0.5,
                    px: 1.5,
                    py: 1,
                    backgroundColor: isSelected
                      ? theme.palette.mode === 'dark'
                        ? 'rgba(99, 102, 241, 0.18)'
                        : 'rgba(79, 70, 229, 0.1)'
                      : 'transparent',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>{cmd.icon}</ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {cmd.title}
                      </Typography>
                    }
                  />
                  {cmd.shortcut && (
                    <Chip
                      label={cmd.shortcut}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 20, borderRadius: '4px', opacity: 0.8 }}
                    />
                  )}
                </ListItemButton>
              );
            })
          )}
        </List>

        {/* Footer Hint */}
        <Box
          sx={{
            py: 1,
            px: 2,
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
            borderTop: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <KeyboardCommandKey fontSize="inherit" /> Navigate with <kbd>↑</kbd> <kbd>↓</kbd> • Select with <kbd>↵</kbd>
          </Typography>
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
            Nexus Notes
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
