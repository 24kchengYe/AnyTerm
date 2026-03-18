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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
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

        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, [onVoiceData]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [recording, startRecording, stopRecording]);

  return (
    <button
      onClick={handleClick}
      disabled={disabled || processing}
      title={recording ? 'Stop recording' : 'Start voice input'}
      style={{
        background: recording ? '#f7768e' : '#1f2335',
        border: `1px solid ${recording ? '#f7768e' : '#292d3e'}`,
        borderRadius: 6,
        padding: '6px 10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        color: recording ? '#1a1b26' : '#a9b1d6',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.2s',
        animation: recording ? 'pulse 1.5s infinite' : 'none',
      }}
    >
      {processing ? <Loader size={16} className="animate-spin" /> : recording ? <MicOff size={16} /> : <Mic size={16} />}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </button>
  );
};
