import * as React from 'react';
import { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Paper,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Divider,
  useTheme,
  Badge,
} from '@mui/material';
import {
  Close,
  InfoOutlined,
  ChatBubbleOutline,
  RestoreOutlined,
  AttachFile,
  LinkOutlined,
  CloudUpload,
  DescriptionOutlined,
  AccessTime,
  PersonOutline,
  FolderOpen,
} from '@mui/icons-material';
import { Note, NoteRevision, NoteComment, NoteAttachment, Folder } from '../../types/note';
import { CommentSection } from '../comments/CommentSection';

interface InspectorPanelProps {
  note: Note | null;
  folder?: Folder;
  allNotes: Note[];
  comments: NoteComment[];
  revisions: NoteRevision[];
  attachments: NoteAttachment[];
  onClose: () => void;
  onNavigateNote: (noteId: string) => void;
  onAddComment: (comment: NoteComment) => void;
  onResolveComment: (commentId: string, resolved: boolean) => void;
  onAddReply: (commentId: string, reply: any) => void;
  onRestoreRevision: (revision: NoteRevision) => void;
  onUploadAttachment: (file: File) => void;
}

export const InspectorPanel = ({
  note,
  folder,
  allNotes,
  comments,
  revisions,
  attachments,
  onClose,
  onNavigateNote,
  onAddComment,
  onResolveComment,
  onAddReply,
  onRestoreRevision,
  onUploadAttachment,
}: InspectorPanelProps): React.ReactElement | null => {
  const theme = useTheme();
  const [tabIndex, setTabIndex] = useState(0);

  if (!note) return null;

  // Resolve backlink titles
  const backlinkNotes = allNotes.filter(
    (n: Note) => note.backlinks?.includes(n.id) || n.backlinks?.includes(note.id)
  );

  return (
    <Box
      sx={{
        width: 350,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.mode === 'dark' ? '#0B0F19' : '#FFFFFF',
        borderLeft: `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Inspector
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      </Box>

      {/* Sleek Segmented Pill Tabs */}
      <Box sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Tabs
          value={tabIndex}
          onChange={(_, val) => setTabIndex(val)}
          variant="fullWidth"
          sx={{
            minHeight: 36,
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
            borderRadius: '8px',
            p: 0.4,
            '& .MuiTabs-indicator': {
              display: 'none',
            },
            '& .MuiTab-root': {
              minHeight: 30,
              minWidth: 0,
              px: 0.5,
              py: 0.4,
              fontSize: '0.72rem',
              fontWeight: 600,
              borderRadius: '6px',
              textTransform: 'none',
              transition: 'all 0.15s ease',
              color: 'text.secondary',
              '&.Mui-selected': {
                bgcolor: theme.palette.mode === 'dark' ? '#1A253F' : '#FFFFFF',
                color: 'primary.main',
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              },
            },
          }}
        >
          <Tooltip title="Note Details & Outline">
            <Tab icon={<InfoOutlined sx={{ fontSize: 16 }} />} label="Info" />
          </Tooltip>
          <Tooltip title="Connected Backlinks">
            <Tab
              icon={
                <Badge
                  badgeContent={backlinkNotes.length}
                  color="secondary"
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 14, minWidth: 14, top: -2, right: -4 } }}
                >
                  <LinkOutlined sx={{ fontSize: 16 }} />
                </Badge>
              }
              label="Links"
            />
          </Tooltip>
          <Tooltip title="Discussions & Comments">
            <Tab
              icon={
                <Badge
                  badgeContent={comments.length}
                  color="primary"
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 14, minWidth: 14, top: -2, right: -4 } }}
                >
                  <ChatBubbleOutline sx={{ fontSize: 16 }} />
                </Badge>
              }
              label="Chat"
            />
          </Tooltip>
          <Tooltip title="Version History">
            <Tab icon={<RestoreOutlined sx={{ fontSize: 16 }} />} label="History" />
          </Tooltip>
          <Tooltip title="File Attachments">
            <Tab
              icon={
                <Badge
                  badgeContent={attachments.length}
                  color="default"
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 14, minWidth: 14, top: -2, right: -4 } }}
                >
                  <AttachFile sx={{ fontSize: 16 }} />
                </Badge>
              }
              label="Files"
            />
          </Tooltip>
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {/* Tab 0: Metadata */}
        {tabIndex === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600 }}>
                Details
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  mt: 0.8,
                  borderRadius: '10px',
                  border: `1px solid ${theme.palette.divider}`,
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FolderOpen fontSize="small" sx={{ color: 'primary.main' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Folder:
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {folder ? folder.name : 'Workspace Root'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonOutline fontSize="small" sx={{ color: 'secondary.main' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Author:
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {note.authorName}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccessTime fontSize="small" sx={{ color: 'text.muted' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Updated:
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {new Date(note.updatedAt).toLocaleDateString()} {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>
              </Paper>
            </Box>

            {/* Tags */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600 }}>
                Tags
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mt: 1 }}>
                {note.tags && note.tags.length > 0 ? (
                  note.tags.map((t: string) => (
                    <Chip key={t} label={`#${t}`} size="small" sx={{ fontSize: '0.75rem', bgcolor: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }} />
                  ))
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.muted' }}>
                    No tags applied
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        )}

        {/* Tab 1: Backlinks */}
        {tabIndex === 1 && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600 }}>
              Connected Notes ({backlinkNotes.length})
            </Typography>
            <List sx={{ mt: 1, p: 0 }}>
              {backlinkNotes.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, fontSize: '0.85rem' }}>
                  No interconnected notes found. Link notes using <code>[[Note Name]]</code>.
                </Typography>
              ) : (
                backlinkNotes.map((bn: Note) => (
                  <Paper
                    key={bn.id}
                    elevation={0}
                    onClick={() => onNavigateNote(bn.id)}
                    sx={{
                      p: 1.5,
                      mb: 1,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: `1px solid ${theme.palette.divider}`,
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(79, 70, 229, 0.05)',
                      },
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {bn.icon || '📄'} {bn.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.3 }}>
                      {bn.plainText.slice(0, 70)}...
                    </Typography>
                  </Paper>
                ))
              )}
            </List>
          </Box>
        )}

        {/* Tab 2: Comments */}
        {tabIndex === 2 && (
          <CommentSection
            noteId={note.id}
            comments={comments}
            onAddComment={onAddComment}
            onResolveComment={onResolveComment}
            onAddReply={onAddReply}
          />
        )}

        {/* Tab 3: Revisions & History */}
        {tabIndex === 3 && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600 }}>
              Version History ({revisions.length})
            </Typography>
            <List sx={{ mt: 1, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {revisions.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, fontSize: '0.85rem' }}>
                  No previous snapshots saved yet. Snapshots are created before sync merges and major edits.
                </Typography>
              ) : (
                revisions.map((rev: NoteRevision) => (
                  <Paper
                    key={rev.id}
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: '8px',
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {rev.authorName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.muted' }}>
                        {new Date(rev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontSize: '0.82rem', my: 0.8, color: 'text.secondary' }}>
                      {rev.summary || `Snapshot of "${rev.title}"`}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onRestoreRevision(rev)}
                      sx={{ fontSize: '0.72rem', py: 0.2 }}
                    >
                      Restore This Version
                    </Button>
                  </Paper>
                ))
              )}
            </List>
          </Box>
        )}

        {/* Tab 4: Attachments */}
        {tabIndex === 4 && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600 }}>
              Offline File Attachments
            </Typography>

            {/* Upload Box */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mt: 1,
                mb: 2,
                textAlign: 'center',
                borderRadius: '10px',
                border: `1px dashed ${theme.palette.divider}`,
                cursor: 'pointer',
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
                '&:hover': { borderColor: 'primary.main' },
              }}
              component="label"
            >
              <input
                type="file"
                hidden
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    onUploadAttachment(e.target.files[0]);
                  }
                }}
              />
              <CloudUpload sx={{ color: 'primary.main', fontSize: 32, mb: 0.5 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Attach file offline
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Stored locally in IndexedDB, queued for upload
              </Typography>
            </Paper>

            {/* List */}
            <List sx={{ p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {attachments.map((att: NoteAttachment) => (
                <Paper
                  key={att.id}
                  elevation={0}
                  sx={{
                    p: 1.2,
                    borderRadius: '8px',
                    border: `1px solid ${theme.palette.divider}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                    <AttachFile fontSize="small" sx={{ color: 'primary.main' }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 160 }}>
                      {att.name}
                    </Typography>
                  </Box>
                  <Chip
                    label={att.uploadStatus}
                    size="small"
                    color={att.uploadStatus === 'uploaded' ? 'success' : 'warning'}
                    sx={{ height: 18, fontSize: '0.65rem' }}
                  />
                </Paper>
              ))}
            </List>
          </Box>
        )}
      </Box>
    </Box>
  );
};
