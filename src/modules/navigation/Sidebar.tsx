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
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
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
  CreateNewFolderOutlined,
  DeleteOutline,
  DriveFileRenameOutline,
  MoreVert,
  LockOutlined,
  SportsEsportsOutlined,
  InstallMobile,
} from '@mui/icons-material';
import { Note, Folder, Workspace, Tag } from '../../types/note';
import { SyncStatus } from '../../types/sync';
import { SyncStatusIndicator } from '../../components/common/SyncStatusIndicator';
import { useAuth } from '../auth/AuthContext';
import { usePwaInstall } from '../../utils/pwaInstall';


interface SidebarProps {
  currentWorkspace: Workspace;
  folders: Folder[];
  notes: Note[];
  tags: Tag[];
  selectedNoteId: string | null;
  activeView: 'editor' | 'graph' | 'whiteboard' | 'games';
  syncStatus: SyncStatus;
  isSimulatedOffline: boolean;
  onSelectNote: (noteId: string) => void;
  onCreateNote: (folderId?: string) => void;
  onSelectView: (view: 'editor' | 'graph' | 'whiteboard' | 'games') => void;
  onToggleTheme: () => void;
  onToggleSimulatedOffline: () => void;
  onForceSync: () => void;
  onOpenCommandPalette: () => void;
  onOpenAuthModal: () => void;
  onOpenShareModal: () => void;
  onCreateFolder?: (name: string, icon?: string) => void;
  onRenameFolder?: (folderId: string, newName: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onDeleteNote?: (noteId: string) => void;
  isReadOnly?: boolean;
  onRequireAuth?: () => void;
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
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDeleteNote,
  isReadOnly = false,
  onRequireAuth,
}) => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    'folder-sample': true,
  });

  // PWA Install Hook & Dialog
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();
  const [installDialogOpen, setInstallDialogOpen] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await promptInstall();
      if (!accepted) setInstallDialogOpen(true);
    } else {
      setInstallDialogOpen(true);
    }
  };

  // Folder Dialog & Menu States
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState<Folder | null>(null);
  const [renameName, setRenameName] = useState('');
  const [folderMenuAnchor, setFolderMenuAnchor] = useState<{ el: HTMLElement; folder: Folder } | null>(null);

  const toggleFolder = (folderId: string) => {
    setOpenFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleConfirmCreateFolder = () => {
    if (!newFolderName.trim()) return;
    onCreateFolder?.(newFolderName.trim(), '📁');
    setNewFolderName('');
    setNewFolderDialogOpen(false);
  };

  const handleConfirmRenameFolder = () => {
    if (!renameTarget || !renameName.trim()) return;
    onRenameFolder?.(renameTarget.id, renameName.trim());
    setRenameTarget(null);
    setRenameName('');
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
  const uncategorizedNotes = filteredNotes.filter(
    (n) => !n.folderId || !folders.some((f) => f.id === n.folderId)
  );

  return (
    <Box
      sx={{
        width: 280,
        height: '100%',
        bgcolor: theme.palette.mode === 'dark' ? '#070A12' : '#F8FAFC',
        borderRight: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* Workspace Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="Nexus Logo"
            sx={{ width: 28, height: 28, borderRadius: '6px' }}
          />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              Nexus Notes
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              {currentWorkspace.name}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Share Workspace">
            <IconButton size="small" onClick={onOpenShareModal}>
              <PersonAddOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Quick Search (Ctrl+K)">
            <IconButton size="small" onClick={onOpenCommandPalette}>
              <KeyboardCommandKey fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Sync Status Pill Indicator */}
      <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SyncStatusIndicator
          status={syncStatus}
          onForceSync={onForceSync}
          onToggleSimulatedOffline={onToggleSimulatedOffline}
          isSimulatedOffline={isSimulatedOffline}
        />
        <Tooltip title={isSimulatedOffline ? 'Simulated Offline Mode' : 'Connected to Local-First Sync Engine'}>
          <FiberManualRecord sx={{ fontSize: 10, color: isSimulatedOffline ? 'warning.main' : 'success.main' }} />
        </Tooltip>
      </Box>

      {/* Search Bar */}
      <Box sx={{ px: 2, py: 0.5 }}>
        <TextField
          size="small"
          placeholder="Search notes or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 16, color: 'text.secondary' }} />
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

      {/* Quick Action Button */}
      <Box sx={{ px: 2, py: 1, display: 'flex', gap: 1 }}>
        <Button
          fullWidth
          variant="contained"
          size="small"
          startIcon={isReadOnly ? <LockOutlined sx={{ fontSize: 16 }} /> : <Add />}
          onClick={() => {
            if (isReadOnly) {
              onRequireAuth?.();
            } else {
              onCreateNote();
            }
          }}
          sx={{
            borderRadius: '8px',
            py: 0.8,
            fontSize: '0.78rem',
            background: isReadOnly
              ? 'linear-gradient(135deg, #475569, #334155)'
              : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          }}
        >
          {isReadOnly ? 'Sign in to Create' : 'New Note'}
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

        <ListItemButton
          selected={activeView === 'games'}
          onClick={() => onSelectView('games')}
          sx={{ py: 0.6, px: 1.2, borderRadius: '8px', mb: 0.3 }}
        >
          <ListItemIcon sx={{ minWidth: 30, color: '#10B981' }}>
            <SportsEsportsOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>Games & Chess</Typography>} />
          <Chip label="3D" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(16, 185, 129, 0.2)', color: '#34D399', fontWeight: 700 }} />
        </ListItemButton>

        {/* PWA Install Button */}
        {!isInstalled && (
          <ListItemButton
            onClick={handleInstallClick}
            sx={{
              py: 0.6,
              px: 1.2,
              borderRadius: '8px',
              mb: 0.3,
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.12) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              '&:hover': {
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(168, 85, 247, 0.22) 100%)',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 30, color: '#818CF8' }}>
              <InstallMobile fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
                  Install App
                </Typography>
              }
            />
            <Chip
              label="PWA"
              size="small"
              sx={{
                height: 18,
                fontSize: '0.62rem',
                fontWeight: 700,
                bgcolor: 'rgba(99, 102, 241, 0.2)',
                color: '#818CF8',
              }}
            />
          </ListItemButton>
        )}
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
                  sx={{
                    py: 0.4,
                    px: 1,
                    borderRadius: '6px',
                    mb: 0.2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    '&:hover .delete-btn': { opacity: 1 },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                    <ListItemIcon sx={{ minWidth: 20, fontSize: '0.85rem' }}>
                      {note.icon || '📌'}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem', fontWeight: selectedNoteId === note.id ? 600 : 400 }}>
                          {note.title}
                        </Typography>
                      }
                    />
                  </Box>
                  <Tooltip title="Delete note">
                    <IconButton
                      size="small"
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isReadOnly) {
                          onRequireAuth?.();
                        } else if (window.confirm(`Delete "${note.title}"?`)) {
                          onDeleteNote?.(note.id);
                        }
                      }}
                      sx={{ p: 0.2, opacity: 0, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                    >
                      <DeleteOutline sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </ListItemButton>
              ))}
            </List>
          </Box>
        )}

        {/* Folders & Notes Hierarchy Header */}
        <Box sx={{ px: 1.2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Folders & Documents
          </Typography>
          <Tooltip title="Create New Folder">
            <IconButton
              size="small"
              onClick={() => {
                if (isReadOnly) {
                  onRequireAuth?.();
                } else {
                  setNewFolderName('');
                  setNewFolderDialogOpen(true);
                }
              }}
              sx={{ p: 0.3, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              <CreateNewFolderOutlined sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Folder List */}
        <List dense sx={{ p: 0 }}>
          {folders.map((folder) => {
            const folderNotes = filteredNotes.filter((n) => n.folderId === folder.id);
            const isOpen = openFolders[folder.id] ?? true;

            return (
              <Box key={folder.id} sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => toggleFolder(folder.id)}
                  sx={{
                    py: 0.4,
                    px: 1,
                    borderRadius: '6px',
                    '&:hover .folder-actions': { opacity: 1 },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 20, color: 'text.secondary' }}>
                    {isOpen ? <ExpandMore sx={{ fontSize: 16 }} /> : <ChevronRight sx={{ fontSize: 16 }} />}
                  </ListItemIcon>
                  <ListItemIcon sx={{ minWidth: 22, fontSize: '0.9rem' }}>
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

                  <Box className="folder-actions" sx={{ display: 'flex', alignItems: 'center', opacity: 0.7 }}>
                    <Tooltip title="Add Note in Folder">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isReadOnly) {
                            onRequireAuth?.();
                          } else {
                            onCreateNote(folder.id);
                          }
                        }}
                        sx={{ p: 0.2, '&:hover': { color: 'primary.main' } }}
                      >
                        <Add sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Folder Options">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFolderMenuAnchor({ el: e.currentTarget, folder });
                        }}
                        sx={{ p: 0.2, '&:hover': { color: 'primary.main' } }}
                      >
                        <MoreVert sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
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
                        sx={{
                          py: 0.35,
                          px: 1,
                          borderRadius: '6px',
                          mb: 0.2,
                          display: 'flex',
                          justifyContent: 'space-between',
                          '&:hover .delete-btn': { opacity: 1 },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                          <ListItemIcon sx={{ minWidth: 20, fontSize: '0.85rem' }}>
                            {note.icon || '📄'}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem', fontWeight: selectedNoteId === note.id ? 600 : 400 }}>
                                {note.title}
                              </Typography>
                            }
                          />
                        </Box>
                        <Tooltip title="Delete note">
                          <IconButton
                            size="small"
                            className="delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isReadOnly) {
                                onRequireAuth?.();
                              } else if (window.confirm(`Delete note "${note.title}"?`)) {
                                onDeleteNote?.(note.id);
                              }
                            }}
                            sx={{ p: 0.2, opacity: 0, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                          >
                            <DeleteOutline sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </Box>
            );
          })}
        </List>

        {/* Uncategorized / Root Notes if any */}
        {uncategorizedNotes.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" sx={{ px: 1.2, color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Other Notes
            </Typography>
            <List dense sx={{ p: 0, mt: 0.5 }}>
              {uncategorizedNotes.map((note) => (
                <ListItemButton
                  key={note.id}
                  selected={selectedNoteId === note.id && activeView === 'editor'}
                  onClick={() => {
                    onSelectView('editor');
                    onSelectNote(note.id);
                  }}
                  sx={{
                    py: 0.35,
                    px: 1,
                    borderRadius: '6px',
                    mb: 0.2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    '&:hover .delete-btn': { opacity: 1 },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                    <ListItemIcon sx={{ minWidth: 20, fontSize: '0.85rem' }}>
                      {note.icon || '📄'}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem', fontWeight: selectedNoteId === note.id ? 600 : 400 }}>
                          {note.title}
                        </Typography>
                      }
                    />
                  </Box>
                  <Tooltip title="Delete note">
                    <IconButton
                      size="small"
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isReadOnly) {
                          onRequireAuth?.();
                        } else if (window.confirm(`Delete note "${note.title}"?`)) {
                          onDeleteNote?.(note.id);
                        }
                      }}
                      sx={{ p: 0.2, opacity: 0, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                    >
                      <DeleteOutline sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                </ListItemButton>
              ))}
            </List>
          </Box>
        )}
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
            {currentUser?.name ? currentUser.name[0] : 'G'}
          </Avatar>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.1 }}>
              {currentUser?.name || 'Guest Mode'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', display: 'block' }}>
              {currentUser?.username ? `@${currentUser.username}` : (currentUser?.email || 'Click to Sign In')}
            </Typography>
          </Box>
        </Box>

        <Tooltip title={theme.palette.mode === 'dark' ? 'Switch to Light' : 'Switch to Dark'}>
          <IconButton size="small" onClick={onToggleTheme}>
            {theme.palette.mode === 'dark' ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Dialog: Create Folder */}
      <Dialog
        open={newFolderDialogOpen}
        onClose={() => setNewFolderDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '14px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 1 }}>Create New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Folder Name"
            placeholder="e.g. Work, Research, Brainstorming"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmCreateFolder();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNewFolderDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmCreateFolder}
            disabled={!newFolderName.trim()}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Rename Folder */}
      <Dialog
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '14px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 1 }}>Rename Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Folder Name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmRenameFolder();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRenameTarget(null)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmRenameFolder}
            disabled={!renameName.trim()}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: PWA Installation Guide */}
      <Dialog
        open={installDialogOpen}
        onClose={() => setInstallDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            p: 1,
            backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#ffffff',
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <InstallMobile color="primary" /> Install Nexus Notes App
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Enjoy Nexus Notes as a <strong>native, fast, offline-capable application</strong> on your desktop or mobile device.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: '10px' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                📱 Mobile (iOS / Safari)
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Tap the <strong>Share</strong> button at the bottom of Safari, scroll down, and select <strong>&quot;Add to Home Screen&quot;</strong>.
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: '10px' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                💻 Desktop (Chrome, Edge & Brave)
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Click the <strong>Install icon (⊕)</strong> on the right side of the address bar, or click browser menu (⋮) &gt; <strong>&quot;Install Nexus Notes&quot;</strong>.
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: '10px' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                🤖 Mobile (Android / Chrome)
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Tap the top menu (⋮) and select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.
              </Typography>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            onClick={() => setInstallDialogOpen(false)}
            sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 700 }}
          >
            Got It
          </Button>
        </DialogActions>
      </Dialog>

      {/* Folder Action Context Menu */}
      <Menu
        anchorEl={folderMenuAnchor?.el}
        open={Boolean(folderMenuAnchor)}
        onClose={() => setFolderMenuAnchor(null)}
        PaperProps={{ sx: { borderRadius: '10px', minWidth: 160 } }}
      >
        <MenuItem
          onClick={() => {
            const folder = folderMenuAnchor?.folder;
            setFolderMenuAnchor(null);
            if (folder) {
              if (isReadOnly) onRequireAuth?.();
              else onCreateNote(folder.id);
            }
          }}
          sx={{ fontSize: '0.82rem', gap: 1 }}
        >
          <Add sx={{ fontSize: 16 }} />
          Add Note in Folder
        </MenuItem>
        <MenuItem
          onClick={() => {
            const folder = folderMenuAnchor?.folder;
            setFolderMenuAnchor(null);
            if (folder) {
              if (isReadOnly) {
                onRequireAuth?.();
              } else {
                setRenameTarget(folder);
                setRenameName(folder.name);
              }
            }
          }}
          sx={{ fontSize: '0.82rem', gap: 1 }}
        >
          <DriveFileRenameOutline sx={{ fontSize: 16 }} />
          Rename Folder
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          onClick={() => {
            const folder = folderMenuAnchor?.folder;
            setFolderMenuAnchor(null);
            if (folder) {
              if (isReadOnly) {
                onRequireAuth?.();
              } else if (window.confirm(`Delete folder "${folder.name}"? Notes inside will be preserved in Other Notes.`)) {
                onDeleteFolder?.(folder.id);
              }
            }
          }}
          sx={{ fontSize: '0.82rem', gap: 1, color: 'error.main' }}
        >
          <DeleteOutline sx={{ fontSize: 16 }} />
          Delete Folder
        </MenuItem>
      </Menu>
    </Box>
  );
};
