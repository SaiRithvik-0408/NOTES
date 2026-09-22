import React from 'react';
import {
  Box,
  Chip,
  Tooltip,
  IconButton,
  CircularProgress,
  Typography,
  useTheme,
} from '@mui/material';
import {
  CloudDone,
  CloudSync,
  CloudOff,
  Warning,
  Refresh,
  Wifi,
  WifiOff,
} from '@mui/icons-material';
import { SyncStatus } from '../../types/sync';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  onForceSync: () => void;
  onToggleSimulatedOffline?: () => void;
  isSimulatedOffline?: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  status,
  onForceSync,
  onToggleSimulatedOffline,
  isSimulatedOffline = false,
}) => {
  const theme = useTheme();

  const getStatusConfig = () => {
    if (isSimulatedOffline || !status.isOnline) {
      return {
        label: '● Saved locally',
        color: '#F59E0B', // Amber
        bg: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        icon: <CloudOff sx={{ fontSize: 16, color: '#F59E0B' }} />,
        tooltip: 'Working offline. All changes are saved locally to IndexedDB and queued for sync.',
      };
    }

    switch (status.state) {
      case 'syncing':
        return {
          label: '☁ Syncing...',
          color: '#6366F1', // Indigo
          bg: 'rgba(99, 102, 241, 0.12)',
          borderColor: 'rgba(99, 102, 241, 0.3)',
          icon: <CircularProgress size={12} sx={{ color: '#6366F1' }} />,
          tooltip: 'Synchronizing mutations with remote server...',
        };
      case 'conflict':
        return {
          label: '⚠ Conflict detected',
          color: '#EF4444', // Red
          bg: 'rgba(239, 68, 68, 0.12)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          icon: <Warning sx={{ fontSize: 16, color: '#EF4444' }} />,
          tooltip: 'A version conflict was detected. Click to resolve.',
        };
      case 'saved_locally':
        return {
          label: '● Saved locally',
          color: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.12)',
          borderColor: 'rgba(245, 158, 11, 0.3)',
          icon: <CloudOff sx={{ fontSize: 16, color: '#F59E0B' }} />,
          tooltip: 'Saved locally in IndexedDB.',
        };
      case 'synced':
      default:
        return {
          label: '✓ Synced',
          color: '#10B981', // Emerald
          bg: 'rgba(16, 185, 129, 0.12)',
          borderColor: 'rgba(16, 185, 129, 0.3)',
          icon: <CloudDone sx={{ fontSize: 16, color: '#10B981' }} />,
          tooltip: status.lastSyncedAt ? `All changes synchronized at ${status.lastSyncedAt}` : 'All changes synchronized',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={config.tooltip} arrow>
        <Chip
          icon={config.icon}
          label={config.label}
          size="small"
          onClick={onForceSync}
          sx={{
            cursor: 'pointer',
            backgroundColor: config.bg,
            color: config.color,
            border: `1px solid ${config.borderColor}`,
            fontWeight: 600,
            fontSize: '0.78rem',
            height: 26,
            transition: 'all 0.2s ease',
            '&:hover': {
              filter: 'brightness(1.15)',
              transform: 'scale(1.02)',
            },
          }}
        />
      </Tooltip>

      {/* Manual offline simulator toggle for testing/demo */}
      {onToggleSimulatedOffline && (
        <Tooltip title={isSimulatedOffline ? 'Simulating Offline (Click to go Online)' : 'Online (Click to simulate Offline)'}>
          <IconButton
            size="small"
            onClick={onToggleSimulatedOffline}
            sx={{
              p: 0.5,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: '6px',
              color: isSimulatedOffline ? '#F59E0B' : '#10B981',
              backgroundColor: isSimulatedOffline ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
            }}
          >
            {isSimulatedOffline ? <WifiOff sx={{ fontSize: 16 }} /> : <Wifi sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};
