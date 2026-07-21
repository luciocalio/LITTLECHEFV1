// ══════════════════════════════════════════════════════════════
//  LITTLECHEF · ResetPassword — imposta nuova password
//  Mostrata quando Supabase rileva un link di recupero
//  (evento PASSWORD_RECOVERY). Aggiorna la password dell'utente
//  già autenticato dal token del link.
// ══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState(null);
  const [busy,     setBusy]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (password.length < 6) { setError('La password deve avere almeno 6 caratteri.'); return; }
    if (password !== confirm) { setError('Le due password non coincidono.'); return; }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      onDone();
    } catch (err) {
      setError(err.message || 'Errore durante l\'aggiornamento della password.');
      setBusy(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', boxSizing: 'border-box',
    border: '1px solid var(--border-color)', borderRadius: 10,
    background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: 14, outline: 'none', minHeight: 44,
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', padding: '32px 28px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔑</div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Nuova password
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 0' }}>
            Scegli una nuova password per il tuo account
          </p>
        </div>

        {error && (
          <div style={{ background: 'var(--status-risk-bg, rgba(220,38,38,0.08))', borderLeft: '3px solid var(--status-risk, #dc2626)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 13, color: 'var(--status-risk, #dc2626)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nuova password (min 6 caratteri)" required minLength={6} autoComplete="new-password" style={inputStyle} />
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Ripeti la password" required minLength={6} autoComplete="new-password" style={inputStyle} />
          <button type="submit" disabled={busy} style={{ marginTop: 6, padding: '13px', minHeight: 48, background: busy ? 'var(--bg-secondary)' : 'var(--gold)', color: busy ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? 'Aggiorno...' : 'Salva nuova password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;
