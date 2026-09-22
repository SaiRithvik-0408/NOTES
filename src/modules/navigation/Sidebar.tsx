import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
  Chip,
  Tooltip,
  useTheme,
  Avatar,
  Badge,
} from '@mui/material';
import {
  Add,
  Search,
  FolderOutlined,
  FolderOpenOutlined,
  DescriptionOutlined,
  PushPinOutlined,
  StarOutline,
  ArchiveOutlined,
  HubOutlined,
  BrushOutlined,
  DarkModeOutlined,
  LightModeOutlined,
  ExpandMore,
  ExpandLess,
  ChevronRight,
  FiberManualRecord,
  KeyboardCommandKey,
  PersonAddOutlined,
} from '@mui/icons-material';
import { Note, Folder, Workspace, Tag } from '../../types/note';
import { SyncStatus } from '../../types/sync';
import { SyncStatusIndicator } from '../../components/common/SyncStatusIndicator';
import { useAuth } from '../auth/AuthContext';

interface SidebarProps {
  currentWorkspace: Workspace;
  folders: Folder[];
  notes: Note[];
  tags: Tag[];
  selectedNoteId: string | null;
  activeView: 'editor' | 'graph' | 'whiteboard';
  syncStatus: SyncStatus;
  isSimulatedOffline: boolean;
  onSelectNote: (noteId: string) => void;
  onCreateNote: (folderId?: string) => void;
  onSelectView: (view: 'editor' | 'graph' | 'whiteboard') => void;
  onToggleTheme: () => void;
  onToggleSimulatedOffline: () => void;
  onForceSync: () => void;
  onOpenCommandPalette: () => void;
  onOpenAuthModal: () => void;
  onOpenShareModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentWorkspace,
  folders,
  notes,
  tags,
  selectedNoteId,
  activeView,
  syncStatus,
  isSimulatedOffline,
  onSelectNote,
  onCreateNote,
  onSelectView,
  onToggleTheme,
  onToggleSimulatedOffline,
  onForceSync,
  onOpenCommandPalette,
  onOpenAuthModal,
  onOpenShareModal,
}) => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    'folder-product': true,
    'folder-engineering': true,
    'folder-designs': true,
  });

  const toggleFolder = (folderId: string) => {
    setOpenFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const filteredNotes = notes.filter((n) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.plainText.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const pinnedNotes = filteredNotes.filter((n) => n.isPinned);

  return (
    <Box
      sx={{
        width: 280,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.mode === 'dark' ? '#090D16' : '#F8FAFC',
        borderRight: `1px solid ${theme.palette.divider}`,
        userSelect: 'none',
      }}
    >
      {/* Workspace Header */}
      <Box sx={{ p: 2, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="Nexus Notes Logo"
            sx={{ width: 32, height: 32, borderRadius: '8px' }}
          />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              Nexus Notes
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', display: 'block' }}>
              {currentWorkspace.name}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Invite People / Share Workspace">
            <IconButton size="small" onClick={onOpenShareModal} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '6px' }}>
              <PersonAddOutlined fontSize="small" sx={{ color: 'primary.main' }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Command Palette (Ctrl+K)">
            <IconButton size="small" onClick={onOpenCommandPalette} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '6px' }}>
              <KeyboardCommandKey fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Sync Status Banner */}
      <Box sx={{ px: 2, py: 1 }}>
        <SyncStatusIndicator
          status={syncStatus}
          onForceSync={onForceSync}
          onToggleSimulatedOffline={onToggleSimulatedOffline}
          isSimulatedOffline={isSimulatedOffline}
        />
      </Box>

      {/* Search Input Box */}
      <Box sx={{ px: 2, py: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search notes or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
            sx: {
              borderRadius: '8px',
              fontSize: '0.82rem',
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
            },
          }}
        />
      </Box>

      {/* Quick Action Buttons */}
      <Box sx={{ px: 2, py: 1, display: 'flex', gap: 1 }}>
        <Button
          fullWidth
          variant="contained"
          size="small"
          startIcon={<Add />}
          onClick={() => onCreateNote()}
          sx={{
            borderRadius: '8px',
            py: 0.8,
            fontSize: '0.78rem',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          }}
        >
          New Note
        </Button>
      </Box>

      {/* Navigation Links: Editor, 3D Graph, Whiteboard */}
      <List sx={{ px: 1, py: 0.5 }}>
        <ListItemButton
          selected={activeView === 'editor'}
          onClick={() => onSelectView('editor')}
          sx={{ py: 0.6, px: 1.2, borderRadius: '8px', mb: 0.3 }}
        >
          <ListItemIcon sx={{ minWidth: 30, color: 'primary.main' }}>
            <DescriptionOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>Notes Editor</Typography>} />
        </ListItemButton>

        <ListItemButton
          selected={activeView === 'graph'}
          onClick={() => onSelectView('graph')}
          sx={{ py: 0.6, px: 1.2, borderRadius: '8px', mb: 0.3 }}
        >
          <ListItemIcon sx={{ minWidth: 30, color: '#A855F7' }}>
            <HubOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>3D Knowledge Graph</Typography>} />
          <Chip label="3D" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(168, 85, 247, 0.2)', color: '#C084FC' }} />
        </ListItemButton>

        <ListItemButton
          selected={activeView === 'whiteboard'}
          onClick={() => onSelectView('whiteboard')}
          sx={{ py: 0.6, px: 1.2, borderRadius: '8px', mb: 0.3 }}
        >
          <ListItemIcon sx={{ minWidth: 30, color: '#EC4899' }}>
            <BrushOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>Visual Whiteboard</Typography>} />
        </ListItemButton>
      </List>

      <Divider sx={{ my: 1, mx: 2 }} />

      {/* Scrollable Tree Area */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
        {/* Pinned Notes */}
        {pinnedNotes.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ px: 1.2, color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pinned
            </Typography>
            <List dense sx={{ p: 0, mt: 0.5 }}>
              {pinnedNotes.map((note) => (
                <ListItemButton
                  key={note.id}
                  selected={selectedNoteId === note.id && activeView === 'editor'}
                  onClick={() => {
                    onSelectView('editor');
                    onSelectNote(note.id);
                  }}
                  sx={{ py: 0.5, px: 1.2, borderRadius: '6px' }}
                >
                  <ListItemIcon sx={{ minWidth: 24, fontSize: '0.9rem' }}>
                    {note.icon || '📌'}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" noWrap sx={{ fontSize: '0.82rem', fontWeight: selectedNoteId === note.id ? 600 : 400 }}>
                        {note.title}
                      </Typography>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>
        )}

        {/* Folders & Notes Hierarchy */}
        <Typography variant="caption" sx={{ px: 1.2, color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Folders & Documents
        </Typography>

        <List dense sx={{ p: 0, mt: 0.5 }}>
          {folders.map((folder) => {
            const folderNotes = filteredNotes.filter((n) => n.folderId === folder.id);
            const isOpen = openFolders[folder.id] ?? true;

            return (
              <Box key={folder.id} sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => toggleFolder(folder.id)}
                  sx={{ py: 0.4, px: 1, borderRadius: '6px' }}
                >
                  <ListItemIcon sx={{ minWidth: 22, color: 'text.secondary' }}>
                    {isOpen ? <ExpandMore sx={{ fontSize: 16 }} /> : <ChevronRight sx={{ fontSize: 16 }} />}
                  </ListItemIcon>
                  <ListItemIcon sx={{ minWidth: 24, fontSize: '0.9rem' }}>
                    {folder.icon || '📁'}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" noWrap sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        {folder.name}
                      </Typography>
                    }
                  />
                  <Typography variant="caption" sx={{ color: 'text.muted', mr: 0.5 }}>
                    {folderNotes.length}
                  </Typography>
                  <Tooltip title="Add Note in Folder">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateNote(folder.id);
                      }}
                      sx={{ p: 0.2, opacity: 0.7, '&:hover': { opacity: 1 } }}
                    >
                      <Add sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </ListItemButton>

                {/* Nested Notes */}
                <Collapse in={isOpen} timeout="auto" unmountOnExit>
                  <List dense sx={{ p: 0, pl: 3.5 }}>
                    {folderNotes.map((note) => (
                      <ListItemButton
                        key={note.id}
                        selected={selectedNoteId === note.id && activeView === 'editor'}
                        onClick={() => {
                          onSelectView('editor');
                          onSelectNote(note.id);
                        }}
                        sx={{ py: 0.4, px: 1, borderRadius: '6px', mb: 0.2 }}
                      >
                        <ListItemIcon sx={{ minWidth: 22, fontSize: '0.85rem' }}>
                          {note.icon || '📄'}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem', fontWeight: selectedNoteId === note.id ? 600 : 400 }}>
                              {note.title}
                            </Typography>
                          }
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </Box>
            );
          })}
        </List>
      </Box>

      {/* Footer Profile & Theme Toggle */}
      <Box
        sx={{
          p: 1.5,
          borderTop: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box
          onClick={onOpenAuthModal}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            p: 0.5,
            borderRadius: '8px',
            transition: 'background 0.15s ease',
            '&:hover': {
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
            },
          }}
        >
          <Avatar
            src={currentUser?.avatarUrl}
            sx={{ width: 28, height: 28, bgcolor: currentUser?.color || 'primary.main', fontSize: '0.75rem' }}
          >
            {currentUser?.name ? currentUser.name[0] : 'U'}
          </Avatar>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.1 }}>
              {currentUser?.name || 'Sign In'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', display: 'block' }}>
              {currentUser?.username ? `@${currentUser.username}` : (currentUser?.email || 'Click to Login')}
            </Typography>
          </Box>
        </Box>

        <Tooltip title={theme.palette.mode === 'dark' ? 'Switch to Light' : 'Switch to Dark'}>
          <IconButton size="small" onClick={onToggleTheme}>
            {theme.palette.mode === 'dark' ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};
