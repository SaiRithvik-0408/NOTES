import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Chip,
  Alert,
  CircularProgress,
  keyframes,
} from '@mui/material';
import {
  Lock,
  LockOpen,
  Visibility,
  VisibilityOff,
  Security,
  Key,
  InfoOutlined,
} from '@mui/icons-material';
import { Note } from '../../types/note';
import { decryptNoteContent, EncryptedVaultPayload } from '../../utils/cryptoVault';

interface NoteVaultLockScreenProps {
  note: Note;
  onUnlocked: (decryptedContent: string, passphrase: string) => void;
}

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
`;

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 25px rgba(245, 158, 11, 0.25); }
  50% { box-shadow: 0 0 45px rgba(245, 158, 11, 0.5); }
`;

export const NoteVaultLockScreen: React.FC<NoteVaultLockScreenProps> = ({ note, onUnlocked }) => {
  const [passphrase, setPassphrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passphrase.trim()) {
      setError('Please enter your password or PIN.');
      triggerShake();
      return;
    }

    setIsDecrypting(true);
    setError(null);

    try {
      // Find payload: either from note.encryptedPayload or parsed from note.content
      let payload: EncryptedVaultPayload;
      if (note.encryptedPayload) {
        payload = JSON.parse(note.encryptedPayload);
      } else {
        payload = JSON.parse(note.content);
      }

      const decrypted = await decryptNoteContent(payload, passphrase);
      onUnlocked(decrypted, passphrase);
    } catch (err: any) {
      setError(err?.message || 'Incorrect password or PIN. Decryption failed.');
      triggerShake();
    } finally {
      setIsDecrypting(false);
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);
  };

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, sm: 4 },
        minHeight: '70vh',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 480,
          width: '100%',
          p: { xs: 3.5, sm: 4.5 },
          borderRadius: '24px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          textAlign: 'center',
          animation: isShaking ? `${shake} 0.5s ease-in-out` : undefined,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, transparent 60%)',
            pointerEvents: 'none',
          },
        }}
      >
        {/* Lock Shield Icon */}
        <Box
          sx={{
            width: 72,
            height: 72,
            mx: 'auto',
            mb: 2.5,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            color: '#0F172A',
            animation: `${pulseGlow} 3s infinite ease-in-out`,
          }}
        >
          <Lock sx={{ fontSize: 36 }} />
        </Box>

        {/* Title & Badge */}
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#F8FAFC', mb: 0.8 }}>
          {note.title || 'Protected Note'}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
          <Chip
            icon={<Security sx={{ fontSize: '14px !important', color: '#F59E0B !important' }} />}
            label="AES-256-GCM Encrypted"
            size="small"
            sx={{
              bgcolor: 'rgba(245, 158, 11, 0.15)',
              color: '#FBBF24',
              fontWeight: 600,
              fontSize: '0.75rem',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          />
          <Chip
            label="Zero-Knowledge"
            size="small"
            sx={{
              bgcolor: 'rgba(99, 102, 241, 0.15)',
              color: '#A5B4FC',
              fontWeight: 600,
              fontSize: '0.75rem',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}
          />
        </Box>

        <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3, lineHeight: 1.6 }}>
          This document is sealed with end-to-end client-side encryption. Enter your master PIN or passphrase to decrypt and edit.
        </Typography>

        {/* Password Hint if provided */}
        {note.lockHint && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.8,
              py: 0.8,
              px: 2,
              mb: 2.5,
              borderRadius: '12px',
              bgcolor: 'rgba(255, 255, 255, 0.04)',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
            }}
          >
            <Key sx={{ fontSize: 16, color: '#F59E0B' }} />
            <Typography variant="caption" sx={{ color: '#CBD5E1', fontWeight: 500 }}>
              Password Hint: <strong style={{ color: '#FBBF24' }}>{note.lockHint}</strong>
            </Typography>
          </Box>
        )}

        {/* Error Alert */}
        {error && (
          <Alert
            severity="error"
            variant="filled"
            onClose={() => setError(null)}
            sx={{
              mb: 2.5,
              borderRadius: '12px',
              bgcolor: 'rgba(239, 68, 68, 0.9)',
              color: '#FFFFFF',
              fontSize: '0.85rem',
              textAlign: 'left',
            }}
          >
            {error}
          </Alert>
        )}

        {/* Decryption Form */}
        <Box component="form" onSubmit={handleUnlock} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            autoFocus
            fullWidth
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter Vault PIN or Password..."
            value={passphrase}
            onChange={(e) => {
              setPassphrase(e.target.value);
              if (error) setError(null);
            }}
            disabled={isDecrypting}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Key sx={{ color: 'rgba(245, 158, 11, 0.8)', fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    sx={{ color: 'text.secondary' }}
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                borderRadius: '14px',
                bgcolor: 'rgba(15, 23, 42, 0.6)',
                '& fieldset': { borderColor: 'rgba(245, 158, 11, 0.3)' },
                '&:hover fieldset': { borderColor: '#F59E0B !important' },
                '&.Mui-focused fieldset': { borderColor: '#F59E0B !important' },
              },
            }}
          />

          <Button
            type="submit"
            variant="contained"
            disabled={isDecrypting || !passphrase.trim()}
            startIcon={isDecrypting ? <CircularProgress size={18} color="inherit" /> : <LockOpen />}
            sx={{
              py: 1.3,
              borderRadius: '14px',
              fontWeight: 700,
              fontSize: '0.95rem',
              textTransform: 'none',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: '#0F172A',
              boxShadow: '0 8px 20px rgba(245, 158, 11, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #FBBF24 0%, #B45309 100%)',
                boxShadow: '0 10px 25px rgba(245, 158, 11, 0.4)',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(255, 255, 255, 0.12)',
                color: 'rgba(255, 255, 255, 0.3)',
              },
            }}
          >
            {isDecrypting ? 'Decrypting Vault...' : 'Unlock Note'}
          </Button>
        </Box>

        {/* Security Notice */}
        <Box
          sx={{
            mt: 3.5,
            pt: 2.5,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            textAlign: 'left',
          }}
        >
          <InfoOutlined sx={{ fontSize: 16, color: '#64748B', flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: '#64748B', lineHeight: 1.4 }}>
            Your master passphrase is never transmitted or saved. If forgotten, encrypted content cannot be recovered by anyone.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};
