import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Tabs,
  Tab,
  IconButton,
  InputAdornment,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Avatar,
  LinearProgress,
} from '@mui/material';
import {
  PersonOutline,
  AlternateEmail,
  EmailOutlined,
  LockOutlined,
  Visibility,
  VisibilityOff,
  CheckCircleOutline,
  ErrorOutline,
  ArrowBack,
  AdminPanelSettings,
  EditNote,
  AutoAwesome,
  SecurityOutlined,
  SendOutlined,
} from '@mui/icons-material';
import { useAuth, DEMO_USERS } from './AuthContext';

export const AuthScreen: React.FC = () => {
  const { login, register, verifyOtp, sendOtp, checkUsername, exploreDemo } = useAuth();

  // Mode: 'signin' | 'register' | 'otp'
  const [authMode, setAuthMode] = useState<'signin' | 'register' | 'otp'>('signin');

  // Sign In Form States
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register Form States
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message?: string;
  }>({ checking: false, available: null });

  // OTP Verification States
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [otpTimer, setOtpTimer] = useState<number>(60);
  const [isResending, setIsResending] = useState(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // General Status States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Debounced username checking
  useEffect(() => {
    if (!regUsername || regUsername.length < 3) {
      setUsernameStatus({ checking: false, available: null });
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus({ checking: true, available: null });
      const result = await checkUsername(regUsername);
      setUsernameStatus({
        checking: false,
        available: result.available,
        message: result.message,
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [regUsername, checkUsername]);

  // Countdown timer for OTP
  useEffect(() => {
    let interval: any;
    if (authMode === 'otp' && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [authMode, otpTimer]);

  // Calculate password strength
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'transparent' };
    let score = 0;
    if (pass.length >= 6) score += 25;
    if (pass.length >= 10) score += 25;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 25;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 25;

    if (score <= 25) return { score: 25, label: 'Weak', color: '#EF4444' };
    if (score <= 50) return { score: 50, label: 'Fair', color: '#F59E0B' };
    if (score <= 75) return { score: 75, label: 'Good', color: '#3B82F6' };
    return { score: 100, label: 'Strong', color: '#10B981' };
  };

  const passwordStrength = getPasswordStrength(regPassword);
  const passwordsMatch = regConfirmPassword.length > 0 && regPassword === regConfirmPassword;
  const passwordsMismatch = regConfirmPassword.length > 0 && regPassword !== regConfirmPassword;

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    const res = await login(loginIdentifier, loginPassword);
    setIsLoading(false);
    if (!res.success) {
      setErrorMsg(res.message || 'Unable to sign in. Please verify your credentials.');
    }
  };

  // Handle Register Submit -> initiates OTP verification
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Passwords do not match. Please ensure both passwords match.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (usernameStatus.available === false) {
      setErrorMsg(usernameStatus.message || 'Please choose an available username.');
      return;
    }

    setIsLoading(true);
    const res = await register({
      name: regName,
      username: regUsername,
      email: regEmail,
      password: regPassword,
      confirmPassword: regConfirmPassword,
    });
    setIsLoading(false);

    if (res.success) {
      setDevOtpCode(res.devOtp || null);
      setSuccessMsg(`A 6-digit verification code was sent to ${regEmail}`);
      setAuthMode('otp');
      setOtpTimer(60);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } else {
      setErrorMsg(res.message || 'Registration failed. Please check your information.');
    }
  };

  // Handle OTP digit input
  const handleOtpDigitChange = (index: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);

    // Auto-advance to next input
    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 6 digits entered
    if (char && index === 5 && newDigits.every((d) => d.length === 1)) {
      handleVerifyOtp(newDigits.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < pasteData.length; i++) {
      newDigits[i] = pasteData[i];
    }
    setOtpDigits(newDigits);

    if (pasteData.length === 6) {
      handleVerifyOtp(pasteData);
    } else {
      otpInputRefs.current[pasteData.length]?.focus();
    }
  };

  // Verify OTP submission
  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join('');
    if (code.length < 6) {
      setErrorMsg('Please enter all 6 digits of your verification code.');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);
    const res = await verifyOtp({
      email: regEmail,
      code,
    });
    setIsLoading(false);

    if (!res.success) {
      setErrorMsg(res.message || 'Verification failed. Please check the code and try again.');
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (otpTimer > 0 || isResending) return;
    setIsResending(true);
    setErrorMsg(null);

    const res = await sendOtp({
      email: regEmail,
      name: regName,
      username: regUsername,
      type: 'register',
    });
    setIsResending(false);

    if (res.success) {
      setDevOtpCode(res.devOtp || null);
      setSuccessMsg(`Fresh verification code sent to ${regEmail}`);
      setOtpTimer(60);
    } else {
      setErrorMsg(res.message || 'Failed to resend code');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#0B0F19',
        p: { xs: 2, sm: 4 },
        '&::before': {
          content: '""',
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, rgba(168, 85, 247, 0.08) 50%, transparent 70%)',
          top: '-15%',
          left: '-10%',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          width: '550px',
          height: '550px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.14) 0%, rgba(59, 130, 246, 0.08) 50%, transparent 70%)',
          bottom: '-15%',
          right: '-10%',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        },
      }}
    >
      <Paper
        elevation={24}
        sx={{
          width: '100%',
          maxWidth: 480,
          borderRadius: '24px',
          bgcolor: 'rgba(15, 22, 38, 0.85)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(99, 102, 241, 0.1)',
          p: { xs: 3, sm: 4.5 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Brand Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            sx={{
              display: 'inline-flex',
              p: 1.2,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              mb: 1.5,
              boxShadow: '0 8px 16px rgba(99, 102, 241, 0.25)',
            }}
          >
            <Box
              component="img"
              src="/logo.svg"
              alt="Nexus Notes Logo"
              sx={{ width: 40, height: 40, borderRadius: '10px' }}
            />
          </Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #FFFFFF 30%, #94A3B8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Nexus Notes
          </Typography>
          <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.5, fontSize: '0.8rem' }}>
            Local-First Collaborative Intelligence Platform
          </Typography>
        </Box>

        {/* Global Feedback Banners */}
        {errorMsg && (
          <Alert
            severity="error"
            onClose={() => setErrorMsg(null)}
            sx={{
              mb: 2.5,
              borderRadius: '12px',
              bgcolor: 'rgba(239, 68, 68, 0.12)',
              color: '#FCA5A5',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              fontSize: '0.85rem',
            }}
          >
            {errorMsg}
          </Alert>
        )}

        {successMsg && (
          <Alert
            severity="success"
            onClose={() => setSuccessMsg(null)}
            sx={{
              mb: 2.5,
              borderRadius: '12px',
              bgcolor: 'rgba(16, 185, 129, 0.12)',
              color: '#6EE7B7',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.85rem',
            }}
          >
            {successMsg}
          </Alert>
        )}

        {/* MODE 1: SIGN IN */}
        {authMode === 'signin' && (
          <Box>
            {/* Tabs for Mode Switch */}
            <Tabs
              value={0}
              onChange={(_, val) => {
                if (val === 1) {
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setAuthMode('register');
                }
              }}
              variant="fullWidth"
              sx={{
                minHeight: 40,
                mb: 3,
                bgcolor: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '12px',
                p: 0.5,
                '& .MuiTabs-indicator': {
                  display: 'none',
                },
                '& .MuiTab-root': {
                  minHeight: 36,
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  textTransform: 'none',
                  color: '#94A3B8',
                  transition: 'all 0.2s ease',
                  '&.Mui-selected': {
                    color: '#FFFFFF',
                    bgcolor: 'rgba(99, 102, 241, 0.25)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                  },
                },
              }}
            >
              <Tab label="Sign In" />
              <Tab label="Create Account" />
            </Tabs>

            <Box component="form" onSubmit={handleLoginSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                size="medium"
                label="Email or Username"
                placeholder="alex@nexus.internal or alex"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AlternateEmail sx={{ color: '#6366F1', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                  },
                }}
              />

              <TextField
                fullWidth
                size="medium"
                type={showLoginPassword ? 'text' : 'password'}
                label="Password"
                placeholder="Enter your password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ color: '#6366F1', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowLoginPassword((prev) => !prev)}
                        edge="end"
                        sx={{ color: '#94A3B8' }}
                      >
                        {showLoginPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                  },
                }}
              />

              <Button
                type="submit"
                variant="contained"
                disabled={isLoading}
                fullWidth
                sx={{
                  py: 1.4,
                  mt: 0.5,
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                    boxShadow: '0 12px 28px rgba(99, 102, 241, 0.45)',
                  },
                }}
              >
                {isLoading ? <CircularProgress size={22} color="inherit" /> : 'Sign In to Workspace'}
              </Button>
            </Box>

            {/* Quick Demo Profiles Section */}
            <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <Typography variant="caption" sx={{ color: '#64748B', px: 1, fontWeight: 600 }}>
                OR QUICK ACCESS AS DEMO USER
              </Typography>
            </Divider>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {DEMO_USERS.map((user) => {
                const roleIcon =
                  user.id === 'user-alex' ? (
                    <AdminPanelSettings sx={{ fontSize: 15 }} />
                  ) : user.id === 'user-elena' ? (
                    <EditNote sx={{ fontSize: 15 }} />
                  ) : (
                    <Visibility sx={{ fontSize: 15 }} />
                  );
                const roleName = user.id === 'user-alex' ? 'Owner' : user.id === 'user-elena' ? 'Editor' : 'Viewer';

                return (
                  <Paper
                    key={user.id}
                    elevation={0}
                    onClick={() => exploreDemo(user)}
                    sx={{
                      p: 1.2,
                      borderRadius: '12px',
                      bgcolor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        bgcolor: 'rgba(99, 102, 241, 0.12)',
                        borderColor: '#6366F1',
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                      <Avatar src={user.avatarUrl} sx={{ width: 30, height: 30, bgcolor: user.color, fontSize: '0.8rem' }}>
                        {user.name[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#E2E8F0', fontSize: '0.85rem' }}>
                          {user.name} <span style={{ color: '#64748B', fontWeight: 400 }}>@{user.username || user.name.toLowerCase()}</span>
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.72rem' }}>
                          {user.email}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      icon={roleIcon}
                      label={roleName}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        bgcolor: 'rgba(99, 102, 241, 0.15)',
                        color: '#A5B4FC',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                      }}
                    />
                  </Paper>
                );
              })}
            </Box>
          </Box>
        )}

        {/* MODE 2: CREATE ACCOUNT (WITH USERNAME + CONFIRM PASSWORD) */}
        {authMode === 'register' && (
          <Box>
            <Tabs
              value={1}
              onChange={(_, val) => {
                if (val === 0) {
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setAuthMode('signin');
                }
              }}
              variant="fullWidth"
              sx={{
                minHeight: 40,
                mb: 3,
                bgcolor: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '12px',
                p: 0.5,
                '& .MuiTabs-indicator': { display: 'none' },
                '& .MuiTab-root': {
                  minHeight: 36,
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  textTransform: 'none',
                  color: '#94A3B8',
                  '&.Mui-selected': {
                    color: '#FFFFFF',
                    bgcolor: 'rgba(99, 102, 241, 0.25)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                  },
                },
              }}
            >
              <Tab label="Sign In" />
              <Tab label="Create Account" />
            </Tabs>

            <Box component="form" onSubmit={handleRegisterSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.8 }}>
              {/* Full Name */}
              <TextField
                fullWidth
                size="small"
                label="Full Name"
                placeholder="e.g. Maya Lin"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutline sx={{ color: '#6366F1', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'rgba(255, 255, 255, 0.03)' },
                }}
              />

              {/* Username with live availability validation */}
              <TextField
                fullWidth
                size="small"
                label="Select Username"
                placeholder="unique_username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                required
                helperText={
                  usernameStatus.checking
                    ? 'Checking availability...'
                    : usernameStatus.message
                    ? usernameStatus.message
                    : 'Letters, numbers, and underscores (3-20 chars)'
                }
                error={usernameStatus.available === false}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography sx={{ color: '#6366F1', fontWeight: 700, fontSize: '0.9rem' }}>@</Typography>
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      {usernameStatus.checking && <CircularProgress size={16} sx={{ color: '#6366F1' }} />}
                      {!usernameStatus.checking && usernameStatus.available === true && (
                        <CheckCircleOutline sx={{ color: '#10B981', fontSize: 18 }} />
                      )}
                      {!usernameStatus.checking && usernameStatus.available === false && (
                        <ErrorOutline sx={{ color: '#EF4444', fontSize: 18 }} />
                      )}
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'rgba(255, 255, 255, 0.03)' },
                }}
              />

              {/* Email */}
              <TextField
                fullWidth
                size="small"
                type="email"
                label="Email Address"
                placeholder="name@company.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlined sx={{ color: '#6366F1', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'rgba(255, 255, 255, 0.03)' },
                }}
              />

              {/* Password with Strength Meter */}
              <Box>
                <TextField
                  fullWidth
                  size="small"
                  type={showRegPassword ? 'text' : 'password'}
                  label="Password"
                  placeholder="At least 6 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined sx={{ color: '#6366F1', fontSize: 18 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowRegPassword((prev) => !prev)}
                          edge="end"
                          sx={{ color: '#94A3B8' }}
                        >
                          {showRegPassword ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'rgba(255, 255, 255, 0.03)' },
                  }}
                />
                {regPassword && (
                  <Box sx={{ mt: 0.8, px: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                      <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.7rem' }}>
                        Password Strength
                      </Typography>
                      <Typography variant="caption" sx={{ color: passwordStrength.color, fontWeight: 700, fontSize: '0.7rem' }}>
                        {passwordStrength.label}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={passwordStrength.score}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        bgcolor: 'rgba(255, 255, 255, 0.08)',
                        '& .MuiLinearProgress-bar': { bgcolor: passwordStrength.color },
                      }}
                    />
                  </Box>
                )}
              </Box>

              {/* Confirm Password */}
              <TextField
                fullWidth
                size="small"
                type={showConfirmPassword ? 'text' : 'password'}
                label="Confirm Password"
                placeholder="Re-enter your password"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                required
                error={passwordsMismatch}
                helperText={
                  passwordsMatch
                    ? 'Passwords match'
                    : passwordsMismatch
                    ? 'Passwords do not match'
                    : ''
                }
                FormHelperTextProps={{
                  sx: { color: passwordsMatch ? '#10B981 !important' : '#EF4444' },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SecurityOutlined sx={{ color: '#6366F1', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      {passwordsMatch && <CheckCircleOutline sx={{ color: '#10B981', fontSize: 18, mr: 0.5 }} />}
                      <IconButton
                        size="small"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        edge="end"
                        sx={{ color: '#94A3B8' }}
                      >
                        {showConfirmPassword ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'rgba(255, 255, 255, 0.03)' },
                }}
              />

              <Button
                type="submit"
                variant="contained"
                disabled={isLoading || passwordsMismatch || usernameStatus.available === false}
                fullWidth
                sx={{
                  py: 1.3,
                  mt: 1,
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #4F46E5 0%, #9333EA 100%)',
                  },
                }}
              >
                {isLoading ? <CircularProgress size={22} color="inherit" /> : 'Continue to OTP Verification'}
              </Button>
            </Box>
          </Box>
        )}

        {/* MODE 3: 6-DIGIT OTP VERIFICATION */}
        {authMode === 'otp' && (
          <Box sx={{ textAlign: 'center' }}>
            <Box
              sx={{
                display: 'inline-flex',
                p: 1.5,
                borderRadius: '50%',
                bgcolor: 'rgba(99, 102, 241, 0.12)',
                color: '#6366F1',
                mb: 2,
              }}
            >
              <SendOutlined sx={{ fontSize: 32 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#FFFFFF', mb: 0.5 }}>
              Verify Your Email
            </Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8', mb: 2, fontSize: '0.85rem' }}>
              We sent a 6-digit verification code to <strong style={{ color: '#E2E8F0' }}>{regEmail}</strong>
            </Typography>

            {/* Dev helper callout */}
            {devOtpCode && (
              <Box
                sx={{
                  p: 1.5,
                  mb: 3,
                  borderRadius: '12px',
                  bgcolor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px dashed rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="caption" sx={{ color: '#6EE7B7', fontWeight: 700, display: 'block' }}>
                    DEV MODE OTP CODE
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#FFFFFF', fontWeight: 800, letterSpacing: '0.15em' }}>
                    {devOtpCode}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const digits = devOtpCode.split('');
                    setOtpDigits(digits);
                    handleVerifyOtp(devOtpCode);
                  }}
                  sx={{
                    borderColor: 'rgba(16, 185, 129, 0.4)',
                    color: '#6EE7B7',
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    fontWeight: 700,
                  }}
                >
                  Auto-Fill
                </Button>
              </Box>
            )}

            {/* 6 Individual Digit Inputs */}
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 3 }}>
              {otpDigits.map((digit, index) => (
                <TextField
                  key={index}
                  inputRef={(el) => (otpInputRefs.current[index] = el)}
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleOtpKeyDown(index, e)}
                  onPaste={handleOtpPaste}
                  inputProps={{
                    maxLength: 1,
                    style: {
                      textAlign: 'center',
                      fontSize: '1.4rem',
                      fontWeight: 700,
                      padding: '12px 0',
                      width: '44px',
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      bgcolor: 'rgba(255, 255, 255, 0.04)',
                      borderColor: digit ? '#6366F1' : 'rgba(255, 255, 255, 0.1)',
                      '&.Mui-focused': {
                        borderColor: '#8B5CF6',
                        boxShadow: '0 0 12px rgba(139, 92, 246, 0.3)',
                      },
                    },
                  }}
                />
              ))}
            </Box>

            {/* Submit Verification */}
            <Button
              variant="contained"
              disabled={isLoading || otpDigits.some((d) => !d)}
              onClick={() => handleVerifyOtp()}
              fullWidth
              sx={{
                py: 1.3,
                mb: 2,
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.95rem',
                textTransform: 'none',
                background: 'linear-gradient(135deg, #6366F1 0%, #10B981 100%)',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
              }}
            >
              {isLoading ? <CircularProgress size={22} color="inherit" /> : 'Confirm & Enter Workspace'}
            </Button>

            {/* Resend Timer & Actions */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              <Button
                startIcon={<ArrowBack sx={{ fontSize: 16 }} />}
                onClick={() => {
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setAuthMode('register');
                }}
                sx={{ color: '#94A3B8', fontSize: '0.8rem', textTransform: 'none' }}
              >
                Edit Info
              </Button>

              <Button
                disabled={otpTimer > 0 || isResending}
                onClick={handleResendOtp}
                sx={{
                  color: otpTimer > 0 ? '#64748B' : '#6366F1',
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  fontWeight: 600,
                }}
              >
                {otpTimer > 0 ? `Resend code in ${otpTimer}s` : 'Resend Code'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Guest Demo Preview Option */}
        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.06)', textAlign: 'center' }}>
          <Button
            size="small"
            onClick={() => exploreDemo(DEMO_USERS[0])}
            startIcon={<AutoAwesome sx={{ fontSize: 15, color: '#A855F7' }} />}
            sx={{
              color: '#94A3B8',
              fontSize: '0.78rem',
              textTransform: 'none',
              '&:hover': { color: '#E2E8F0', bgcolor: 'rgba(255, 255, 255, 0.04)' },
            }}
          >
            Explore Demo Workspace as Alex Rivera
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};
