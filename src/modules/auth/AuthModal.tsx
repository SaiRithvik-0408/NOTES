import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
  Box,
  Typography,
  Divider,
  Avatar,
  Paper,
  Tabs,
  Tab,
  useTheme,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  LockOutlined,
  PersonOutline,
  EmailOutlined,
  Visibility,
  VisibilityOff,
  AlternateEmail,
  CheckCircleOutline,
  SecurityOutlined,
  Close,
} from '@mui/icons-material';
import { useAuth } from './AuthContext';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const { currentUser, login, register, verifyOtp, checkUsername, logout } = useAuth();
  const [tab, setTab] = useState(0); // 0: Login, 1: Register, 2: OTP
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register Fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP Fields
  const [otpCode, setOtpCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  // States
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  // Check username availability
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await checkUsername(username);
      setUsernameAvailable(res.available);
    }, 400);
    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);
    const res = await login(identifier, loginPassword);
    setIsLoading(false);
    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.message || 'Login failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    const res = await register({
      name,
      username,
      email,
      password,
      confirmPassword,
    });
    setIsLoading(false);

    if (res.success) {
      setDevOtp(res.devOtp || null);
      if (res.verificationToken) setVerificationToken(res.verificationToken);
      setTab(2); // Go to OTP
    } else {
      setErrorMsg(res.message || 'Registration failed');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);
    const res = await verifyOtp({
      email,
      code: otpCode,
      verificationToken: verificationToken || undefined,
    });
    setIsLoading(false);
    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.message || 'Verification failed');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '20px',
          bgcolor: theme.palette.mode === 'dark' ? '#0F1626' : '#FFFFFF',
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pt: 2, pb: 1, position: 'relative' }}>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', top: 12, right: 12, color: 'text.secondary' }}
        >
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <Box component="img" src="/logo.svg" alt="Nexus Notes Logo" sx={{ width: 44, height: 44, borderRadius: '10px' }} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Nexus Authentication
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Local-first collaborative intelligence platform
        </Typography>
      </DialogTitle>

      <DialogContent>
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '10px', fontSize: '0.8rem' }} onClose={() => setErrorMsg(null)}>
            {errorMsg}
          </Alert>
        )}

        {/* Current User Status Banner if logged in */}
        {currentUser && (
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: '12px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(79, 70, 229, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar src={currentUser.avatarUrl} sx={{ width: 34, height: 34, bgcolor: currentUser.color }}>
                {currentUser.name[0]}
              </Avatar>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {currentUser.name}{' '}
                  {currentUser.username && (
                    <span style={{ color: '#94A3B8', fontWeight: 400 }}>@{currentUser.username}</span>
                  )}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.72rem' }}>
                  {currentUser.email}
                </Typography>
              </Box>
            </Box>
            <Button size="small" color="error" onClick={logout} sx={{ fontSize: '0.72rem', textTransform: 'none' }}>
              Sign Out
            </Button>
          </Paper>
        )}

        {/* Tab Selector */}
        {tab !== 2 && (
          <Tabs
            value={tab}
            onChange={(_, v) => {
              setErrorMsg(null);
              setTab(v);
            }}
            variant="fullWidth"
            sx={{ minHeight: 36, mb: 2, '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.82rem', textTransform: 'none', fontWeight: 700 } }}
          >
            <Tab label="Sign In" />
            <Tab label="Register" />
          </Tabs>
        )}

        {/* SIGN IN TAB */}
        {tab === 0 && (
          <Box component="form" onSubmit={handleLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              size="small"
              placeholder="Username or Work Email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              InputProps={{
                startAdornment: <AlternateEmail sx={{ fontSize: 18, color: 'text.secondary', mr: 1 }} />,
              }}
            />

            <TextField
              size="small"
              type={showLoginPassword ? 'text' : 'password'}
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
              InputProps={{
                startAdornment: <LockOutlined sx={{ fontSize: 18, color: 'text.secondary', mr: 1 }} />,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowLoginPassword(!showLoginPassword)} edge="end">
                      {showLoginPassword ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              disabled={isLoading}
              fullWidth
              sx={{
                mt: 0.5,
                py: 1,
                fontWeight: 700,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #6366F1, #A855F7)',
              }}
            >
              {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>
        )}

        {/* REGISTER TAB */}
        {tab === 1 && (
          <Box component="form" onSubmit={handleRegister} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              size="small"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              InputProps={{
                startAdornment: <PersonOutline sx={{ fontSize: 18, color: 'text.secondary', mr: 1 }} />,
              }}
            />

            <TextField
              size="small"
              placeholder="Select Username (e.g. jdoe)"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              required
              error={usernameAvailable === false}
              helperText={usernameAvailable === false ? 'Username taken' : usernameAvailable === true ? 'Username available' : ''}
              FormHelperTextProps={{
                sx: { color: usernameAvailable ? '#10B981 !important' : undefined },
              }}
              InputProps={{
                startAdornment: <Typography sx={{ fontSize: 16, color: '#6366F1', mr: 0.5, fontWeight: 700 }}>@</Typography>,
                endAdornment: usernameAvailable === true ? <CheckCircleOutline sx={{ fontSize: 18, color: '#10B981' }} /> : null,
              }}
            />

            <TextField
              size="small"
              type="email"
              placeholder="Work Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              InputProps={{
                startAdornment: <EmailOutlined sx={{ fontSize: 18, color: 'text.secondary', mr: 1 }} />,
              }}
            />

            <TextField
              size="small"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (min. 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              InputProps={{
                startAdornment: <LockOutlined sx={{ fontSize: 18, color: 'text.secondary', mr: 1 }} />,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              size="small"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              error={confirmPassword.length > 0 && password !== confirmPassword}
              helperText={confirmPassword.length > 0 && password !== confirmPassword ? 'Passwords do not match' : ''}
              InputProps={{
                startAdornment: <SecurityOutlined sx={{ fontSize: 18, color: 'text.secondary', mr: 1 }} />,
              }}
            />

            <Button
              type="submit"
              variant="contained"
              disabled={isLoading || (confirmPassword.length > 0 && password !== confirmPassword)}
              fullWidth
              sx={{
                mt: 0.5,
                py: 1,
                fontWeight: 700,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #6366F1, #A855F7)',
              }}
            >
              {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Continue to OTP Verification'}
            </Button>
          </Box>
        )}

        {/* OTP TAB */}
        {tab === 2 && (
          <Box component="form" onSubmit={handleVerifyOtp} sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Enter the 6-digit verification code sent to <strong>{email}</strong>
            </Typography>

            {import.meta.env.DEV && devOtp && (
              <Alert severity="info" sx={{ borderRadius: '10px', fontSize: '0.8rem' }}>
                Dev OTP Code: <strong>{devOtp}</strong>
              </Alert>
            )}

            <TextField
              size="medium"
              placeholder="123456"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              inputProps={{
                maxLength: 6,
                style: { textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.3em', fontWeight: 700 },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              disabled={isLoading || otpCode.length !== 6}
              fullWidth
              sx={{
                py: 1,
                fontWeight: 700,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #6366F1, #10B981)',
              }}
            >
              {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Verify Code & Sign In'}
            </Button>

            <Button size="small" onClick={() => setTab(1)} sx={{ textTransform: 'none', color: 'text.secondary' }}>
              Back to Edit Info
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};
