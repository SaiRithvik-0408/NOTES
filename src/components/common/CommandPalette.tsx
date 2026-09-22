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
  PictureAsPdfOutlined,
  FileDownloadOutlined,
  FileUploadOutlined,
  SportsEsportsOutlined,
  LockOutlined,
} from '@mui/icons-material';
import { Note } from '../../types/note';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'General' | 'Notes' | 'Navigation' | 'Sync' | 'Actions';
  icon: React.ReactNode;
  shortcut?: string;
  badge?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  notes: Note[];
  currentNote?: Note | null;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onToggleTheme: () => void;
  onToggleGraph: () => void;
  onTriggerSync: () => void;
  onExportMarkdown?: () => void;
  onExportPdf?: () => void;
  onImportMarkdown?: () => void;
  onLockCurrentNote?: () => void;
}

function stripHtml(html: string): string {
  return html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

export const CommandPalette = ({
  open,
  onClose,
  notes,
  currentNote,
  onSelectNote,
  onCreateNote,
  onToggleTheme,
  onToggleGraph,
  onTriggerSync,
  onExportMarkdown,
  onExportPdf,
  onImportMarkdown,
  onLockCurrentNote,
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
      id: 'cmd-import-note',
      title: 'Import Markdown Note (.md)',
      category: 'Actions',
      icon: <FileUploadOutlined fontSize="small" sx={{ color: '#10B981' }} />,
      action: () => {
        onImportMarkdown?.();
        onClose();
      },
    },
    ...(currentNote
      ? [
          {
            id: 'cmd-export-pdf',
            title: `Export "${currentNote.title}" as PDF`,
            category: 'Actions' as const,
            icon: <PictureAsPdfOutlined fontSize="small" sx={{ color: '#EF4444' }} />,
            action: () => {
              onExportPdf?.();
              onClose();
            },
          },
          {
            id: 'cmd-export-md',
            title: `Export "${currentNote.title}" as Markdown (.md)`,
            category: 'Actions' as const,
            icon: <FileDownloadOutlined fontSize="small" sx={{ color: '#06B6D4' }} />,
            action: () => {
              onExportMarkdown?.();
              onClose();
            },
          },
          {
            id: 'cmd-lock-note',
            title: currentNote.isLocked ? `Security & Password for "${currentNote.title}"` : `Encrypt & Lock "${currentNote.title}"`,
            category: 'Actions' as const,
            icon: <LockOutlined fontSize="small" sx={{ color: '#F59E0B' }} />,
            action: () => {
              onLockCurrentNote?.();
              onClose();
            },
          },
        ]
      : []),
    {
      id: 'cmd-toggle-graph',
      title: 'Open 3D Knowledge Graph',
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

  // Full-Text Search across ALL Notes (Titles AND Content)
  const noteCommands: CommandItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();

    return notes
      .map((note: Note) => {
        const titleMatch = note.title.toLowerCase().includes(q);

        if (note.isLocked) {
          if (q && !titleMatch) {
            return null;
          }
          return {
            id: `note-${note.id}`,
            title: note.title || 'Untitled Note',
            subtitle: '🔒 Encrypted Private Vault Note',
            category: 'Notes' as const,
            badge: 'Encrypted',
            icon: <LockOutlined fontSize="small" sx={{ color: '#F59E0B' }} />,
            action: () => {
              onSelectNote(note.id);
              onClose();
            },
          };
        }

        const plainContent = stripHtml(note.content || '');
        const contentIdx = q ? plainContent.toLowerCase().indexOf(q) : -1;
        const contentMatch = contentIdx !== -1;

        if (q && !titleMatch && !contentMatch) {
          return null; // Exclude non-matching notes when querying
        }

        let snippet: string | undefined;
        let badge: string | undefined;

        if (q) {
          if (titleMatch && contentMatch) {
            badge = 'Title & Content';
          } else if (titleMatch) {
            badge = 'Title';
          } else {
            badge = 'Content Match';
          }

          if (contentMatch) {
            const start = Math.max(0, contentIdx - 28);
            const end = Math.min(plainContent.length, contentIdx + q.length + 42);
            snippet = `${start > 0 ? '...' : ''}${plainContent.slice(start, end)}${end < plainContent.length ? '...' : ''}`;
          }
        }

        return {
          id: `note-${note.id}`,
          title: note.title || 'Untitled Note',
          subtitle: snippet || plainContent.slice(0, 60),
          category: 'Notes' as const,
          badge,
          icon: <DescriptionOutlined fontSize="small" sx={{ color: '#818CF8' }} />,
          action: () => {
            onSelectNote(note.id);
            onClose();
          },
        };
      })
      .filter(Boolean) as CommandItem[];
  }, [notes, query, onSelectNote, onClose]);

  const allCommands = useMemo(() => {
    if (!query.trim()) {
      return [...defaultCommands, ...noteCommands.slice(0, 8)];
    }
    return [...noteCommands, ...defaultCommands];
  }, [defaultCommands, noteCommands, query]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase();
    return allCommands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(q))
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {cmd.title}
                        </Typography>
                        {cmd.badge && (
                          <Chip
                            label={cmd.badge}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              bgcolor: cmd.badge.includes('Content')
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'rgba(99, 102, 241, 0.15)',
                              color: cmd.badge.includes('Content') ? '#10B981' : '#818CF8',
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      cmd.subtitle ? (
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {cmd.subtitle}
                        </Typography>
                      ) : undefined
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
