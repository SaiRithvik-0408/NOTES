import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  Grid,
  Chip,
  Divider,
  useTheme,
} from '@mui/material';
import { WarningAmber, CheckCircleOutline, RestorePage, MergeType } from '@mui/icons-material';
import { ConflictRecord } from '../../types/sync';

interface ConflictDialogProps {
  conflict: ConflictRecord | null;
  onResolve: (conflictId: string, strategy: 'keep_local' | 'keep_remote' | 'merged') => void;
  onClose: () => void;
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  conflict,
  onResolve,
  onClose,
}) => {
  const theme = useTheme();

  if (!conflict) return null;

  const localTitle = conflict.localData?.title || 'Untitled Note';
  const remoteTitle = conflict.remoteData?.title || 'Untitled Note';
  const localContent = conflict.localData?.plainText || conflict.localData?.content || '';
  const remoteContent = conflict.remoteData?.plainText || conflict.remoteData?.content || '';

  return (
    <Dialog
      open={Boolean(conflict)}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          backgroundColor: theme.palette.mode === 'dark' ? '#0F1626' : '#FFFFFF',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <WarningAmber sx={{ color: '#EF4444', fontSize: '1.8rem' }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Version Conflict Detected
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Changes were made offline while the remote document was updated independently.
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ py: 2 }}>
        <Grid container spacing={2}>
          {/* Your Local Version */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '10px',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.06)' : 'rgba(79, 70, 229, 0.03)',
                height: '100%',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  Your Offline Version
                </Typography>
                <Chip label={`v${conflict.localVersion}`} size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                {localTitle}
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: '6px',
                  backgroundColor: theme.palette.mode === 'dark' ? '#090D16' : '#F1F5F9',
                  maxHeight: 200,
                  overflowY: 'auto',
                  fontSize: '0.85rem',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                }}
              >
                {localContent.slice(0, 500) || '(Empty document)'}
              </Box>
            </Paper>
          </Grid>

          {/* Remote Server Version */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '10px',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(168, 85, 247, 0.06)' : 'rgba(147, 51, 234, 0.03)',
                height: '100%',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'secondary.main' }}>
                  Remote Version
                </Typography>
                <Chip label={`v${conflict.remoteVersion}`} size="small" color="secondary" sx={{ height: 20, fontSize: '0.7rem' }} />
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                {remoteTitle}
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: '6px',
                  backgroundColor: theme.palette.mode === 'dark' ? '#090D16' : '#F1F5F9',
                  maxHeight: 200,
                  overflowY: 'auto',
                  fontSize: '0.85rem',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                }}
              >
                {remoteContent.slice(0, 500) || '(Empty document)'}
              </Box>
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, p: 1.5, borderRadius: '8px', bgcolor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            ℹ️ Resolving will preserve both states into the note revision history before applying your choice.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<RestorePage />}
          onClick={() => onResolve(conflict.id, 'keep_local')}
        >
          Keep Mine (Offline)
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<CheckCircleOutline />}
          onClick={() => onResolve(conflict.id, 'keep_remote')}
        >
          Keep Remote
        </Button>
        <Button
          variant="contained"
          startIcon={<MergeType />}
          onClick={() => onResolve(conflict.id, 'merged')}
          sx={{ background: 'linear-gradient(135deg, #6366F1, #A855F7)' }}
        >
          Merge Both
        </Button>
      </DialogActions>
    </Dialog>
  );
};
