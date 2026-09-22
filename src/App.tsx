import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ThemeProvider,
  CssBaseline,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  Tooltip,
  Drawer,
  useMediaQuery,
  Breadcrumbs,
  Link,
  Chip,
  Paper,
  Divider,
  Alert,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close,
  PushPin,
  PushPinOutlined,
  Star,
  StarOutline,
  ShareOutlined,
  MoreVert,
  AutoAwesome,
  KeyboardCommandKey,
  FolderOpen,
  HubOutlined,
  BrushOutlined,
  DescriptionOutlined,
  Visibility,
  LockOutlined,
  PersonAddOutlined,
} from '@mui/icons-material';
import confetti from 'canvas-confetti';
import { v4 as uuidv4 } from 'uuid';

import { createAppTheme } from './theme/theme';
import { db, seedInitialLocalData } from './modules/storage/db';
import { Note, Folder, Workspace, Tag, NoteRevision, NoteComment, NoteAttachment, WorkspaceMember, WorkspaceRole } from './types/note';
import { SyncStatus, ConflictRecord } from './types/sync';
import { mutationQueue } from './modules/sync/MutationQueue';
import { localSyncProvider } from './modules/sync/LocalSyncProvider';
import { ConflictResolver } from './modules/sync/ConflictResolver';

import { Sidebar } from './modules/navigation/Sidebar';
import { TipTapEditor } from './modules/editor/TipTapEditor';
import { KnowledgeGraph } from './modules/graph/KnowledgeGraph';
import { Whiteboard } from './modules/whiteboard/Whiteboard';
import { InspectorPanel } from './modules/inspector/InspectorPanel';
import { CommandPalette } from './components/common/CommandPalette';
import { ConflictDialog } from './components/common/ConflictDialog';
import { SyncStatusIndicator } from './components/common/SyncStatusIndicator';
import { useAuth } from './modules/auth/AuthContext';
import { AuthModal } from './modules/auth/AuthModal';
import { ShareModal } from './modules/share/ShareModal';

