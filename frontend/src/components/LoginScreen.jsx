import { useEffect } from 'react';

const GOOGLE_CLIENT_ID = '815667009720-7msnh25aivncp17sotc5q5gjkefdrlge.apps.googleusercontent.com';

export function LoginScreen({ onLogin }) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window._googleInitialized) return;
      window._googleInitialized = true;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            const res = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential }),
            });
            const data = await res.json();
            if (data.token) {
              localStorage.setItem('autor_token', data.token);
              localStorage.setItem('autor_user', JSON.stringify(data.user));
              onLogin(data.user);
            }
          } catch (e) {
            console.error('Login error', e);
          }
        },
      });

      window.google.accounts.id.renderButton(
        document.getElementById('google-btn'),
        { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill', width: 280 }
      );
    };

    return () => document.body.removeChild(script);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: '#07070f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 32, fontFamily: '-apple-system, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: '#fff', letterSpacing: '-2px' }}>
          Autor<span style={{ color: '#7c5cfc' }}>.AI</span>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, marginTop: 8 }}>
          Plataforma de criação de conteúdo com inteligência artificial
        </p>
      </div>

      <div style={{
        background: '#111120', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '40px 48px', display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: 24, minWidth: 340,
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#fff', fontWeight: 600, fontSize: 18, margin: 0 }}>Entrar na plataforma</p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>
            Use sua conta Google para acessar
          </p>
        </div>

        <div id="google-btn" />

        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center', lineHeight: 1.6 }}>
          Ao entrar, você concorda com os{' '}
          <a href="/termos" style={{ color: 'rgba(124,92,252,0.7)' }}>Termos de Uso</a>
          {' '}e a{' '}
          <a href="/privacidade" style={{ color: 'rgba(124,92,252,0.7)' }}>Política de Privacidade</a>
        </p>
      </div>
    </div>
  );
}
