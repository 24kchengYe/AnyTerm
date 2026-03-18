/**
 * Terminal tab bar — create, switch, close, rename, export.
 * Desktop: double-click tab to rename, X to close, right-click for menu
 * Mobile: long-press tab for actions (rename/export/close)
 */
import React, { useState, useRef, useCallback } from 'react';
import { Plus, X, Terminal as TerminalIcon, Wifi, WifiOff, Settings, Download, Edit3 } from 'lucide-react';
import type { TerminalSessionInfo } from '../hooks/useTerminalWS.js';

interface TerminalTabsProps {
  sessions: TerminalSessionInfo[];
  activeId: string | null;
  connected: boolean;
  mobile: boolean;
  names: Record<string, string>;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onExport: (id: string) => void;
  onSettings?: () => void;
}

export const TerminalTabs: React.FC<TerminalTabsProps> = ({
  sessions, activeId, connected, mobile, names,
  onSelect, onCreate, onClose, onRename, onExport, onSettings,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const getTabName = (s: TerminalSessionInfo) => names[s.id] || `Terminal ${s.id.split('-')[0]}`;

  const startEdit = useCallback((id: string) => {
    setEditingId(id);
    setEditValue(names[id] || '');
    setMenuId(null);
    setTimeout(() => editRef.current?.select(), 50);
  }, [names]);

  const finishEdit = useCallback(() => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  }, [editingId, editValue, onRename]);

  const showMenu = useCallback((id: string, x: number, y: number) => {
    setMenuId(id);
    setMenuPos({ x, y });
  }, []);

  // Close menu on click outside
  const handleBackdrop = useCallback(() => setMenuId(null), []);

  const h = mobile ? 44 : 36;
  const fontSize = mobile ? 14 : 13;

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', height: h,
        background: '#13141c', borderBottom: '1px solid #292d3e',
        padding: '0 4px', gap: mobile ? 4 : 2,
        overflowX: 'auto', flexShrink: 0,
      }}>
        {/* Connection status */}
        <div style={{ padding: '0 6px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {connected ? <Wifi size={14} color="#9ece6a" /> : <WifiOff size={14} color="#f7768e" />}
        </div>

        {/* Tabs */}
        {sessions.map(s => (
          <div
            key={s.id}
            onClick={() => { if (editingId !== s.id) { onSelect(s.id); setMenuId(null); } }}
            onDoubleClick={() => startEdit(s.id)}
            onContextMenu={(e) => { e.preventDefault(); showMenu(s.id, e.clientX, e.clientY); }}
            onTouchStart={() => {
              longPressTimer.current = setTimeout(() => showMenu(s.id, 100, h + 4), 500);
            }}
            onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
            onTouchMove={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: mobile ? '6px 10px' : '4px 8px',
              borderRadius: 6, cursor: 'pointer',
              background: s.id === activeId ? '#1f2335' : 'transparent',
              color: s.id === activeId ? '#c0caf5' : '#565f89',
              fontSize, whiteSpace: 'nowrap', flexShrink: 0,
              minHeight: mobile ? 36 : 28,
              transition: 'background 0.15s',
            }}
          >
            <TerminalIcon size={mobile ? 14 : 13} />

            {editingId === s.id ? (
              <input
                ref={editRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={finishEdit}
                onKeyDown={(e) => { if (e.key === 'Enter') finishEdit(); if (e.key === 'Escape') setEditingId(null); }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#292d3e', border: '1px solid #7aa2f7', borderRadius: 3,
                  color: '#c0caf5', fontSize, padding: '1px 4px', width: 80, outline: 'none',
                }}
                autoFocus
              />
            ) : (
              <span>{names[s.id] || `T${s.id.split('-')[0]}`}</span>
            )}

            {/* Close button (desktop only, not when editing) */}
            {!mobile && editingId !== s.id && (
              <button
                onClick={(e) => { e.stopPropagation(); onClose(s.id); }}
                style={{
                  background: 'none', border: 'none', color: 'inherit',
                  cursor: 'pointer', padding: 2, borderRadius: 3,
                  display: 'flex', alignItems: 'center', opacity: 0.4,
                }}
                onMouseOver={(e) => { (e.currentTarget).style.opacity = '1'; }}
                onMouseOut={(e) => { (e.currentTarget).style.opacity = '0.4'; }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}

        {/* New terminal */}
        <button onClick={onCreate} title="New terminal"
          style={{
            background: 'none', border: '1px solid #292d3e', color: '#565f89',
            cursor: 'pointer', padding: mobile ? '6px 12px' : '4px 8px',
            borderRadius: 6, display: 'flex', alignItems: 'center',
            fontSize, flexShrink: 0, minHeight: mobile ? 36 : 28,
          }}>
          <Plus size={mobile ? 16 : 13} />
        </button>

        <div style={{ flex: 1 }} />

        {onSettings && (
          <button onClick={onSettings} title="Settings"
            style={{
              background: 'none', border: 'none', color: '#565f89',
              cursor: 'pointer', padding: 6, borderRadius: 4,
              display: 'flex', alignItems: 'center', flexShrink: 0,
            }}>
            <Settings size={mobile ? 16 : 14} />
          </button>
        )}
      </div>

      {/* Context menu (right-click / long-press) */}
      {menuId && (
        <div onClick={handleBackdrop} style={{ position: 'fixed', inset: 0, zIndex: 1500 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: mobile ? 20 : menuPos.x,
              top: mobile ? h + 4 : menuPos.y,
              background: '#1f2335', border: '1px solid #292d3e',
              borderRadius: 8, padding: 4, minWidth: 160,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              zIndex: 1501,
            }}
          >
            <MenuItem icon={<Edit3 size={14} />} label="Rename" onClick={() => startEdit(menuId)} />
            <MenuItem icon={<Download size={14} />} label="Export Output" onClick={() => { onExport(menuId); setMenuId(null); }} />
            <div style={{ height: 1, background: '#292d3e', margin: '4px 0' }} />
            <MenuItem icon={<X size={14} />} label="Close" danger onClick={() => { onClose(menuId); setMenuId(null); }} />
          </div>
        </div>
      )}
    </>
  );
};

const MenuItem: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }> = ({ icon, label, onClick, danger }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
      padding: '8px 12px', background: 'none', border: 'none',
      color: danger ? '#f7768e' : '#a9b1d6', fontSize: 13,
      cursor: 'pointer', borderRadius: 4, textAlign: 'left',
    }}
    onMouseOver={(e) => { e.currentTarget.style.background = '#292d3e'; }}
    onMouseOut={(e) => { e.currentTarget.style.background = 'none'; }}
  >
    {icon}
    {label}
  </button>
);
