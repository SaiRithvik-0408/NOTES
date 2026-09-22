import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  LinearProgress,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Lock,
  LockOpen,
  Visibility,
  VisibilityOff,
  Security,
  Key,
  Close,
  ShieldOutlined,
  NoEncryptionOutlined,
} from '@mui/icons-material';
import { Note } from '../../types/note';
import { estimatePasswordStrength } from '../../utils/cryptoVault';

interface LockNoteDialogProps {
  open: boolean;
  note: Note;
  isCurrentlyLocked: boolean;
  onClose: () => void;
  onLockNote: (passphrase: string, hint?: string) => Promise<void>;
  onRemoveLock?: () => Promise<void>;
}

export const LockNoteDialog: React.FC<LockNoteDialogProps> = ({
  open,
  note,
  isCurrentlyLocked,
  onClose,
  onLockNote,
  onRemoveLock,
}) => {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [hint, setHint] = useState(note.lockHint || '');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const strength = estimatePasswordStrength(passphrase);

  const handleApplyLock = async () => {
    if (!passphrase.trim()) {
      setError('Please provide a password or PIN.');
      return;
    }
    if (passphrase.length < 4) {
      setError('PIN or password must be at least 4 characters long.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await onLockNote(passphrase, hint);
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to encrypt note.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveLock = async () => {
    if (window.confirm(`Are you sure you want to permanently remove password encryption from "${note.title}"? Anyone with access to this workspace will be able to view it.`)) {
      setIsLoading(true);
      setError(null);
      try {
        if (onRemoveLock) {
          await onRemoveLock();
        }
        handleClose();
      } catch (err: any) {
        setError(err?.message || 'Failed to remove lock.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleClose = () => {
    setPassphrase('');
    setConfirmPassphrase('');
    setHint(note.lockHint || '');
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '20px',
          bgcolor: '#111827',
          backgroundImage: 'radial-gradient(circle at top left, rgba(245, 158, 11, 0.1), transparent 70%)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          color: '#F9FAFB',
        },
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2.5, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box
            sx={{
              p: 0.8,
              borderRadius: '10px',
              bgcolor: 'rgba(245, 158, 11, 0.15)',
              color: '#F59E0B',
              display: 'flex',
            }}
          >
            <ShieldOutlined fontSize="small" />
          </Box>
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 700 }}>
            {isCurrentlyLocked ? 'Manage Note Security' : 'Encrypt Note Vault'}
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} sx={{ color: 'text.secondary' }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5, pt: 1.5 }}>
        <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 2.5, fontSize: '0.875rem', lineHeight: 1.5 }}>
          {isCurrentlyLocked
            ? `"${note.title}" is currently protected with AES-256-GCM encryption. You can update your password or decrypt the note permanently.`
            : `Lock "${note.title}" with client-side AES-256-GCM encryption. The contents will be encrypted before saving to disk or syncing.`}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '10px', bgcolor: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5' }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Passphrase Input */}
          <Box>
            <Typography variant="caption" sx={{ color: '#D1D5DB', fontWeight: 600, mb: 0.5, display: 'block' }}>
              {isCurrentlyLocked ? 'New Password or PIN' : 'Password or PIN'}
            </Typography>
            <TextField
              autoFocus
              fullWidth
              size="small"
              type={showPassword ? 'text' : 'password'}
              placeholder="e.g. 8492 or MySecretPass#1"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Key sx={{ color: '#F59E0B', fontSize: 18 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: '#9CA3AF' }}>
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: '10px',
                  bgcolor: 'rgba(17, 24, 39, 0.7)',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.15)' },
                  '&:hover fieldset': { borderColor: '#F59E0B' },
                },
              }}
            />
            {passphrase.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: '0.7rem' }}>
                    Strength: <strong style={{ color: strength.color }}>{strength.label}</strong>
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={strength.score}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    '& .MuiLinearProgress-bar': { bgcolor: strength.color },
                  }}
                />
              </Box>
            )}
          </Box>

          {/* Confirm Passphrase */}
          <Box>
            <Typography variant="caption" sx={{ color: '#D1D5DB', fontWeight: 600, mb: 0.5, display: 'block' }}>
              Confirm Password or PIN
            </Typography>
            <TextField
              fullWidth
              size="small"
              type={showPassword ? 'text' : 'password'}
              placeholder="Re-enter password"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              InputProps={{
                sx: {
                  borderRadius: '10px',
                  bgcolor: 'rgba(17, 24, 39, 0.7)',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.15)' },
                  '&:hover fieldset': { borderColor: '#F59E0B' },
                },
              }}
            />
          </Box>

          {/* Password Hint */}
          <Box>
            <Typography variant="caption" sx={{ color: '#D1D5DB', fontWeight: 600, mb: 0.5, display: 'block' }}>
              Password Hint (Optional)
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="e.g. Favorite street number or graduation year"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              InputProps={{
                sx: {
                  borderRadius: '10px',
                  bgcolor: 'rgba(17, 24, 39, 0.7)',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.15)' },
                  '&:hover fieldset': { borderColor: '#F59E0B' },
                },
              }}
            />
          </Box>
        </Box>

        {isCurrentlyLocked && onRemoveLock && (
          <>
            <Divider sx={{ my: 2.5, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
            <Button
              fullWidth
              variant="outlined"
              color="error"
              onClick={handleRemoveLock}
              disabled={isLoading}
              startIcon={<NoEncryptionOutlined />}
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 600,
                borderColor: 'rgba(239, 68, 68, 0.4)',
                '&:hover': {
                  borderColor: '#EF4444',
                  bgcolor: 'rgba(239, 68, 68, 0.1)',
                },
              }}
            >
              Remove Password Protection Permanently
            </Button>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, pt: 1 }}>
        <Button onClick={handleClose} sx={{ color: '#9CA3AF', textTransform: 'none', borderRadius: '8px' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleApplyLock}
          disabled={isLoading || !passphrase.trim()}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <Lock />}
          sx={{
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            color: '#0F172A',
            '&:hover': {
              background: 'linear-gradient(135deg, #FBBF24 0%, #B45309 100%)',
            },
          }}
        >
          {isCurrentlyLocked ? 'Update Password' : 'Lock & Encrypt'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
