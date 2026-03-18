/**
 * Voice input button — records audio via MediaRecorder and sends as base64.
 */
import React, { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader } from 'lucide-react';

interface VoiceButtonProps {
  onVoiceData: (audio: string, format: string) => void;
  disabled?: boolean;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ onVoiceData, disabled }) => {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setProcessing(true);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        onVoiceData(base64, 'webm');
        setProcessing(false);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      setError(msg);
      setRecording(false);
      setProcessing(false);
      // Auto-clear error after 3s
      setTimeout(() => setError(null), 3000);
    }
  }, [onVoiceData]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (recording) stopRecording(); else startRecording();
  }, [recording, startRecording, stopRecording]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={handleClick}
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
