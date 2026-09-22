import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Avatar,
  IconButton,
  Tooltip,
  Chip,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Send,
  CheckCircle,
  RadioButtonUnchecked,
  Reply,
  ChatBubbleOutline,
  AlternateEmail,
} from '@mui/icons-material';
import { NoteComment, NoteCommentReply } from '../../types/note';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../auth/AuthContext';

interface CommentSectionProps {
  noteId: string;
  comments: NoteComment[];
  onAddComment: (comment: NoteComment) => void;
  onResolveComment: (commentId: string, resolved: boolean) => void;
  onAddReply: (commentId: string, reply: NoteCommentReply) => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  noteId,
  comments,
  onAddComment,
  onResolveComment,
  onAddReply,
}) => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filterResolved, setFilterResolved] = useState<boolean | null>(null);

  const handleCreateComment = () => {
    if (!newCommentText.trim()) return;

    const newComment: NoteComment = {
      id: `comment-${uuidv4()}`,
      noteId,
      authorId: currentUser?.id || 'user-self',
      authorName: currentUser?.name || 'Workspace Member',
      authorAvatar: currentUser?.avatarUrl,
      content: newCommentText.trim(),
      resolved: false,
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onAddComment(newComment);
    setNewCommentText('');
  };

  const handleCreateReply = (commentId: string) => {
    if (!replyText.trim()) return;

    const reply: NoteCommentReply = {
      id: `reply-${uuidv4()}`,
      commentId,
      authorId: currentUser?.id || 'user-self',
      authorName: currentUser?.name || 'Workspace Member',
      authorAvatar: currentUser?.avatarUrl,
      content: replyText.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onAddReply(commentId, reply);
    setReplyText('');
    setReplyingToId(null);
  };

  const filteredComments = comments.filter((c) => {
    if (filterResolved === null) return true;
    return c.resolved === filterResolved;
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header & Filters */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ChatBubbleOutline fontSize="small" sx={{ color: 'primary.main' }} />
          Discussion ({comments.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Chip
            label="All"
            size="small"
            variant={filterResolved === null ? 'filled' : 'outlined'}
            onClick={() => setFilterResolved(null)}
            sx={{ height: 22, fontSize: '0.7rem' }}
          />
          <Chip
            label="Open"
            size="small"
            variant={filterResolved === false ? 'filled' : 'outlined'}
            color="primary"
            onClick={() => setFilterResolved(false)}
            sx={{ height: 22, fontSize: '0.7rem' }}
          />
          <Chip
            label="Resolved"
            size="small"
            variant={filterResolved === true ? 'filled' : 'outlined'}
            onClick={() => setFilterResolved(true)}
            sx={{ height: 22, fontSize: '0.7rem' }}
          />
        </Box>
      </Box>

      {/* New Comment Input Box */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 2,
          borderRadius: '10px',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        }}
      >
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          placeholder="Leave a comment or type @ to mention..."
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          variant="standard"
          InputProps={{ disableUnderline: true, sx: { fontSize: '0.875rem' } }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          <Tooltip title="Mention collaborator">
            <IconButton size="small" onClick={() => setNewCommentText((prev) => prev + '@')}>
              <AlternateEmail fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="contained"
            endIcon={<Send fontSize="small" />}
            onClick={handleCreateComment}
            disabled={!newCommentText.trim()}
            sx={{ borderRadius: '6px', fontSize: '0.75rem', px: 1.5 }}
          >
            Comment
          </Button>
        </Box>
      </Paper>

      {/* Comments List */}
      <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {filteredComments.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, opacity: 0.6 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No comments yet. Start a discussion!
            </Typography>
          </Box>
        ) : (
          filteredComments.map((comment) => (
            <Paper
              key={comment.id}
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: '10px',
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: comment.resolved
                  ? theme.palette.mode === 'dark'
                    ? 'rgba(255,255,255,0.01)'
                    : 'rgba(0,0,0,0.02)'
                  : theme.palette.background.paper,
                opacity: comment.resolved ? 0.65 : 1,
              }}
            >
              {/* Comment Author & Resolve Button */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: 'primary.main' }}>
                    {comment.authorName[0]}
                  </Avatar>
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      {comment.authorName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.muted', ml: 0.8, fontSize: '0.68rem' }}>
                      {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                </Box>
                <Tooltip title={comment.resolved ? 'Reopen comment' : 'Mark as resolved'}>
                  <IconButton
                    size="small"
                    onClick={() => onResolveComment(comment.id, !comment.resolved)}
                    color={comment.resolved ? 'success' : 'default'}
                  >
                    {comment.resolved ? <CheckCircle fontSize="small" /> : <RadioButtonUnchecked fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Anchor context preview if anchored */}
              {comment.anchorText && (
                <Box sx={{ pl: 1, borderLeft: '2px solid #6366F1', mb: 1, py: 0.2 }}>
                  <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'primary.light' }}>
                    "{comment.anchorText}"
                  </Typography>
                </Box>
              )}

              {/* Content */}
              <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 1, whiteSpace: 'pre-wrap' }}>
                {comment.content}
              </Typography>

              {/* Threaded Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <Box sx={{ pl: 2, borderLeft: `1px solid ${theme.palette.divider}`, my: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {comment.replies.map((reply) => (
                    <Box key={reply.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <Avatar sx={{ width: 18, height: 18, fontSize: '0.65rem', bgcolor: 'secondary.main' }}>
                          {reply.authorName[0]}
                        </Avatar>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {reply.authorName}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', mt: 0.3 }}>
                        {reply.content}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Reply Button / Box */}
              {replyingToId === comment.id ? (
                <Box sx={{ mt: 1.5, pt: 1, borderTop: `1px dashed ${theme.palette.divider}` }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Write a reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    autoFocus
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                    <Button size="small" onClick={() => setReplyingToId(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleCreateReply(comment.id)}
                      disabled={!replyText.trim()}
                    >
                      Reply
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Button
                  size="small"
                  startIcon={<Reply fontSize="small" />}
                  onClick={() => setReplyingToId(comment.id)}
                  sx={{ fontSize: '0.72rem', py: 0.2, px: 0.8, color: 'text.secondary' }}
                >
                  Reply
                </Button>
              )}
            </Paper>
          ))
        )}
      </Box>
    </Box>
  );
};