export const App: React.FC = () => {
  const { currentUser } = useAuth();

  // Theme mode: light or dark
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('nexus_theme') as 'dark' | 'light') || 'dark';
  });

  const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Application Data States
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Inspector & Panels States
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState<'editor' | 'graph' | 'whiteboard'>('editor');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Sharing & Membership State
  const [members, setMembers] = useState<WorkspaceMember[]>([
    {
      userId: 'user-alex',
      workspaceId: 'ws-default-nexus',
      role: 'owner',
      joinedAt: new Date().toISOString(),
      user: { id: 'user-alex', name: 'Alex Rivera', email: 'alex@nexus.internal', color: '#6366F1' },
    },
    {
      userId: 'user-elena',
      workspaceId: 'ws-default-nexus',
      role: 'editor',
      joinedAt: new Date().toISOString(),
      user: { id: 'user-elena', name: 'Elena Rostova', email: 'elena@nexus.internal', color: '#EC4899' },
    },
    {
      userId: 'user-marcus',
      workspaceId: 'ws-default-nexus',
      role: 'viewer',
      joinedAt: new Date().toISOString(),
      user: { id: 'user-marcus', name: 'Marcus Chen', email: 'marcus@partner.org', color: '#10B981' },
    },
  ]);

  // URL Shared Link detection
  const [sharedAccessLevel, setSharedAccessLevel] = useState<'view' | 'edit' | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return (params.get('access') as 'view' | 'edit') || null;
    }
    return null;
  });

  // Calculate if active viewer has read-only access
  const isReadOnly = useMemo(() => {
    if (sharedAccessLevel === 'view') return true;
    if (currentUser?.id === 'user-marcus') return true;
    return false;
  }, [sharedAccessLevel, currentUser]);

  // Sync & Conflict States
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(mutationQueue.getStatus());
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [activeConflict, setActiveConflict] = useState<ConflictRecord | null>(null);

  // Note-scoped subdata
  const [comments, setComments] = useState<NoteComment[]>([]);
  const [revisions, setRevisions] = useState<NoteRevision[]>([]);
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);

  // Initialize Local Database and Providers
  useEffect(() => {
    async function init() {
      await seedInitialLocalData();
      await localSyncProvider.initialize();

      const ws = await db.workspaces.toArray();
      const flds = await db.folders.orderBy('order').toArray();
      const nts = await db.notes.toArray();
      const tgs = await db.tags.toArray();

      setWorkspaces(ws);
      setFolders(flds);
      setNotes(nts);
      setTags(tgs);

      if (nts.length > 0 && !selectedNoteId) {
        setSelectedNoteId(nts[0].id);
      }
    }
    init();

    // Subscribe to mutation queue status
    const unsub = mutationQueue.subscribeStatus((status) => {
      setSyncStatus(status);
    });

    // Check for any unresolved conflicts
    ConflictResolver.getUnresolvedConflicts().then((conflicts) => {
      if (conflicts.length > 0) {
        setActiveConflict(conflicts[0]);
      }
    });

    return () => {
      unsub();
      localSyncProvider.destroy();
    };
  }, []);

  // Load Note Specific Details (Comments, Revisions, Attachments)
  useEffect(() => {
    if (!selectedNoteId) return;

    async function loadNoteDetails() {
      const cmts = await db.comments.where('noteId').equals(selectedNoteId!).toArray();
      const revs = await db.revisions.where('noteId').equals(selectedNoteId!).reverse().toArray();
      const atts = await db.attachments.where('noteId').equals(selectedNoteId!).toArray();

      setComments(cmts);
      setRevisions(revs);
      setAttachments(atts);
    }
    loadNoteDetails();
  }, [selectedNoteId]);

  // Active Selected Note
  const currentNote = useMemo(() => {
    return notes.find((n) => n.id === selectedNoteId) || notes[0] || null;
  }, [notes, selectedNoteId]);

  const currentFolder = useMemo(() => {
    if (!currentNote?.folderId) return undefined;
    return folders.find((f) => f.id === currentNote.folderId);
  }, [currentNote, folders]);

  const currentWorkspace = useMemo(() => {
    return (
      workspaces[0] || {
        id: 'ws-default',
        name: 'Nexus Workspace',
        slug: 'nexus',
        ownerId: 'user-self',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }, [workspaces]);

  // Centralized Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K: Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      // Ctrl+N: Create Note
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (!isReadOnly) handleCreateNote();
      }
      // Ctrl+G: Toggle 3D Knowledge Graph
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setActiveView((prev) => (prev === 'graph' ? 'editor' : 'graph'));
      }
      // Ctrl+S: Force sync
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleForceSync();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentNote, isReadOnly]);

  // Note CRUD Actions
  const handleCreateNote = async (folderId?: string) => {
    if (isReadOnly) return;
    const newId = `note-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    const newNote: Note = {
      id: newId,
      workspaceId: currentWorkspace.id,
      folderId: folderId || folders[0]?.id || null,
      title: 'Untitled Note',
      icon: '📝',
      content: '<p></p>',
      plainText: '',
      tags: [],
      authorId: currentUser?.id || 'user-self',
      authorName: currentUser?.name || 'Alex Rivera',
      isPinned: false,
      isFavorite: false,
      isArchived: false,
      backlinks: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await db.notes.add(newNote);
    await mutationQueue.enqueue('note', newId, 'create', newNote, 1);

    setNotes((prev) => [newNote, ...prev]);
    setSelectedNoteId(newId);
    setActiveView('editor');
  };

  const handleUpdateNoteContent = useCallback(
    async (html: string, plainText: string) => {
      if (!currentNote || isReadOnly) return;

      const now = new Date().toISOString();
      const updatedNote: Note = {
        ...currentNote,
        content: html,
        plainText,
        updatedAt: now,
        version: currentNote.version + 1,
      };

      // Optimistic in-memory update
      setNotes((prev) => prev.map((n) => (n.id === currentNote.id ? updatedNote : n)));

      // Save locally to IndexedDB
      await db.notes.put(updatedNote);

      // Enqueue in mutation queue
      await mutationQueue.enqueue('note', updatedNote.id, 'update', updatedNote, currentNote.version);
    },
    [currentNote, isReadOnly]
  );

  const handleUpdateTitle = async (newTitle: string) => {
    if (!currentNote || isReadOnly) return;
    const now = new Date().toISOString();
    const updated = { ...currentNote, title: newTitle || 'Untitled Note', updatedAt: now };

    setNotes((prev) => prev.map((n) => (n.id === currentNote.id ? updated : n)));
    await db.notes.put(updated);
    await mutationQueue.enqueue('note', updated.id, 'patch', { title: updated.title }, currentNote.version);
  };

  const handleTogglePin = async () => {
    if (!currentNote || isReadOnly) return;
    const updated = { ...currentNote, isPinned: !currentNote.isPinned, updatedAt: new Date().toISOString() };
    setNotes((prev) => prev.map((n) => (n.id === currentNote.id ? updated : n)));
    await db.notes.put(updated);
    await mutationQueue.enqueue('note', updated.id, 'patch', { isPinned: updated.isPinned });
  };

  const handleToggleSimulatedOffline = () => {
    const nextState = !isSimulatedOffline;
    setIsSimulatedOffline(nextState);
    mutationQueue.setOnlineSimulated(!nextState);
  };

  const handleForceSync = async () => {
    await mutationQueue.flushQueue();
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.1 } });
  };

  const handleResolveConflict = async (conflictId: string, strategy: 'keep_local' | 'keep_remote' | 'merged') => {
    await ConflictResolver.resolveNoteConflict(conflictId, strategy);
    setActiveConflict(null);
    confetti({ particleCount: 50, spread: 70, origin: { y: 0.2 } });

    // Refresh notes
    const nts = await db.notes.toArray();
    setNotes(nts);
  };

  const handleToggleTheme = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    localStorage.setItem('nexus_theme', next);
  };

  // Member Management Handlers
  const handleInviteMember = (email: string, role: WorkspaceRole) => {
    const newMember: WorkspaceMember = {
      userId: `user-${uuidv4().slice(0, 8)}`,
      workspaceId: currentWorkspace.id,
      role,
      joinedAt: new Date().toISOString(),
      user: {
        id: `user-${uuidv4().slice(0, 8)}`,
        name: email.split('@')[0],
        email,
        color: '#10B981',
      },
    };
    setMembers((prev) => [...prev, newMember]);
  };

  const handleUpdateMemberRole = (userId: string, newRole: WorkspaceRole) => {
    setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)));
  };

  const handleRemoveMember = (userId: string) => {
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  // Comment Handlers
  const handleAddComment = async (comment: NoteComment) => {
    await db.comments.add(comment);
    await mutationQueue.enqueue('comment', comment.id, 'create', comment);
    setComments((prev) => [comment, ...prev]);
  };

  const handleResolveComment = async (commentId: string, resolved: boolean) => {
    const now = new Date().toISOString();
    await db.comments.update(commentId, { resolved, resolvedAt: resolved ? now : undefined });
    await mutationQueue.enqueue('comment', commentId, 'patch', { resolved });
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, resolved } : c)));
  };

  const handleAddReply = async (commentId: string, reply: any) => {
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;
    const updatedReplies = [...(comment.replies || []), reply];
    await db.comments.update(commentId, { replies: updatedReplies });
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, replies: updatedReplies } : c)));
  };

  const handleRestoreRevision = async (rev: NoteRevision) => {
    if (!currentNote || isReadOnly) return;
    const updated: Note = {
      ...currentNote,
      title: rev.title,
      content: rev.content,
      updatedAt: new Date().toISOString(),
      version: currentNote.version + 1,
    };
    await db.notes.put(updated);
    setNotes((prev) => prev.map((n) => (n.id === currentNote.id ? updated : n)));
    confetti({ particleCount: 40, spread: 60 });
  };

  const handleUploadAttachment = async (file: File) => {
    if (!currentNote || isReadOnly) return;
    const newAtt: NoteAttachment = {
      id: `att-${uuidv4()}`,
      noteId: currentNote.id,
      name: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      localBlob: file,
      uploadStatus: isSimulatedOffline ? 'pending' : 'uploaded',
      createdAt: new Date().toISOString(),
    };
    await db.attachments.add(newAtt);
    await mutationQueue.enqueue('attachment', newAtt.id, 'create', { ...newAtt, localBlob: undefined });
    setAttachments((prev) => [newAtt, ...prev]);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        {/* Desktop Sidebar */}
        {!isMobile && (
          <Sidebar
            currentWorkspace={currentWorkspace}
            folders={folders}
            notes={notes}
            tags={tags}
            selectedNoteId={selectedNoteId}
            activeView={activeView}
            syncStatus={syncStatus}
            isSimulatedOffline={isSimulatedOffline}
            onSelectNote={(id) => {
              setSelectedNoteId(id);
              setActiveView('editor');
            }}
            onCreateNote={handleCreateNote}
            onSelectView={setActiveView}
            onToggleTheme={handleToggleTheme}
            onToggleSimulatedOffline={handleToggleSimulatedOffline}
            onForceSync={handleForceSync}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenAuthModal={() => setAuthModalOpen(true)}
            onOpenShareModal={() => setShareModalOpen(true)}
          />
        )}

        {/* Mobile Drawer */}
        {isMobile && (
          <Drawer
            open={mobileDrawerOpen}
            onClose={() => setMobileDrawerOpen(false)}
            ModalProps={{ keepMounted: true }}
            PaperProps={{ sx: { width: 280 } }}
          >
            <Sidebar
              currentWorkspace={currentWorkspace}
              folders={folders}
              notes={notes}
              tags={tags}
              selectedNoteId={selectedNoteId}
              activeView={activeView}
              syncStatus={syncStatus}
              isSimulatedOffline={isSimulatedOffline}
              onSelectNote={(id) => {
                setSelectedNoteId(id);
                setActiveView('editor');
                setMobileDrawerOpen(false);
              }}
              onCreateNote={(fId) => {
                handleCreateNote(fId);
                setMobileDrawerOpen(false);
              }}
              onSelectView={(v) => {
                setActiveView(v);
                setMobileDrawerOpen(false);
              }}
              onToggleTheme={handleToggleTheme}
              onToggleSimulatedOffline={handleToggleSimulatedOffline}
              onForceSync={handleForceSync}
              onOpenCommandPalette={() => {
                setMobileDrawerOpen(false);
                setCommandPaletteOpen(true);
              }}
              onOpenAuthModal={() => {
                setMobileDrawerOpen(false);
                setAuthModalOpen(true);
              }}
              onOpenShareModal={() => {
                setMobileDrawerOpen(false);
                setShareModalOpen(true);
              }}
            />
          </Drawer>
        )}

        {/* Center Main Stage */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Top Navigation Bar */}
          <Box
            sx={{
              height: 56,
              px: 2,
              borderBottom: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: theme.palette.mode === 'dark' ? '#090D16' : '#FFFFFF',
              zIndex: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {isMobile && (
                <IconButton size="small" onClick={() => setMobileDrawerOpen(true)}>
                  <MenuIcon />
                </IconButton>
              )}

              {/* Breadcrumb Path */}
              <Breadcrumbs separator="›" sx={{ fontSize: '0.85rem' }}>
                <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }} onClick={() => setActiveView('editor')}>
                  {currentWorkspace.name}
                </Link>
                {currentFolder && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    {currentFolder.name}
                  </Typography>
                )}
                {activeView === 'editor' && currentNote && (
                  <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 700 }}>
                    {currentNote.title}
                  </Typography>
                )}
                {activeView === 'graph' && (
                  <Typography variant="caption" sx={{ color: '#A855F7', fontWeight: 700 }}>
                    3D Knowledge Graph
                  </Typography>
                )}
                {activeView === 'whiteboard' && (
                  <Typography variant="caption" sx={{ color: '#EC4899', fontWeight: 700 }}>
                    Visual Canvas
                  </Typography>
                )}
              </Breadcrumbs>
            </Box>

            {/* Right Action Icons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isReadOnly && (
                <Chip
                  icon={<Visibility sx={{ fontSize: 14 }} />}
                  label="View Only"
                  size="small"
                  color="warning"
                  sx={{ height: 24, fontSize: '0.72rem', fontWeight: 700 }}
                />
              )}

              <SyncStatusIndicator
                status={syncStatus}
                onForceSync={handleForceSync}
                onToggleSimulatedOffline={handleToggleSimulatedOffline}
                isSimulatedOffline={isSimulatedOffline}
              />

              {/* Share Note Button */}
              <Button
                variant="contained"
                size="small"
                startIcon={<ShareOutlined sx={{ fontSize: 16 }} />}
                onClick={() => setShareModalOpen(true)}
                sx={{
                  height: 28,
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  px: 1.5,
                }}
              >
                Share
              </Button>

              {activeView === 'editor' && currentNote && (
                <>
                  <Tooltip title={currentNote.isPinned ? 'Unpin note' : 'Pin note'}>
                    <IconButton
                      size="small"
                      onClick={handleTogglePin}
                      disabled={isReadOnly}
                      color={currentNote.isPinned ? 'primary' : 'default'}
                    >
                      {currentNote.isPinned ? <PushPin fontSize="small" /> : <PushPinOutlined fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Toggle Inspector Panel">
                    <IconButton size="small" onClick={() => setInspectorOpen((prev) => !prev)}>
                      <MoreVert fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>
          </Box>

          {/* Read-Only Mode Banner if active */}
          {isReadOnly && (
            <Alert
              severity="info"
              icon={<Visibility fontSize="inherit" />}
              sx={{
                py: 0.5,
                px: 2,
                borderRadius: 0,
                fontSize: '0.8rem',
                borderBottom: `1px solid ${theme.palette.divider}`,
              }}
            >
              You are currently viewing this document with <strong>Read-Only</strong> permissions. Switch to an Editor account or request Edit access to collaborate.
            </Alert>
          )}

          {/* Main Stage Content */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 4 }, bgcolor: theme.palette.background.default }}>
            {activeView === 'editor' && currentNote && (
              <Box sx={{ maxWidth: 840, mx: 'auto' }}>
                {/* Note Icon & Title Header */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h3" sx={{ mb: 1 }}>
                    {currentNote.icon || '📝'}
                  </Typography>
                  <TextField
                    fullWidth
                    variant="standard"
                    value={currentNote.title}
                    onChange={(e) => handleUpdateTitle(e.target.value)}
                    placeholder="Untitled Note"
                    disabled={isReadOnly}
                    InputProps={{
                      disableUnderline: true,
                      sx: {
                        fontFamily: theme.typography.h2.fontFamily,
                        fontSize: { xs: '1.8rem', md: '2.4rem' },
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        color: 'text.primary',
                        opacity: isReadOnly ? 0.85 : 1,
                      },
                    }}
                  />

                  {/* Metadata Chips: Tags & Last Edited */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                    <Chip
                      icon={<FolderOpen sx={{ fontSize: 14 }} />}
                      label={currentFolder ? currentFolder.name : 'Workspace'}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.72rem', height: 22 }}
                    />
                    {currentNote.tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={`#${tag}`}
                        size="small"
                        sx={{ fontSize: '0.72rem', height: 22, bgcolor: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}
                      />
                    ))}
                    <Typography variant="caption" sx={{ color: 'text.muted', ml: 'auto' }}>
                      Edited {new Date(currentNote.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Rich Text Editor */}
                <TipTapEditor
                  initialContent={currentNote.content}
                  onChange={handleUpdateNoteContent}
                  editable={!isReadOnly}
                  onNavigateBacklink={(title) => {
                    const match = notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
                    if (match) setSelectedNoteId(match.id);
                  }}
                />
              </Box>
            )}

            {/* 3D Knowledge Graph View */}
            {activeView === 'graph' && (
              <Box sx={{ width: '100%', height: 'calc(100vh - 120px)' }}>
                <KnowledgeGraph
                  notes={notes}
                  folders={folders}
                  tags={tags}
                  onSelectNote={(noteId) => {
                    setSelectedNoteId(noteId);
                    setActiveView('editor');
                  }}
                />
              </Box>
            )}

            {/* Whiteboard / Visual Canvas View */}
            {activeView === 'whiteboard' && (
              <Box sx={{ width: '100%', height: 'calc(100vh - 120px)' }}>
                <Whiteboard noteId={currentNote?.id} />
              </Box>
            )}
          </Box>
        </Box>

        {/* Right Inspector Panel (Desktop) */}
        {!isMobile && inspectorOpen && activeView === 'editor' && currentNote && (
          <InspectorPanel
            note={currentNote}
            folder={currentFolder}
            allNotes={notes}
            comments={comments}
            revisions={revisions}
            attachments={attachments}
            onClose={() => setInspectorOpen(false)}
            onNavigateNote={(id) => setSelectedNoteId(id)}
            onAddComment={handleAddComment}
            onResolveComment={handleResolveComment}
            onAddReply={handleAddReply}
            onRestoreRevision={handleRestoreRevision}
            onUploadAttachment={handleUploadAttachment}
          />
        )}
      </Box>

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        notes={notes}
        onSelectNote={(id) => {
          setSelectedNoteId(id);
          setActiveView('editor');
        }}
        onCreateNote={handleCreateNote}
        onToggleTheme={handleToggleTheme}
        onToggleGraph={() => setActiveView((v) => (v === 'graph' ? 'editor' : 'graph'))}
        onTriggerSync={handleForceSync}
      />

      {/* Conflict Resolution Dialog */}
      <ConflictDialog
        conflict={activeConflict}
        onResolve={handleResolveConflict}
        onClose={() => setActiveConflict(null)}
      />

      {/* Authentication Modal */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Share & Invite Modal */}
      <ShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        note={currentNote}
        workspace={currentWorkspace}
        members={members}
        onInviteMember={handleInviteMember}
        onUpdateMemberRole={handleUpdateMemberRole}
        onRemoveMember={handleRemoveMember}
      />
    </ThemeProvider>
  );
};

export default App;
