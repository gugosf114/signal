import React from 'react';

export default function UserProfileModal({ user, scansLeft, onClose, onLogout }) {
  if (!user) return null;

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: "'Syne', sans-serif",
        cursor: 'pointer',
        touchAction: 'none'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0E1014',
          border: '1px solid #2A2D34',
          borderRadius: 8,
          width: '100%',
          maxWidth: 400,
          padding: 32,
          position: 'relative',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          cursor: 'default',
          pointerEvents: 'auto'
        }}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16, right: 16,
            background: 'none', border: 'none',
            color: '#A8A498', fontSize: 24,
            cursor: 'pointer', lineHeight: 1
          }}
        >
          ×
        </button>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img 
            src={user.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} 
            alt="Avatar" 
            style={{ width: 80, height: 80, borderRadius: '50%', marginBottom: 16, border: '2px solid #2A2D34' }} 
          />
          <h2 style={{ color: '#E8E4DC', margin: '0 0 4px 0', fontSize: 20, fontWeight: 700 }}>
            {user.user_metadata?.full_name || 'Anonymous User'}
          </h2>
          <div style={{ color: '#A8A498', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
            {user.email || 'No email provided'}
          </div>
        </div>

        <div style={{
          background: '#14161A',
          border: '1px solid #2A2D34',
          borderRadius: 6,
          padding: 20,
          marginBottom: 24
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#A8A498', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Plan</span>
            <span style={{ color: '#C44040', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Free Beta</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#A8A498', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scans Remaining</span>
            <span style={{ color: '#E8E4DC', fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
              {scansLeft} / 10
            </span>
          </div>
          
          <div style={{ marginTop: 16, height: 4, background: '#2A2D34', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              background: '#C44040', 
              width: `${(scansLeft / 10) * 100}%`,
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        <button 
          onClick={onLogout}
          style={{
            width: '100%',
            padding: '14px',
            background: 'rgba(196, 64, 64, 0.1)',
            border: '1px solid #C44040',
            color: '#C44040',
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}