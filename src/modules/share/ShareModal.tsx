import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Box,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Switch,
  FormControlLabel,
  Chip,
  Paper,
  Divider,
  Tooltip,
  useTheme,
  InputAdornment,
} from '@mui/material';
import {
  PersonAddOutlined,
  LinkOutlined,
  ContentCopy,
  Check,
  DeleteOutline,
  Close,
  Public,
  LockOutlined,
  Shield,
  Send,
} from '@mui/icons-material';
import { Note, Workspace, WorkspaceRole, WorkspaceMember } from '../../types/note';
import { v4 as uuidv4 } from 'uuid';
import confetti from 'canvas-confetti';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  note?: Note | null;
  workspace: Workspace;
  members: WorkspaceMember[];
  onInviteMember: (email: string, role: WorkspaceRole) => void;
  onUpdateMemberRole: (userId: string, newRole: WorkspaceRole) => void;
  onRemoveMember: (userId: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  open,
  onClose,
  note,
  workspace,
  members,
  onInviteMember,
  onUpdateMemberRole,
  onRemoveMember,
}) => {
  const theme = useTheme();
  const [tab, setTab] = useState(0); // 0: Invite People, 1: Share Link

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('editor');

  // Share Link state
  const [isLinkSharingEnabled, setIsLinkSharingEnabled] = useState(true);
  const [linkAccessLevel, setLinkAccessLevel] = useState<'view' | 'edit'>('view');
  const [copied, setCopied] = useState(false);

  // Generate shareable link
  const shareToken = note ? `note-${note.id.replace('note-', '')}` : `ws-${workspace.id}`;
  const shareUrl = `${window.location.origin}/?share=${shareToken}&access=${linkAccessLevel}`;

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    onInviteMember(inviteEmail.trim(), inviteRole);
    setInviteEmail('');
    confetti({ particleCount: 35, spread: 60, origin: { y: 0.2 } });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    confetti({ particleCount: 25, spread: 50 });
    setTimeout(() => setCopied(false), 2500);
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
          bgcolor: theme.palette.mode === 'dark' ? '#0F1626' : '#FFFFFF',
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Share & Collaborate
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {note ? `Sharing "${note.title}"` : `Sharing workspace "${workspace.name}"`}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Navigation Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            minHeight: 40,
            mb: 2.5,
            borderBottom: `1px solid ${theme.palette.divider}`,
            '& .MuiTab-root': { minHeight: 40, py: 0.5, fontSize: '0.85rem', fontWeight: 600 },
          }}
        >
          <Tab icon={<PersonAddOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Invite People" />
          <Tab icon={<LinkOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Share Link" />
        </Tabs>

        {/* TAB 0: INVITE PEOPLE */}
        {tab === 0 && (
          <Box>
            {/* Invite Form */}
            <Paper
              component="form"
              onSubmit={handleSendInvite}
              elevation={0}
              sx={{
                p: 1.5,
                mb: 3,
                borderRadius: '10px',
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0,0,0,0.02)',
                display: 'flex',
                gap: 1,
                alignItems: 'center',
              }}
            >
              <TextField
                fullWidth
                size="small"
                type="email"
                placeholder="Enter colleague email..."
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                variant="standard"
                InputProps={{ disableUnderline: true, sx: { fontSize: '0.9rem' } }}
              />

              <Select
                size="small"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                sx={{ minWidth: 110, height: 36, fontSize: '0.8rem', borderRadius: '6px' }}
              >
                <MenuItem value="editor">Can Edit</MenuItem>
                <MenuItem value="commenter">Can Comment</MenuItem>
                <MenuItem value="viewer">Can View</MenuItem>
              </Select>

              <Button
                type="submit"
                variant="contained"
                size="small"
                disabled={!inviteEmail.trim()}
                sx={{
                  px: 2,
                  height: 36,
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  whiteSpace: 'nowrap',
                }}
              >
                Invite
              </Button>
            </Paper>

            {/* Active Members List */}
            <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', display: 'block', mb: 1 }}>
              Workspace Collaborators ({members.length})
            </Typography>

            <List dense sx={{ p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {members.map((member) => (
                <Paper
                  key={member.userId}
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                    <Avatar src={member.user.avatarUrl} sx={{ width: 32, height: 32, bgcolor: member.user.color }}>
                      {member.user.name[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {member.user.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.muted' }}>
                        {member.user.email}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {member.role === 'owner' ? (
                      <Chip label="Owner" size="small" color="primary" sx={{ fontWeight: 700, height: 22, fontSize: '0.72rem' }} />
                    ) : (
                      <Select
                        size="small"
                        value={member.role}
                        onChange={(e) => onUpdateMemberRole(member.userId, e.target.value as WorkspaceRole)}
                        sx={{ height: 28, fontSize: '0.75rem', borderRadius: '4px' }}
                      >
                        <MenuItem value="editor">Can Edit</MenuItem>
                        <MenuItem value="commenter">Can Comment</MenuItem>
                        <MenuItem value="viewer">Can View</MenuItem>
                      </Select>
                    )}

                    {member.role !== 'owner' && (
                      <Tooltip title="Remove collaborator">
                        <IconButton size="small" color="error" onClick={() => onRemoveMember(member.userId)}>
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Paper>
              ))}
            </List>
          </Box>
        )}

        {/* TAB 1: SHARE LINK */}
        {tab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Toggle Enable Public Link */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '10px',
                border: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: isLinkSharingEnabled
                  ? theme.palette.mode === 'dark'
                    ? 'rgba(99, 102, 241, 0.08)'
                    : 'rgba(79, 70, 229, 0.04)'
                  : 'transparent',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {isLinkSharingEnabled ? (
                  <Public sx={{ color: 'primary.main', fontSize: 24 }} />
                ) : (
                  <LockOutlined sx={{ color: 'text.muted', fontSize: 24 }} />
                )}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Anyone with the link
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {isLinkSharingEnabled ? 'Anyone with this unique link can access' : 'Link sharing is disabled'}
                  </Typography>
                </Box>
              </Box>

              <Switch
                checked={isLinkSharingEnabled}
                onChange={(e) => setIsLinkSharingEnabled(e.target.checked)}
                color="primary"
              />
            </Paper>

            {/* Access Permission & Link Copy */}
            {isLinkSharingEnabled && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Access Level for Link Holders:
                  </Typography>
                  <Select
                    size="small"
                    value={linkAccessLevel}
                    onChange={(e) => setLinkAccessLevel(e.target.value as 'view' | 'edit')}
                    sx={{ minWidth: 140, height: 32, fontSize: '0.8rem', borderRadius: '6px' }}
                  >
                    <MenuItem value="view">Can View (Read-only)</MenuItem>
                    <MenuItem value="edit">Can Edit (Full Collaboration)</MenuItem>
                  </Select>
                </Box>

                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: '8px',
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: theme.palette.mode === 'dark' ? '#090D16' : '#F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{
                      flex: 1,
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      color: 'primary.light',
                    }}
                  >
                    {shareUrl}
                  </Typography>

                  <Button
                    variant="contained"
                    size="small"
                    startIcon={copied ? <Check /> : <ContentCopy />}
                    onClick={handleCopyLink}
                    color={copied ? 'success' : 'primary'}
                    sx={{ borderRadius: '6px', fontSize: '0.75rem', px: 1.5 }}
                  >
                    {copied ? 'Copied!' : 'Copy Link'}
                  </Button>
                </Paper>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.2, borderRadius: '6px', bgcolor: 'rgba(99, 102, 241, 0.08)' }}>
                  <Shield sx={{ color: 'primary.main', fontSize: 18 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Recipients accessing with <strong>{linkAccessLevel === 'view' ? 'Can View' : 'Can Edit'}</strong> will be automatically granted those permissions.
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};
