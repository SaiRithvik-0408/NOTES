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
  Menu,
  MenuItem,
  Avatar,
  Badge,
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
  Visibility,
  LockOutlined,
  LockOpenOutlined,
  Security,
  GraphicEqOutlined,
  PersonAddOutlined,
  ArrowBack,
  CreateNewFolderOutlined,
  DeleteOutline,
  FileDownloadOutlined,
  FileUploadOutlined,
  PictureAsPdfOutlined,
  CloudOff,
} from '@mui/icons-material';
import confetti from 'canvas-confetti';
import { v4 as uuidv4 } from 'uuid';
import { exportNoteToMarkdown, exportNoteToPdf, parseMarkdownFile } from './utils/exportImport';
import { usePwaInstall } from './utils/pwaInstall';
import { createNoteSnapshot } from './utils/revisionManager';
import { useNotePresence } from './utils/presenceManager';
import { encryptNoteContent } from './utils/cryptoVault';
import { NoteVaultLockScreen } from './components/vault/NoteVaultLockScreen';
import { LockNoteDialog } from './components/vault/LockNoteDialog';
import { VoiceMemoRecorderDialog, VoiceMemosShelf } from './components/audio/VoiceMemoHub';



import { createAppTheme } from './theme/theme';
import { db, seedInitialLocalData } from './modules/storage/db';
import { Note, Folder, Workspace, Tag, NoteRevision, NoteComment, NoteAttachment, WorkspaceMember, WorkspaceRole, AudioMemo } from './types/note';
import { SyncStatus, ConflictRecord } from './types/sync';
import { mutationQueue } from './modules/sync/MutationQueue';
import { localSyncProvider } from './modules/sync/LocalSyncProvider';
import { ConflictResolver } from './modules/sync/ConflictResolver';

