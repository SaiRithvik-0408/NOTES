import React, { useState } from 'react';
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
} from '@mui/material';
import {
  LockOutlined,
  PersonOutline,
  EmailOutlined,
  VpnKeyOutlined,
  AdminPanelSettings,
  EditNote,
  Visibility,
} from '@mui/icons-material';
import { useAuth, DEMO_USERS } from './AuthContext';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const { currentUser, login, register, switchUser, logout } = useAuth();
  const [tab, setTab] = useState(0); // 0: Login, 1: Register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 0) {
      await login(email, password);
    } else {
      await register(name, email, password);
    }
    onClose();
  };

  const handleQuickDemoSwitch = (user: typeof DEMO_USERS[0]) => {
    switchUser(user);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
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
      <DialogTitle sx={{ textAlign: 'center', pt: 2, pb: 1 }}>
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
        {/* Current User Status Banner if logged in */}
        {currentUser && (
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: '10px',
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(79, 70, 229, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar src={currentUser.avatarUrl} sx={{ width: 32, height: 32, bgcolor: currentUser.color }}>
                {currentUser.name[0]}
              </Avatar>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {currentUser.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.muted' }}>
                  {currentUser.email}
                </Typography>
              </Box>
            </Box>
            <Button size="small" color="error" onClick={logout} sx={{ fontSize: '0.72rem' }}>
              Sign Out
            </Button>
          </Paper>
        )}

        {/* 1-Click Demo Profiles */}
        <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', display: 'block', mb: 1 }}>
          Quick Demo Accounts (1-Click Switch)
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.5 }}>
          {DEMO_USERS.map((user) => {
            const isSelected = currentUser?.id === user.id;
            const role = user.id === 'user-alex' ? 'Owner' : user.id === 'user-elena' ? 'Editor' : 'Viewer';
            const icon = user.id === 'user-alex' ? <AdminPanelSettings sx={{ fontSize: 16 }} /> : user.id === 'user-elena' ? <EditNote sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />;

            return (
              <Paper
                key={user.id}
                elevation={0}
                onClick={() => handleQuickDemoSwitch(user)}
                sx={{
                  p: 1.2,
                  borderRadius: '8px',
                  border: isSelected ? '1px solid #6366F1' : `1px solid ${theme.palette.divider}`,
                  bgcolor: isSelected
                    ? theme.palette.mode === 'dark'
                      ? 'rgba(99, 102, 241, 0.15)'
                      : 'rgba(79, 70, 229, 0.08)'
                    : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    borderColor: '#6366F1',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar src={user.avatarUrl} sx={{ width: 28, height: 28, bgcolor: user.color, fontSize: '0.8rem' }}>
                    {user.name[0]}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {user.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.muted', fontSize: '0.7rem' }}>
                      {user.email}
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  icon={icon}
                  label={role}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    bgcolor: isSelected ? '#6366F1' : undefined,
                    color: isSelected ? '#FFFFFF' : undefined,
                  }}
                />
              </Paper>
            );
          })}
        </Box>

        <Divider sx={{ my: 2 }}>
          <Typography variant="caption" sx={{ color: 'text.muted' }}>
            OR SIGN IN WITH CREDENTIALS
          </Typography>
        </Divider>

        {/* Tab Selector */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{ minHeight: 36, mb: 2, '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.8rem' } }}
        >
          <Tab label="Sign In" />
          <Tab label="Register" />
        </Tabs>

        {/* Auth Form */}
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {tab === 1 && (
            <TextField
              size="small"
              placeholder="Your Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              InputProps={{
                startAdornment: <PersonOutline sx={{ fontSize: 18, color: 'text.secondary', mr: 1 }} />,
              }}
            />
          )}

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
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            InputProps={{
              startAdornment: <VpnKeyOutlined sx={{ fontSize: 18, color: 'text.secondary', mr: 1 }} />,
            }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{
              mt: 1,
              py: 1,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #6366F1, #A855F7)',
            }}
          >
            {tab === 0 ? 'Sign In' : 'Create Account'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
