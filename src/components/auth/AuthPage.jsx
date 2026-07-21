// ══════════════════════════════════════════════════════════════
//  LITTLECHEF · AuthPage — login e registrazione
//  Registrazione: email + password + nome locale + logo facoltativo
//  in un unico flusso (signUp → riga restaurants → upload logo).
// ══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

const IT_ERRORS = {
  'Invalid login credentials':                'Email o password sbagliate. Riprova.',
  'User already registered':                  'Esiste già un account con questa email. Prova ad accedere.',
  'Password should be at least 6 characters': 'La password deve avere almeno 6 caratteri.',
  'Email not confirmed':                      'Email non ancora confermata. Controlla la casella di posta.',
};
const itError = err =>
  IT_ERRORS[err?.message] || err?.message || 'Qualcosa non ha funzionato. Riprova.';

export function AuthPage({ onAuthed, onRegistered }) {
  const [mode,      setMode]      = useState('login'); // 'login' | 'register' | 'forgot'
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [venueName, setVenueName] = useState('');
  const [logoFile,  setLogoFile]  = useState(null);
  const [error,     setError]     = useState(null);
  const [info,      setInfo]      = useState(null);
  const [busy,      setBusy]      = useState(false);

  async function handleForgot() {
    if (!email.trim()) throw new Error('Inserisci la tua email.');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    if (err) throw err;
    setInfo('Ti abbiamo inviato un\'email con il link per reimpostare la password. Controlla la posta (anche lo spam).');
  }

  async function handleLogin() {
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) throw err;
    onAuthed(data.session);
  }

  async function handleRegister() {
    if (!venueName.trim()) throw new Error('Il nome del locale è obbligatorio.');

    // 1) Account
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password });
    if (signUpErr) throw signUpErr;
    const user = signUpData.user;
    if (!signUpData.session) {
      // Conferma email attiva sul progetto: niente sessione finché non si clicca il link
      throw new Error('Account creato: controlla la tua email e clicca il link di conferma, poi accedi.');
    }

    // 2) Riga ristorante (RLS: owner_id deve essere il proprio uid)
    const { data: restaurant, error: restErr } = await supabase
      .from('restaurants')
      .insert({ owner_id: user.id, name: venueName.trim() })
      .select()
      .single();
    if (restErr) throw restErr;

    // 3) Logo facoltativo → bucket restaurant-logos/{uid}/logo.{ext}
    if (logoFile) {
      const ext  = (logoFile.name.split('.').pop() || 'png').toLowerCase();
      const path = `${user.id}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('restaurant-logos')
        .upload(path, logoFile, { upsert: true });
      if (upErr) {
        console.error('[AuthPage] Upload logo fallito (l\'account resta valido):', upErr);
      } else {
        const { data: pub } = supabase.storage.from('restaurant-logos').getPublicUrl(path);
        await supabase.from('restaurants')
          .update({ logo_url: pub.publicUrl })
          .eq('id', restaurant.id);
        restaurant.logo_url = pub.publicUrl;
      }
    }

    // Passa il ristorante appena creato ad App così la schermata di benvenuto
    // mostra subito nome e logo (nessuna rilettura, nessun race con SIGNED_IN).
    if (onRegistered) onRegistered(signUpData.session, restaurant);
    else onAuthed(signUpData.session);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if      (mode === 'login')    await handleLogin();
      else if (mode === 'register') await handleRegister();
      else                          await handleForgot();
    } catch (err) {
      console.error('[AuthPage]', err);
      setError(itError(err));
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === 'register';
  const isForgot   = mode === 'forgot';

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: 'var(--bg-card)',
        borderRadius: 16, border: '1px solid var(--border-color)',
        padding: '32px 28px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {/* LOGO / TITOLO */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>👨‍🍳</div>
          <h1 style={{
            fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700,
            margin: 0, color: 'var(--text-primary)',
          }}>
            LittleChef
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 0' }}>
            {isRegister ? 'Crea il tuo account'
              : isForgot ? 'Recupera la password'
              : 'Bentornato, accedi al tuo locale'}
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--status-risk-bg, rgba(220,38,38,0.08))',
            borderLeft: '3px solid var(--status-risk, #dc2626)',
            borderRadius: 8, padding: '10px 12px', marginBottom: 16,
            fontSize: 13, color: 'var(--status-risk, #dc2626)',
          }}>
            {error}
          </div>
        )}

        {info && (
          <div style={{
            background: 'var(--gold-light, rgba(230,157,67,0.12))',
            borderLeft: '3px solid var(--gold)',
            borderRadius: 8, padding: '10px 12px', marginBottom: 16,
            fontSize: 13, color: 'var(--gold-text, var(--text-primary))', lineHeight: 1.5,
          }}>
            {info}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isRegister && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                Nome del locale *
              </label>
              <input
                value={venueName}
                onChange={e => setVenueName(e.target.value)}
                placeholder="Es: Trattoria da Mario"
                required
                style={{
                  width: '100%', padding: '11px 14px', boxSizing: 'border-box',
                  border: '1px solid var(--border-color)', borderRadius: 10,
                  background: 'var(--bg-input)', color: 'var(--text-primary)',
                  fontSize: 14, outline: 'none', minHeight: 44,
                }}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nome@esempio.it"
              required
              autoComplete="email"
              style={{
                width: '100%', padding: '11px 14px', boxSizing: 'border-box',
                border: '1px solid var(--border-color)', borderRadius: 10,
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                fontSize: 14, outline: 'none', minHeight: 44,
              }}
            />
          </div>

          {!isForgot && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={isRegister ? 'Almeno 6 caratteri' : '••••••••'}
              required
              minLength={6}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              style={{
                width: '100%', padding: '11px 14px', boxSizing: 'border-box',
                border: '1px solid var(--border-color)', borderRadius: 10,
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                fontSize: 14, outline: 'none', minHeight: 44,
              }}
            />
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError(null); setInfo(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 12, cursor: 'pointer', padding: '6px 0 0', marginLeft: 'auto', display: 'block' }}
              >
                Password dimenticata?
              </button>
            )}
          </div>
          )}

          {isRegister && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                Logo del locale (facoltativo)
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={e => setLogoFile(e.target.files?.[0] || null)}
                style={{ fontSize: 13, color: 'var(--text-secondary)' }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 6, padding: '13px', minHeight: 48,
              background: busy ? 'var(--bg-secondary)' : 'var(--gold)',
              color: busy ? 'var(--text-muted)' : '#fff',
              border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer', transition: 'background 0.15s',
            }}
          >
            {busy
              ? 'Un attimo...'
              : isRegister ? 'Crea account'
              : isForgot ? 'Invia link di recupero'
              : 'Accedi'}
          </button>
        </form>

        {/* SWITCH LOGIN/REGISTER/FORGOT */}
        {isForgot ? (
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', margin: '18px 0 0' }}>
            <button
              onClick={() => { setMode('login'); setError(null); setInfo(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--gold)', fontWeight: 700, cursor: 'pointer', fontSize: 13, padding: 0 }}
            >
              ← Torna al login
            </button>
          </p>
        ) : (
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', margin: '18px 0 0' }}>
          {isRegister ? 'Hai già un account?' : 'Non hai ancora un account?'}{' '}
          <button
            onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(null); setInfo(null); }}
            style={{
              background: 'none', border: 'none', color: 'var(--gold)',
              fontWeight: 700, cursor: 'pointer', fontSize: 13, padding: 0,
            }}
          >
            {isRegister ? 'Accedi' : 'Registrati'}
          </button>
        </p>
        )}
      </div>
    </div>
  );
}

export default AuthPage;