import { Sidebar } from './modules/navigation/Sidebar';
import { TipTapEditor } from './modules/editor/TipTapEditor';
import { KnowledgeGraph } from './modules/graph/KnowledgeGraph';
import { Whiteboard } from './modules/whiteboard/Whiteboard';
import { GamesHub } from './modules/games/GamesHub';
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
    const view: 'editor' | 'graph' | 'whiteboard' | 'games' =
      viewParam === 'graph' || viewParam === 'whiteboard' || viewParam === 'games' ? viewParam : 'editor';
    return { view, noteId: noteParam };
  }, []);

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(initialRoute.noteId);
  const [activeView, setActiveView] = useState<'editor' | 'graph' | 'whiteboard' | 'games'>(initialRoute.view);

  // Inspector & Panels States
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    (newView: 'editor' | 'graph' | 'whiteboard' | 'games', noteId?: string | null, replace = false) => {
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

      const targetView = (urlView === 'graph' || urlView === 'whiteboard' || urlView === 'games') ? urlView : 'editor';
      setActiveView(targetView);

      if (urlNote) {
        setSelectedNoteId(urlNote);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // URL Shared Link detection
  const [sharedAccessLevel, setSharedAccessLevel] = useState<'view' | 'edit' | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return (params.get('access') as 'view' | 'edit') || null;
    }
    return null;
  });

  // Calculate if active viewer has read-only access (unauthenticated guests or shared view links)
  const isReadOnly = useMemo(() => {
    if (!currentUser) return true;
    if (sharedAccessLevel === 'view') return true;
    return false;
  }, [currentUser, sharedAccessLevel]);

  // Sync & Conflict States
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(mutationQueue.getStatus());
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [activeConflict, setActiveConflict] = useState<ConflictRecord | null>(null);

  // Native PWA Install & Online Status
  const { isOnline } = usePwaInstall();

  // Real-time Collaborator Presence
  const { activePeers, broadcastEditing } = useNotePresence(selectedNoteId, currentUser);

  // End-to-End Encrypted Vault Notes
  const [unlockedVaults, setUnlockedVaults] = useState<Record<string, { content: string; passphrase: string }>>({});
  const [lockDialogOpen, setLockDialogOpen] = useState(false);

  // Voice Memos & AI Audio Transcription
  const [voiceMemoDialogOpen, setVoiceMemoDialogOpen] = useState(false);

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
    const defaultWs = workspaces[0];
    if (defaultWs) {
      return defaultWs;
    }
    return {
      id: 'ws-default-nexus',
      name: currentUser?.name ? `${currentUser.name}'s Workspace` : 'Personal Workspace',
      slug: 'personal-workspace',
      ownerId: currentUser?.id || 'user-self',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [workspaces, currentUser]);

  // Synchronize workspace name and owner with authenticated user
  useEffect(() => {
    if (currentUser && workspaces.length > 0) {
      const ws = workspaces[0];
      if (ws.ownerId !== currentUser.id || ws.name.includes('Engineering Workspace')) {
        const updatedWs: Workspace = {
          ...ws,
          name: `${currentUser.name}'s Workspace`,
          ownerId: currentUser.id,
          updatedAt: new Date().toISOString(),
        };
        db.workspaces.put(updatedWs);
        setWorkspaces([updatedWs]);
      }
    }
  }, [currentUser, workspaces]);

  // Sharing & Membership State: Current User is always Workspace Owner
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  useEffect(() => {
    if (currentUser) {
      setMembers([
        {
          userId: currentUser.id,
          workspaceId: currentWorkspace.id,
          role: 'owner',
          joinedAt: (currentUser as any)?.createdAt || new Date().toISOString(),
          user: currentUser,
        },
      ]);
    } else {
      setMembers([
        {
          userId: 'guest-preview',
          workspaceId: currentWorkspace.id,
          role: 'viewer',
          joinedAt: new Date().toISOString(),
          user: {
            id: 'guest-preview',
            name: 'Guest Visitor',
            email: 'guest@preview.local',
            color: '#6366F1',
          },
        },
      ]);
    }
  }, [currentUser, currentWorkspace.id]);

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

  // Folder CRUD Actions
  const handleCreateFolder = async (name = 'New Folder', icon = '📁') => {
    if (isReadOnly) {
      openModal('auth');
      return;
    }
    const newId = `folder-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();
    const newFolder: Folder = {
      id: newId,
      workspaceId: currentWorkspace.id,
      name,
      icon,
      order: folders.length + 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.folders.add(newFolder);
    await mutationQueue.enqueue('folder', newId, 'create', newFolder, 1);
    setFolders((prev) => [...prev, newFolder]);
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    if (isReadOnly) {
      openModal('auth');
      return;
    }
    const target = folders.find((f) => f.id === folderId);
    if (!target) return;
    const updated = { ...target, name: newName, updatedAt: new Date().toISOString() };
    await db.folders.put(updated);
    await mutationQueue.enqueue('folder', folderId, 'patch', { name: newName });
    setFolders((prev) => prev.map((f) => (f.id === folderId ? updated : f)));
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (isReadOnly) {
      openModal('auth');
      return;
    }
    await db.folders.delete(folderId);
    await mutationQueue.enqueue('folder', folderId, 'delete', { id: folderId });
    // Move any notes inside this folder to uncategorized (folderId: null)
    const affectedNotes = notes.filter((n) => n.folderId === folderId);
    for (const note of affectedNotes) {
      const updatedNote = { ...note, folderId: null, updatedAt: new Date().toISOString() };
      await db.notes.put(updatedNote);
      await mutationQueue.enqueue('note', note.id, 'patch', { folderId: null });
    }
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setNotes((prev) => prev.map((n) => (n.folderId === folderId ? { ...n, folderId: null } : n)));
  };

  // Note CRUD Actions
  const handleDeleteNote = async (noteId: string) => {
    if (isReadOnly) {
      openModal('auth');
      return;
    }
    await db.notes.delete(noteId);
    await mutationQueue.enqueue('note', noteId, 'delete', { id: noteId });
    const remainingNotes = notes.filter((n) => n.id !== noteId);
    setNotes(remainingNotes);
    if (selectedNoteId === noteId) {
      if (remainingNotes.length > 0) {
        navigateTo('editor', remainingNotes[0].id);
      } else {
        setSelectedNoteId(null);
      }
    }
  };

  // Export and Import Handlers
  const handleExportMarkdown = useCallback(() => {
    if (currentNote) {
      const noteToExport = currentNote.isLocked && unlockedVaults[currentNote.id]
        ? { ...currentNote, content: unlockedVaults[currentNote.id].content }
        : currentNote;
      exportNoteToMarkdown(noteToExport);
    }
  }, [currentNote, unlockedVaults]);

  const handleExportPdf = useCallback(() => {
    if (currentNote) {
      const noteToExport = currentNote.isLocked && unlockedVaults[currentNote.id]
        ? { ...currentNote, content: unlockedVaults[currentNote.id].content }
        : currentNote;
      exportNoteToPdf(noteToExport);
    }
  }, [currentNote, unlockedVaults]);

  // Vault Note Handlers
  const handleUnlockNote = (noteId: string, decryptedContent: string, passphrase: string) => {
    setUnlockedVaults((prev) => ({
      ...prev,
      [noteId]: { content: decryptedContent, passphrase },
    }));
  };

  const handleLockNoteNow = (noteId: string) => {
    setUnlockedVaults((prev) => {
      const copy = { ...prev };
      delete copy[noteId];
      return copy;
    });
  };

  const handleApplyLock = async (passphrase: string, hint?: string) => {
    if (!currentNote || isReadOnly) return;
    const contentToEncrypt = unlockedVaults[currentNote.id]?.content || currentNote.content;
    const payload = await encryptNoteContent(contentToEncrypt, passphrase, hint);
    const serializedPayload = JSON.stringify(payload);
    const now = new Date().toISOString();

    const updatedNote: Note = {
      ...currentNote,
      isLocked: true,
      lockHint: hint,
      encryptedPayload: serializedPayload,
      content: serializedPayload,
      plainText: '[Protected Vault Note]',
      updatedAt: now,
      version: currentNote.version + 1,
    };

    setUnlockedVaults((prev) => ({
      ...prev,
      [currentNote.id]: { content: contentToEncrypt, passphrase },
    }));

    setNotes((prev) => prev.map((n) => (n.id === currentNote.id ? updatedNote : n)));
    await db.notes.put(updatedNote);
    await mutationQueue.enqueue('note', updatedNote.id, 'update', updatedNote, currentNote.version);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
  };

  const handleRemoveLock = async () => {
    if (!currentNote || isReadOnly) return;
    const decryptedContent = unlockedVaults[currentNote.id]?.content || currentNote.content;
    const now = new Date().toISOString();

    const updatedNote: Note = {
      ...currentNote,
      isLocked: false,
      lockHint: undefined,
      encryptedPayload: undefined,
      content: decryptedContent,
      plainText: decryptedContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      updatedAt: now,
      version: currentNote.version + 1,
    };

    setUnlockedVaults((prev) => {
      const copy = { ...prev };
      delete copy[currentNote.id];
      return copy;
    });

    setNotes((prev) => prev.map((n) => (n.id === currentNote.id ? updatedNote : n)));
    await db.notes.put(updatedNote);
    await mutationQueue.enqueue('note', updatedNote.id, 'update', updatedNote, currentNote.version);
  };

  // Voice Memo Handlers
  const handleSaveAudioMemo = async (
    title: string,
    audioData: string,
    duration: number,
    transcript: string
  ) => {
    if (!currentNote || isReadOnly) return;
    const newMemo: AudioMemo = {
      id: `memo-${uuidv4().slice(0, 8)}`,
      noteId: currentNote.id,
      title,
      audioData,
      duration,
      transcript,
      createdAt: new Date().toISOString(),
    };
    const updatedMemos = [...(currentNote.audioMemos || []), newMemo];
    const now = new Date().toISOString();
    const updatedNote: Note = {
      ...currentNote,
      audioMemos: updatedMemos,
      updatedAt: now,
      version: currentNote.version + 1,
    };
    setNotes((prev) => prev.map((n) => (n.id === currentNote.id ? updatedNote : n)));
    await db.notes.put(updatedNote);
    await mutationQueue.enqueue('note', updatedNote.id, 'update', updatedNote, currentNote.version);
    confetti({ particleCount: 35, spread: 70, origin: { y: 0.6 } });
  };

  const handleDeleteAudioMemo = async (memoId: string) => {
    if (!currentNote || isReadOnly) return;
    const updatedMemos = (currentNote.audioMemos || []).filter((m) => m.id !== memoId);
    const now = new Date().toISOString();
    const updatedNote: Note = {
      ...currentNote,
      audioMemos: updatedMemos,
      updatedAt: now,
      version: currentNote.version + 1,
    };
    setNotes((prev) => prev.map((n) => (n.id === currentNote.id ? updatedNote : n)));
    await db.notes.put(updatedNote);
    await mutationQueue.enqueue('note', updatedNote.id, 'update', updatedNote, currentNote.version);
  };

  const handleInsertAudioTranscript = async (transcript: string) => {
    if (!currentNote || isReadOnly) return;
    const addition = `<p></p><blockquote>🎙️ <strong>Voice Memo Transcript:</strong><br/>${transcript}</blockquote><p></p>`;
    const newContent = `${currentNote.content}${addition}`;
    await handleUpdateNoteContent(newContent, `${currentNote.plainText}\n\nVoice Memo: ${transcript}`);
    confetti({ particleCount: 25, spread: 50, origin: { y: 0.7 } });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isReadOnly) {
      openModal('auth');
      return;
    }
    try {
      const { title, content } = await parseMarkdownFile(file);
      const newId = `note-${uuidv4().slice(0, 8)}`;
      const now = new Date().toISOString();

      const newNote: Note = {
        id: newId,
        workspaceId: currentWorkspace.id,
        folderId: currentFolder?.id || folders[0]?.id || null,
        title,
        icon: '📝',
        content,
        plainText: content.replace(/<[^>]+>/g, ' '),
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
    } catch (err) {
      console.error('Failed to import markdown file:', err);
      alert('Failed to parse Markdown file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateNote = async (folderId?: string) => {
    if (isReadOnly) {
      openModal('auth');
      return;
    }
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

      if (currentNote.isLocked) {
        const vaultData = unlockedVaults[currentNote.id];
        if (vaultData) {
          // Update in-memory decrypted content
          setUnlockedVaults((prev) => ({
            ...prev,
            [currentNote.id]: { ...vaultData, content: html },
          }));

          // Re-encrypt client side before writing to disk or network
          const payload = await encryptNoteContent(html, vaultData.passphrase, currentNote.lockHint);
          const serializedPayload = JSON.stringify(payload);

          const updatedNote: Note = {
            ...currentNote,
            content: serializedPayload,
            encryptedPayload: serializedPayload,
            plainText: '[Protected Vault Note]',
            updatedAt: now,
            version: currentNote.version + 1,
          };

          setNotes((prev) => prev.map((n) => (n.id === currentNote.id ? updatedNote : n)));
          broadcastEditing(true);
          await db.notes.put(updatedNote);
          await mutationQueue.enqueue('note', updatedNote.id, 'update', updatedNote, currentNote.version);
          return;
        }
      }

      const updatedNote: Note = {
        ...currentNote,
        content: html,
        plainText,
        updatedAt: now,
        version: currentNote.version + 1,
      };

      // Optimistic in-memory update
      setNotes((prev) => prev.map((n) => (n.id === currentNote.id ? updatedNote : n)));

      // Broadcast typing presence
      broadcastEditing(true);

      // Save locally to IndexedDB
      await db.notes.put(updatedNote);

      // Enqueue in mutation queue
      await mutationQueue.enqueue('note', updatedNote.id, 'update', updatedNote, currentNote.version);
    },
    [currentNote, isReadOnly, unlockedVaults, broadcastEditing]
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

  const handleCreateSnapshot = async (summary?: string) => {
    if (!currentNote) return;
    const rev = await createNoteSnapshot(
      currentNote,
      currentUser?.name || 'Current User',
      currentUser?.id || 'user-self',
      summary
    );
    setRevisions((prev) => [rev, ...prev]);
    confetti({ particleCount: 30, spread: 50 });
  };

  const handleRestoreRevision = async (rev: NoteRevision) => {
    if (!currentNote || isReadOnly) return;
    // 1. Snapshot current state before restoring
    await createNoteSnapshot(
      currentNote,
      currentUser?.name || 'Current User',
      currentUser?.id || 'user-self',
      `Snapshot before restoring version "${rev.title}"`
    );

    // 2. Restore revision
    const updated: Note = {
      ...currentNote,
      title: rev.title,
      content: rev.content,
      updatedAt: new Date().toISOString(),
      version: currentNote.version + 1,
    };
    await db.notes.put(updated);
    setNotes((prev) => prev.map((n) => (n.id === currentNote.id ? updated : n)));

    // 3. Reload revisions list
    const updatedRevs = await db.revisions.where('noteId').equals(currentNote.id).reverse().sortBy('createdAt');
    setRevisions(updatedRevs);
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
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onDeleteNote={handleDeleteNote}
            isReadOnly={isReadOnly}
            onRequireAuth={() => openModal('auth')}
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
              onCreateFolder={(name, icon) => {
                closeModal('drawer');
                handleCreateFolder(name, icon);
              }}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
              onDeleteNote={handleDeleteNote}
              isReadOnly={isReadOnly}
              onRequireAuth={() => {
                closeModal('drawer');
                openModal('auth');
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
                {activeView === 'games' && (
                  <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 700 }}>
                    ♟️ 3D Chess & Games
                  </Typography>
                )}
              </Breadcrumbs>
            </Box>

            {/* Right Action Icons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Guest / Logged-in Actions */}
              {!currentUser ? (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PersonAddOutlined sx={{ fontSize: 15 }} />}
                  onClick={() => openModal('auth')}
                  sx={{
                    height: 28,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    textTransform: 'none',
                    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                    px: 1.5,
                  }}
                >
                  Sign In to Edit
                </Button>
              ) : (
                <>
                  <SyncStatusIndicator
                    status={syncStatus}
                    onForceSync={handleForceSync}
                    onToggleSimulatedOffline={handleToggleSimulatedOffline}
                    isSimulatedOffline={isSimulatedOffline}
                  />

                  {/* Real-Time Collaborator Presence Avatars */}
                  {activePeers.length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                      {activePeers.slice(0, 4).map((peer, idx) => (
                        <Tooltip
                          key={peer.clientId}
                          title={`${peer.userName} is ${peer.isEditing ? 'typing...' : 'viewing'}`}
                        >
                          <Badge
                            overlap="circular"
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            variant="dot"
                            color={peer.isEditing ? 'warning' : 'success'}
                            sx={{
                              ml: idx > 0 ? -1 : 0,
                              zIndex: 10 - idx,
                            }}
                          >
                            <Avatar
                              src={peer.userAvatar}
                              sx={{
                                width: 26,
                                height: 26,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                bgcolor: peer.userColor || '#6366F1',
                                border: `2px solid ${theme.palette.background.paper}`,
                              }}
                            >
                              {peer.userName[0]}
                            </Avatar>
                          </Badge>
                        </Tooltip>
                      ))}
                      {activePeers.length > 4 && (
                        <Chip
                          size="small"
                          label={`+${activePeers.length - 4}`}
                          sx={{ height: 20, fontSize: '0.65rem', ml: 0.5 }}
                        />
                      )}
                    </Box>
                  )}


                  {/* Share Note Button */}
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<ShareOutlined sx={{ fontSize: 16 }} />}
                    onClick={() => openModal('share')}
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
                </>
              )}

              {activeView === 'editor' && currentNote && (
                <>
                  {/* Hidden File Input for Markdown Import */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportFile}
                    accept=".md,.markdown,.txt"
                    style={{ display: 'none' }}
                  />

                  {/* Import Note Button */}
                  <Tooltip title="Import Markdown (.md)">
                    <IconButton
                      size="small"
                      disabled={isReadOnly}
                      onClick={() => {
                        if (isReadOnly) openModal('auth');
                        else fileInputRef.current?.click();
                      }}
                    >
                      <FileUploadOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  {/* Export Menu Button */}
                  <Tooltip title="Export Document (PDF / Markdown)">
                    <IconButton
                      size="small"
                      onClick={(e) => setExportAnchorEl(e.currentTarget)}
                    >
                      <FileDownloadOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  <Menu
                    anchorEl={exportAnchorEl}
                    open={Boolean(exportAnchorEl)}
                    onClose={() => setExportAnchorEl(null)}
                    PaperProps={{ sx: { borderRadius: '10px', minWidth: 190 } }}
                  >
                    <MenuItem
                      onClick={() => {
                        setExportAnchorEl(null);
                        handleExportPdf();
                      }}
                      sx={{ gap: 1.2, fontSize: '0.85rem' }}
                    >
                      <PictureAsPdfOutlined fontSize="small" sx={{ color: '#EF4444' }} /> Export as PDF
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setExportAnchorEl(null);
                        handleExportMarkdown();
                      }}
                      sx={{ gap: 1.2, fontSize: '0.85rem' }}
                    >
                      <FileDownloadOutlined fontSize="small" sx={{ color: '#06B6D4' }} /> Export as Markdown (.md)
                    </MenuItem>
                  </Menu>

                  {/* Lock / Vault Encryption Button */}
                  {currentNote.isLocked ? (
                    unlockedVaults[currentNote.id] ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title="Lock note now (clear session key)">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<LockOpenOutlined sx={{ fontSize: '15px !important' }} />}
                            onClick={() => handleLockNoteNow(currentNote.id)}
                            sx={{
                              py: 0.2,
                              px: 1,
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              textTransform: 'none',
                              color: '#F59E0B',
                              borderColor: 'rgba(245, 158, 11, 0.4)',
                              bgcolor: 'rgba(245, 158, 11, 0.08)',
                              '&:hover': {
                                borderColor: '#F59E0B',
                                bgcolor: 'rgba(245, 158, 11, 0.16)',
                              },
                            }}
                          >
                            Lock Vault
                          </Button>
                        </Tooltip>
                        <Tooltip title="Security & Password Settings">
                          <IconButton
                            size="small"
                            onClick={() => setLockDialogOpen(true)}
                            sx={{ color: '#F59E0B' }}
                          >
                            <Security fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ) : (
                      <Tooltip title="Note is encrypted and locked with AES-256-GCM">
                        <Chip
                          icon={<LockOutlined sx={{ fontSize: '14px !important', color: '#F59E0B !important' }} />}
                          label="Locked Vault"
                          size="small"
                          sx={{
                            bgcolor: 'rgba(245, 158, 11, 0.15)',
                            color: '#FBBF24',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                          }}
                        />
                      </Tooltip>
                    )
                  ) : (
                    <Tooltip title="Encrypt & Lock Note with Password (AES-256-GCM)">
                      <IconButton
                        size="small"
                        disabled={isReadOnly}
                        onClick={() => setLockDialogOpen(true)}
                        sx={{ '&:hover': { color: '#F59E0B' } }}
                      >
                        <LockOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}

                  {/* Voice Memo Button */}
                  <Tooltip title="Record Voice Memo with AI Transcription">
                    <IconButton
                      size="small"
                      disabled={isReadOnly}
                      onClick={() => setVoiceMemoDialogOpen(true)}
                      sx={{
                        color: (currentNote.audioMemos?.length || 0) > 0 ? '#10B981' : 'default',
                        '&:hover': { color: '#10B981' },
                      }}
                    >
                      <Badge badgeContent={currentNote.audioMemos?.length || 0} color="success" max={9}>
                        <GraphicEqOutlined fontSize="small" />
                      </Badge>
                    </IconButton>
                  </Tooltip>

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
                  {/* Delete Note Button */}
                  <Tooltip title="Delete note">
                    <IconButton
                      size="small"
                      disabled={isReadOnly}
                      onClick={() => {
                        if (isReadOnly) openModal('auth');
                        else if (window.confirm(`Delete "${currentNote.title}"?`)) handleDeleteNote(currentNote.id);
                      }}
                      sx={{ '&:hover': { color: 'error.main' } }}
                    >
                      <DeleteOutline fontSize="small" />
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

          {/* Real Network Offline Indicator */}
          {!isOnline && (
            <Alert
              severity="info"
              icon={<CloudOff fontSize="inherit" />}
              sx={{
                py: 0.3,
                px: 2,
                borderRadius: 0,
                fontSize: '0.78rem',
                borderBottom: `1px solid ${theme.palette.divider}`,
                bgcolor: 'rgba(245, 158, 11, 0.12)',
                color: '#fbbf24',
              }}
            >
              ⚡ You are currently offline. Full access is active — all your notes, games, and graph edits are safely saved locally to your device and will sync when reconnected.
            </Alert>
          )}

          {/* Read-Only Mode Banner if active */}
          {isReadOnly && (
            <Alert
              severity={!currentUser ? 'info' : 'warning'}
              icon={<Visibility fontSize="inherit" />}
              action={
                !currentUser ? (
                  <Button
                    color="primary"
                    size="small"
                    onClick={() => openModal('auth')}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem' }}
                  >
                    Sign In / Register
                  </Button>
                ) : undefined
              }
              sx={{
                py: 0.3,
                px: 2,
                borderRadius: 0,
                fontSize: '0.78rem',
                borderBottom: `1px solid ${theme.palette.divider}`,
              }}
            >
              {!currentUser
                ? 'You are viewing this workspace as a guest in Read-Only mode. Sign in or create an account to edit notes, create documents, and collaborate.'
                : 'You are viewing this document with Read-Only permissions.'}
            </Alert>
          )}

          {/* Main Stage Content */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 4 }, bgcolor: theme.palette.background.default }}>
            {activeView === 'editor' && currentNote && (
              currentNote.isLocked && !unlockedVaults[currentNote.id] ? (
                <NoteVaultLockScreen
                  note={currentNote}
                  onUnlocked={(decrypted, pass) => handleUnlockNote(currentNote.id, decrypted, pass)}
                />
              ) : (
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

                  {/* Voice Memos & Audio Transcripts Shelf */}
                  {currentNote.audioMemos && currentNote.audioMemos.length > 0 && (
                    <VoiceMemosShelf
                      memos={currentNote.audioMemos}
                      onOpenRecorder={() => setVoiceMemoDialogOpen(true)}
                      onDeleteMemo={handleDeleteAudioMemo}
                      onInsertTranscript={handleInsertAudioTranscript}
                    />
                  )}

                  <Divider sx={{ mb: 3 }} />

                  {/* Rich Text Editor */}
                  <TipTapEditor
                    key={`${currentNote.id}-${currentNote.isLocked ? 'unlocked' : 'plain'}`}
                    initialContent={currentNote.isLocked ? (unlockedVaults[currentNote.id]?.content || '') : currentNote.content}
                    onChange={handleUpdateNoteContent}
                    editable={!isReadOnly}
                    onRequireAuth={() => openModal('auth')}
                    onNavigateBacklink={(title) => {
                      const match = notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
                      if (match) navigateTo('editor', match.id);
                    }}
                  />
                </Box>
              )
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

            {/* Games Hub / 3D Chess View */}
            {activeView === 'games' && (
              <GamesHub />
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
            onCreateSnapshot={() => handleCreateSnapshot()}
          />
        )}
      </Box>

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => closeModal('palette')}
        notes={notes}
        currentNote={currentNote}
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
        onExportMarkdown={handleExportMarkdown}
        onExportPdf={handleExportPdf}
        onImportMarkdown={() => fileInputRef.current?.click()}
        onLockCurrentNote={() => setLockDialogOpen(true)}
        onOpenVoiceRecorder={() => setVoiceMemoDialogOpen(true)}
      />

      {/* Voice Memo Recorder Dialog */}
      <VoiceMemoRecorderDialog
        open={voiceMemoDialogOpen}
        onClose={() => setVoiceMemoDialogOpen(false)}
        onSaveMemo={handleSaveAudioMemo}
      />

      {/* End-to-End Encrypted Vault Lock Dialog */}
      {currentNote && (
        <LockNoteDialog
          open={lockDialogOpen}
          note={currentNote}
          isCurrentlyLocked={Boolean(currentNote.isLocked)}
          onClose={() => setLockDialogOpen(false)}
          onLockNote={handleApplyLock}
          onRemoveLock={currentNote.isLocked ? handleRemoveLock : undefined}
        />
      )}

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
    </ThemeProvider>
  );
};

export default App;
