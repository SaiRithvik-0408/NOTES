import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Chip,
  Collapse,
  Slider,
  Alert,
  CircularProgress,
  keyframes,
} from '@mui/material';
import {
  Mic,
  MicOff,
  FiberManualRecord,
  PlayArrow,
  Pause,
  Stop,
  DeleteOutline,
  PostAdd,
  AutoAwesome,
  FileDownloadOutlined,
  Close,
  GraphicEq,
  ContentCopy,
  ExpandMore,
  ExpandLess,
  Check,
  Speed,
} from '@mui/icons-material';
import { AudioMemo } from '../../types/note';
import { useAudioRecorder, formatAudioDuration } from '../../utils/audioRecorder';
import { extractKeyTakeaways, summarizeDocument } from '../../utils/aiAssistant';

// Pulse animation for recording badge
const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.15); }
`;

/* =========================================================================
   1. Voice Memo Recorder Modal
   ========================================================================= */

interface VoiceMemoRecorderDialogProps {
  open: boolean;
  onClose: () => void;
  onSaveMemo: (title: string, audioData: string, duration: number, transcript: string) => void;
}

export const VoiceMemoRecorderDialog: React.FC<VoiceMemoRecorderDialogProps> = ({
  open,
  onClose,
  onSaveMemo,
}) => {
  const {
    isRecording,
    isPaused,
    duration,
    audioLevels,
    liveTranscript,
    error,
    isSupported,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(`Voice Memo - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      startRecording();
    } else {
      cancelRecording();
    }
  }, [open]);

  const handleFinish = async () => {
    setIsProcessing(true);
    const result = await stopRecording();
    setIsProcessing(false);

    if (result) {
      onSaveMemo(
        title.trim() || `Voice Memo - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        result.audioData,
        result.duration,
        result.transcript
      );
      onClose();
    }
  };

  const handleClose = () => {
    cancelRecording();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px',
          bgcolor: '#0F172A',
          backgroundImage: 'radial-gradient(circle at top, rgba(16, 185, 129, 0.12) 0%, transparent 70%)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
          color: '#F8FAFC',
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              p: 0.8,
              borderRadius: '12px',
              bgcolor: 'rgba(16, 185, 129, 0.15)',
              color: '#10B981',
              display: 'flex',
            }}
          >
            <GraphicEq />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
              Record Voice Memo
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              Real-time Speech Transcription & Audio Capture
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={handleClose} sx={{ color: '#94A3B8' }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ py: 2 }}>
        {error ? (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
            {error}
          </Alert>
        ) : null}

        {/* Memo Title Input */}
        <TextField
          fullWidth
          size="small"
          placeholder="Memo Title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{
            mb: 3,
            bgcolor: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '12px',
            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
            '&:hover fieldset': { borderColor: '#10B981 !important' },
            '&.Mui-focused fieldset': { borderColor: '#10B981 !important' },
          }}
        />

        {/* Timer & Status Badge */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.8,
              py: 0.4,
              px: 1.6,
              borderRadius: '20px',
              bgcolor: isPaused ? 'rgba(148, 163, 184, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${isPaused ? 'rgba(148, 163, 184, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}
          >
            <FiberManualRecord
              sx={{
                fontSize: 10,
                color: isPaused ? '#94A3B8' : '#EF4444',
                animation: isPaused ? 'none' : `${pulse} 1.5s infinite ease-in-out`,
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 700, color: isPaused ? '#94A3B8' : '#F87171' }}>
              {isPaused ? 'PAUSED' : 'RECORDING'}
            </Typography>
          </Box>

          <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#F1F5F9' }}>
            {formatAudioDuration(duration)}
          </Typography>
        </Box>

        {/* 24-Bar Glowing Equalizer Waveform */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            height: 64,
            my: 2.5,
            px: 2,
            borderRadius: '16px',
            bgcolor: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          {audioLevels.map((level, i) => (
            <Box
              key={i}
              sx={{
                flex: 1,
                maxWidth: 8,
                borderRadius: 4,
                height: `${Math.max(6, level * 54)}px`,
                bgcolor: isPaused
                  ? '#64748B'
                  : `hsl(${145 + i * 3.5}, 85%, ${50 + level * 20}%)`,
                transition: 'height 0.07s ease',
                boxShadow: isPaused ? 'none' : '0 0 6px rgba(16, 185, 129, 0.4)',
              }}
            />
          ))}
        </Box>

        {/* Live Streaming Speech Transcript Card */}
        <Box
          sx={{
            p: 2,
            borderRadius: '14px',
            bgcolor: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            minHeight: 80,
            maxHeight: 140,
            overflowY: 'auto',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
            <AutoAwesome sx={{ fontSize: 14, color: '#10B981' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Live AI Transcript
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: liveTranscript ? '#E2E8F0' : '#64748B', fontStyle: liveTranscript ? 'normal' : 'italic', lineHeight: 1.6 }}>
            {liveTranscript || 'Listening to microphone... Speak clearly to see real-time transcription.'}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2.5, pt: 1, justifyContent: 'space-between' }}>
        <Button onClick={handleClose} sx={{ color: '#94A3B8', textTransform: 'none', borderRadius: '10px' }}>
          Cancel
        </Button>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {isRecording && !isPaused ? (
            <Button
              variant="outlined"
              onClick={pauseRecording}
              startIcon={<Pause />}
              sx={{
                borderRadius: '12px',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: '#CBD5E1',
                textTransform: 'none',
                '&:hover': { borderColor: '#CBD5E1', bgcolor: 'rgba(255, 255, 255, 0.05)' },
              }}
            >
              Pause
            </Button>
          ) : (
            <Button
              variant="outlined"
              onClick={resumeRecording}
              startIcon={<PlayArrow />}
              sx={{
                borderRadius: '12px',
                borderColor: 'rgba(16, 185, 129, 0.4)',
                color: '#10B981',
                textTransform: 'none',
                '&:hover': { borderColor: '#10B981', bgcolor: 'rgba(16, 185, 129, 0.1)' },
              }}
            >
              Resume
            </Button>
          )}

          <Button
            variant="contained"
            disabled={isProcessing || duration < 1}
            onClick={handleFinish}
            startIcon={isProcessing ? <CircularProgress size={16} color="inherit" /> : <Stop />}
            sx={{
              borderRadius: '12px',
              fontWeight: 700,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#FFFFFF',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #34D399 0%, #047857 100%)',
              },
            }}
          >
            {isProcessing ? 'Saving Memo...' : 'Finish & Save Memo'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

/* =========================================================================
   2. Voice Memo Card Player
   ========================================================================= */

interface VoiceMemoCardProps {
  memo: AudioMemo;
  onDelete: (id: string) => void;
  onInsertTranscript: (text: string) => void;
}

export const VoiceMemoCard: React.FC<VoiceMemoCardProps> = ({
  memo,
  onDelete,
  onInsertTranscript,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (_: any, val: number | number[]) => {
    const target = val as number;
    if (audioRef.current) {
      audioRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const handleSpeedChange = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleCopyTranscript = () => {
    navigator.clipboard.writeText(memo.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateSummary = async () => {
    if (aiSummary) {
      setAiSummary(null);
      return;
    }
    setIsSummarizing(true);
    try {
      const summary = await summarizeDocument(memo.transcript);
      setAiSummary(summary);
    } catch {
      setAiSummary('Could not generate AI summary.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = memo.audioData;
    link.download = `${memo.title.replace(/\s+/g, '_')}.webm`;
    link.click();
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: '16px',
        bgcolor: 'rgba(30, 41, 59, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(10px)',
        transition: 'all 0.2s ease',
        '&:hover': {
          bgcolor: 'rgba(30, 41, 59, 0.6)',
          borderColor: 'rgba(16, 185, 129, 0.3)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        },
      }}
    >
      <audio ref={audioRef} src={memo.audioData} preload="metadata" />

      {/* Header Info */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              p: 0.6,
              borderRadius: '8px',
              bgcolor: 'rgba(16, 185, 129, 0.15)',
              color: '#10B981',
              display: 'flex',
            }}
          >
            <GraphicEq sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#F8FAFC' }}>
              {memo.title}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              {new Date(memo.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* Playback Speed Button */}
          <Tooltip title="Playback Speed">
            <Button
              size="small"
              onClick={handleSpeedChange}
              sx={{
                minWidth: 42,
                px: 0.8,
                py: 0.2,
                borderRadius: '8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#10B981',
                bgcolor: 'rgba(16, 185, 129, 0.1)',
                textTransform: 'none',
              }}
            >
              {playbackRate}x
            </Button>
          </Tooltip>

          {/* Delete Button */}
          <Tooltip title="Delete Memo">
            <IconButton size="small" onClick={() => onDelete(memo.id)} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Player Scrubber & Time */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <IconButton
          onClick={togglePlay}
          sx={{
            bgcolor: '#10B981',
            color: '#0F172A',
            width: 38,
            height: 38,
            '&:hover': { bgcolor: '#34D399' },
          }}
        >
          {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
        </IconButton>

        <Box sx={{ flex: 1 }}>
          <Slider
            size="small"
            value={currentTime}
            max={memo.duration || 1}
            onChange={handleSeek}
            sx={{
              color: '#10B981',
              height: 4,
              '& .MuiSlider-thumb': {
                width: 12,
                height: 12,
                '&:hover, &.Mui-focusVisible': {
                  boxShadow: '0 0 0 8px rgba(16, 185, 129, 0.16)',
                },
              },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: -0.5 }}>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.7rem' }}>
              {formatAudioDuration(currentTime)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.7rem' }}>
              {formatAudioDuration(memo.duration)}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Action Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pt: 0.5 }}>
        <Button
          size="small"
          variant="text"
          onClick={() => setShowTranscript((prev) => !prev)}
          endIcon={showTranscript ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
          sx={{ color: '#94A3B8', textTransform: 'none', fontSize: '0.75rem', py: 0.3 }}
        >
          {showTranscript ? 'Hide Transcript' : 'View Transcript'}
        </Button>

        <Tooltip title="Insert transcript into note content">
          <Button
            size="small"
            variant="outlined"
            startIcon={<PostAdd sx={{ fontSize: '15px !important' }} />}
            onClick={() => onInsertTranscript(memo.transcript)}
            sx={{
              py: 0.2,
              px: 1,
              borderRadius: '8px',
              fontSize: '0.72rem',
              textTransform: 'none',
              color: '#38BDF8',
              borderColor: 'rgba(56, 189, 248, 0.3)',
              '&:hover': { borderColor: '#38BDF8', bgcolor: 'rgba(56, 189, 248, 0.08)' },
            }}
          >
            Insert into Note
          </Button>
        </Tooltip>

        <Tooltip title="Summarize transcript with AI">
          <Button
            size="small"
            variant="outlined"
            disabled={isSummarizing}
            startIcon={isSummarizing ? <CircularProgress size={12} color="inherit" /> : <AutoAwesome sx={{ fontSize: '14px !important' }} />}
            onClick={handleGenerateSummary}
            sx={{
              py: 0.2,
              px: 1,
              borderRadius: '8px',
              fontSize: '0.72rem',
              textTransform: 'none',
              color: '#A855F7',
              borderColor: 'rgba(168, 85, 247, 0.3)',
              '&:hover': { borderColor: '#A855F7', bgcolor: 'rgba(168, 85, 247, 0.08)' },
            }}
          >
            {aiSummary ? 'Hide AI Summary' : 'AI Summary'}
          </Button>
        </Tooltip>

        <Tooltip title="Download Audio (.webm)">
          <IconButton size="small" onClick={handleDownload} sx={{ color: '#94A3B8', '&:hover': { color: '#F1F5F9' } }}>
            <FileDownloadOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Collapsible Transcript Area */}
      <Collapse in={showTranscript}>
        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: '10px', bgcolor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
              Full Transcript
            </Typography>
            <Tooltip title={copied ? 'Copied!' : 'Copy Transcript'}>
              <IconButton size="small" onClick={handleCopyTranscript} sx={{ color: '#94A3B8' }}>
                {copied ? <Check sx={{ fontSize: 14, color: '#10B981' }} /> : <ContentCopy sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="body2" sx={{ color: '#CBD5E1', fontSize: '0.82rem', lineHeight: 1.6 }}>
            {memo.transcript || 'No spoken words recognized.'}
          </Typography>
        </Box>
      </Collapse>

      {/* Collapsible AI Summary Area */}
      <Collapse in={Boolean(aiSummary)}>
        {aiSummary && (
          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: '10px', bgcolor: 'rgba(88, 28, 135, 0.2)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.8 }}>
              <AutoAwesome sx={{ fontSize: 15, color: '#C084FC' }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#C084FC', textTransform: 'uppercase' }}>
                AI Memo Insights
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#F3E8FF', fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {aiSummary}
            </Typography>
          </Box>
        )}
      </Collapse>
    </Paper>
  );
};

/* =========================================================================
   3. Voice Memos Shelf (Collapsible Container for All Memos)
   ========================================================================= */

interface VoiceMemosShelfProps {
  memos: AudioMemo[];
  onOpenRecorder: () => void;
  onDeleteMemo: (id: string) => void;
  onInsertTranscript: (text: string) => void;
}

export const VoiceMemosShelf: React.FC<VoiceMemosShelfProps> = ({
  memos,
  onOpenRecorder,
  onDeleteMemo,
  onInsertTranscript,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!memos || memos.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          py: 0.8,
          px: 1.2,
          borderRadius: '12px',
          bgcolor: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.12)' },
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GraphicEq sx={{ fontSize: 18, color: '#10B981' }} />
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#10B981' }}>
            Voice Memos & Audio Transcripts
          </Typography>
          <Chip
            label={memos.length}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.7rem',
              fontWeight: 700,
              bgcolor: 'rgba(16, 185, 129, 0.2)',
              color: '#34D399',
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Button
            size="small"
            startIcon={<Mic sx={{ fontSize: '15px !important' }} />}
            onClick={(e) => {
              e.stopPropagation();
              onOpenRecorder();
            }}
            sx={{
              fontSize: '0.72rem',
              textTransform: 'none',
              fontWeight: 700,
              color: '#10B981',
              py: 0.2,
              px: 1,
              borderRadius: '8px',
              bgcolor: 'rgba(16, 185, 129, 0.15)',
              '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.25)' },
            }}
          >
            Record Memo
          </Button>
          <IconButton size="small" sx={{ color: '#10B981' }}>
            {isOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={isOpen}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1.5 }}>
          {memos.map((memo) => (
            <VoiceMemoCard
              key={memo.id}
              memo={memo}
              onDelete={onDeleteMemo}
              onInsertTranscript={onInsertTranscript}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};
