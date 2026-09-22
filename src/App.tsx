import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  ArrowBack,
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
import { AuthScreen } from './modules/auth/AuthScreen';
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
  // Read initial route from URL parameters
  const initialRoute = useMemo(() => {
    if (typeof window === 'undefined') return { view: 'editor' as const, noteId: null as string | null };
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const noteParam = params.get('note');
    const view: 'editor' | 'graph' | 'whiteboard' =
      viewParam === 'graph' || viewParam === 'whiteboard' ? viewParam : 'editor';
    return { view, noteId: noteParam };
  }, []);

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(initialRoute.noteId);
  const [activeView, setActiveView] = useState<'editor' | 'graph' | 'whiteboard'>(initialRoute.view);

  // Inspector & Panels States
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Active modal ref for back gesture interception
  const activeModalRef = useRef<string | null>(null);

  const openModal = useCallback((name: 'drawer' | 'palette' | 'auth' | 'share') => {
    activeModalRef.current = name;
    if (name === 'drawer') setMobileDrawerOpen(true);
    if (name === 'palette') setCommandPaletteOpen(true);
    if (name === 'auth') setAuthModalOpen(true);
    if (name === 'share') setShareModalOpen(true);

    if (typeof window !== 'undefined') {
      window.history.pushState({ ...window.history.state, modal: name }, '');
    }
  }, []);

  const closeModal = useCallback((name: 'drawer' | 'palette' | 'auth' | 'share') => {
    if (name === 'drawer') setMobileDrawerOpen(false);
    if (name === 'palette') setCommandPaletteOpen(false);
    if (name === 'auth') setAuthModalOpen(false);
    if (name === 'share') setShareModalOpen(false);

    if (activeModalRef.current === name) {
      activeModalRef.current = null;
      if (typeof window !== 'undefined' && window.history.state?.modal === name) {
        window.history.back();
      }
    }
  }, []);

  // History routing function
  const navigateTo = useCallback(
    (newView: 'editor' | 'graph' | 'whiteboard', noteId?: string | null, replace = false) => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      if (newView !== 'editor') {
        params.set('view', newView);
      } else {
        params.delete('view');
      }

      const targetNoteId = noteId !== undefined ? noteId : selectedNoteId;
      if (targetNoteId) {
        params.set('note', targetNoteId);
      }

      const queryString = params.toString();
      const newUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;
      const stateObj = { view: newView, noteId: targetNoteId };

      if (replace) {
        window.history.replaceState(stateObj, '', newUrl);
      } else {
        const currentSearch = window.location.search;
        const targetSearch = queryString ? `?${queryString}` : '';
        if (currentSearch !== targetSearch || activeView !== newView) {
          window.history.pushState(stateObj, '', newUrl);
        }
      }

      setActiveView(newView);
      if (targetNoteId) {
        setSelectedNoteId(targetNoteId);
      }
    },
    [activeView, selectedNoteId]
  );

  // Popstate Listener for Browser Back/Forward & Mobile Swipe Gestures
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // 1. If any modal is currently open, dismiss it!
      if (activeModalRef.current) {
        const modal = activeModalRef.current;
        activeModalRef.current = null;
        if (modal === 'drawer') setMobileDrawerOpen(false);
        if (modal === 'palette') setCommandPaletteOpen(false);
        if (modal === 'auth') setAuthModalOpen(false);
        if (modal === 'share') setShareModalOpen(false);
        return;
      }

      // 2. Otherwise restore view and note from state or URL
      const params = new URLSearchParams(window.location.search);
      const urlView = e.state?.view || params.get('view');
      const urlNote = e.state?.noteId || params.get('note');

      const targetView = (urlView === 'graph' || urlView === 'whiteboard') ? urlView : 'editor';
      setActiveView(targetView);

      if (urlNote) {
        setSelectedNoteId(urlNote);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sharing & Membership State from actual current user
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  useEffect(() => {
    if (currentUser) {
      setMembers([
        {
          userId: currentUser.id,
          workspaceId: 'ws-default-nexus',
          role: 'owner',
          joinedAt: new Date().toISOString(),
          user: currentUser,
        },
      ]);
    }
  }, [currentUser]);

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
    return false;
  }, [sharedAccessLevel]);

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

      if (nts.length > 0) {
        const matched = initialRoute.noteId ? nts.find((n) => n.id === initialRoute.noteId) : null;
        const initialNote = matched ? matched.id : nts[0].id;
        setSelectedNoteId(initialNote);
        navigateTo(initialRoute.view, initialNote, true);
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
      authorName: currentUser?.name || 'Workspace Author',
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
    navigateTo('editor', newId);
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
      {!currentUser ? (
        <AuthScreen />
      ) : (
        <>
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
              navigateTo('editor', id);
            }}
            onCreateNote={handleCreateNote}
            onSelectView={(v) => {
              navigateTo(v, selectedNoteId);
            }}
            onToggleTheme={handleToggleTheme}
            onToggleSimulatedOffline={handleToggleSimulatedOffline}
            onForceSync={handleForceSync}
            onOpenCommandPalette={() => openModal('palette')}
            onOpenAuthModal={() => openModal('auth')}
            onOpenShareModal={() => openModal('share')}
          />
        )}

        {/* Mobile Drawer */}
        {isMobile && (
          <Drawer
            open={mobileDrawerOpen}
            onClose={() => closeModal('drawer')}
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
                closeModal('drawer');
                navigateTo('editor', id);
              }}
              onCreateNote={(fId) => {
                closeModal('drawer');
                handleCreateNote(fId);
              }}
              onSelectView={(v) => {
                closeModal('drawer');
                navigateTo(v, selectedNoteId);
              }}
              onToggleTheme={handleToggleTheme}
              onToggleSimulatedOffline={handleToggleSimulatedOffline}
              onForceSync={handleForceSync}
              onOpenCommandPalette={() => {
                closeModal('drawer');
                openModal('palette');
              }}
              onOpenAuthModal={() => {
                closeModal('drawer');
                openModal('auth');
              }}
              onOpenShareModal={() => {
                closeModal('drawer');
                openModal('share');
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
                <IconButton size="small" onClick={() => openModal('drawer')}>
                  <MenuIcon />
                </IconButton>
              )}

              {/* Back Navigation / Gesture Button */}
              {(activeView !== 'editor' || isMobile) && (
                <Tooltip title="Go Back">
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (window.history.length > 1) {
                        window.history.back();
                      } else {
                        navigateTo('editor', selectedNoteId);
                      }
                    }}
                    sx={{ color: 'text.secondary' }}
                  >
                    <ArrowBack sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}

              {/* Breadcrumb Path */}
              <Breadcrumbs separator="›" sx={{ fontSize: '0.85rem' }}>
                <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }} onClick={() => navigateTo('editor', selectedNoteId)}>
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
                    if (match) navigateTo('editor', match.id);
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
                    navigateTo('editor', noteId);
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
            onNavigateNote={(id) => navigateTo('editor', id)}
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
        onClose={() => closeModal('palette')}
        notes={notes}
        onSelectNote={(id) => {
          closeModal('palette');
          navigateTo('editor', id);
        }}
        onCreateNote={() => {
          closeModal('palette');
          handleCreateNote();
        }}
        onToggleTheme={handleToggleTheme}
        onToggleGraph={() => navigateTo(activeView === 'graph' ? 'editor' : 'graph', selectedNoteId)}
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
        onClose={() => closeModal('auth')}
      />

      {/* Share & Invite Modal */}
      <ShareModal
        open={shareModalOpen}
        onClose={() => closeModal('share')}
        note={currentNote}
        workspace={currentWorkspace}
        members={members}
        onInviteMember={handleInviteMember}
        onUpdateMemberRole={handleUpdateMemberRole}
        onRemoveMember={handleRemoveMember}
      />
      </>
    )}
  </ThemeProvider>
);
};

export default App;
