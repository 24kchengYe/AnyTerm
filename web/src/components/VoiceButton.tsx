/**
 * Voice input button — records audio via MediaRecorder and sends as base64.
 */
import React from 'react';
import { Mic, MicOff, Loader } from 'lucide-react';
import { useMediaRecorder } from '../hooks/useMediaRecorder.js';

interface VoiceButtonProps {
  onVoiceData: (audio: string, format: string) => void;
  disabled?: boolean;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ onVoiceData, disabled }) => {
  const { recording, processing, error, toggleRecording } = useMediaRecorder({ onRecorded: onVoiceData });

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={toggleRecording}
        disabled={disabled || processing}
        title={error || (recording ? 'Stop recording' : 'Start voice input')}
        aria-label={recording ? 'Stop recording' : 'Start voice input'}
        style={{
          background: error ? '#f7768e33' : recording ? '#f7768e' : '#1f2335',
          border: `1px solid ${error ? '#f7768e' : recording ? '#f7768e' : '#292d3e'}`,
          borderRadius: 6, padding: '6px 10px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center',
          color: recording ? '#1a1b26' : error ? '#f7768e' : '#a9b1d6',
          opacity: disabled ? 0.4 : 1,
          transition: 'all 0.2s',
          animation: recording ? 'pulse 1.5s infinite' : 'none',
        }}
      >
        {processing ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : recording ? <MicOff size={16} /> : <Mic size={16} />}
      </button>
      {error && (
        <div style={{
          position: 'absolute', bottom: '100%', right: 0, marginBottom: 4,
          background: '#1f2335', border: '1px solid #f7768e44', borderRadius: 4,
          padding: '4px 8px', fontSize: 11, color: '#f7768e', whiteSpace: 'nowrap',
        }}>
          {error}
        </div>
      )}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
