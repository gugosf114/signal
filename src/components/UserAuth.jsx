import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SocialLogin } from '@capgo/capacitor-social-login';
import UserProfileModal from './UserProfileModal';

// Setup Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-key';
export const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Native Social Login
SocialLogin.initialize({
  google: {
    webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  }
}).catch(console.error);

export default function UserAuth({ onUserLoad }) {
  const [user, setUser] = useState(null);
  const [scansLeft, setScansLeft] = useState(10);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (supabaseUrl.includes('mock.supabase.co')) {
      setLoading(false);
      return;
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchScansLeft(session.user);
      else setLoading(false);
      onUserLoad(session?.user ?? null);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchScansLeft(session.user);
      onUserLoad(session?.user ?? null);
    });

    return () => subscription?.unsubscribe();
  }, [onUserLoad]);

  const fetchScansLeft = async (currentUser) => {
    try {
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://192.168.1.65:3001';
      const res = await fetch(`${proxyUrl}/api/user/scans?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setScansLeft(10 - (data.monthly_scans || 0));
      }
    } catch (err) {
      console.error('Failed to fetch scans', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (supabaseUrl.includes('mock.supabase.co')) {
      // Mock login for prototype
      const mockUser = {
        id: 'mock-user-123',
        email: 'alex.investor@signal.app',
        user_metadata: {
          full_name: 'Alex Investor',
          avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SignalUser'
        }
      };
      setUser(mockUser);
      onUserLoad(mockUser);
      fetchScansLeft(mockUser);
      return;
    }

    try {
      // 1. Trigger Native Google Login
      const result = await SocialLogin.login({
        provider: 'google',
        options: {
          clientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
        },
      });

      if (result.result.token) {
        // 2. Pass Google ID token to Supabase
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: result.result.token,
        });

        if (error) throw error;
        console.log('Successfully logged in natively!', data.user);
      }
    } catch (err) {
      console.error('Native login failed, falling back to Web OAuth', err);
      // Fallback to web OAuth if native plugin isn't available (e.g., in a browser)
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
    }
  };

  const handleLogout = async () => {
    setShowProfile(false);
    if (supabaseUrl.includes('mock.supabase.co')) {
      setUser(null);
      onUserLoad(null);
      return;
    }
    await supabase.auth.signOut();
  };

  if (loading) return null;

  return (
    <>
      <div style={{
        position: 'absolute',
        top: 16,
        right: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: "'Syne', sans-serif",
        zIndex: 50
      }}>
        {user ? (
          <>
            <div style={{
              background: 'rgba(196, 64, 64, 0.1)',
              border: '1px solid #C44040',
              color: '#E8E4DC',
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              cursor: 'pointer'
            }} onClick={() => setShowProfile(true)}>
              {scansLeft} SCANS LEFT
            </div>
            <button 
              onClick={() => setShowProfile(true)}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                borderRadius: '50%', outline: 'none',
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <img src={user.user_metadata?.avatar_url} alt="Avatar" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #2A2D34' }} />
            </button>
          </>
        ) : (
          <button 
            title="Sign in with Google"
            onClick={handleLogin} 
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#E8E4DC',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              transition: 'transform 0.1s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </button>
        )}
      </div>

      {showProfile && (
        <UserProfileModal 
          user={user} 
          scansLeft={scansLeft} 
          onClose={() => setShowProfile(false)} 
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
