import { useState, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';
import { OWNER_EMAIL, DAILY_MESSAGE_LIMIT } from '../../lib/config';

// ── SECTION ──
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--text-muted)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  SETTINGS MODAL — dati reali dell'account e del locale
// ══════════════════════════════════════════════════════
export function SettingsModal({
  onClose, restaurant, userEmail = '',
  onRestaurantUpdated, reloadData, showToast,
  dishesCount = 0, ingredientsCount = 0, fixedCount = 0, totalFixed = 0,
  isDark: isDarkProp, toggleTheme: toggleThemeProp,
}) {
  const { isDark: isDarkHook, toggleTheme: toggleThemeHook } = useTheme();
  const isDark      = isDarkProp      !== undefined ? isDarkProp      : isDarkHook;
  const toggleTheme = toggleThemeProp !== undefined ? toggleThemeProp : toggleThemeHook;

  const isOwner = !!userEmail && userEmail.toLowerCase() === OWNER_EMAIL.toLowerCase();

  const venueName = restaurant?.name || '';
  const [editName,  setEditName]  = useState(false);
  const [nameInput, setNameInput] = useState(venueName);
  const [savingName, setSavingName] = useState(false);
  const logoRef = useRef(null);
  const [logoBusy, setLogoBusy] = useState(false);

  const [seedingDemo, setSeedingDemo] = useState(false);

  const [showDelete,  setShowDelete]  = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteError, setDeleteError] = useState(null);
  const [deleting,    setDeleting]    = useState(false);

  const fmtEuro = n => '€ ' + (parseFloat(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Fix 2A: aggiornano lo stato in-place (no window.location.reload → nessun
  // ritorno alla schermata di benvenuto/login).
  async function handleSaveName() {
    const name = nameInput.trim();
    if (!name || !restaurant?.id) { setEditName(false); return; }
    setSavingName(true);
    try {
      await supabase.from('restaurants').update({ name }).eq('id', restaurant.id);
      onRestaurantUpdated?.({ ...restaurant, name });
      setEditName(false);
      setSavingName(false);
      showToast?.('Nome del locale aggiornato');
    } catch {
      setSavingName(false);
      setEditName(false);
    }
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file || !restaurant?.id) return;
    setLogoBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${uid}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from('restaurant-logos').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('restaurant-logos').getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`; // cache-busting
      await supabase.from('restaurants').update({ logo_url: url }).eq('id', restaurant.id);
      onRestaurantUpdated?.({ ...restaurant, logo_url: url });
      setLogoBusy(false);
      showToast?.('Logo aggiornato');
    } catch {
      setLogoBusy(false);
    }
  }

  async function handleSeedDemo() {
    setSeedingDemo(true);
    const { seedDemoSupabase } = await import('../../lib/dataService');
    await seedDemoSupabase();
    await reloadData?.();
    setSeedingDemo(false);
    onClose?.();
    showToast?.('Dati demo caricati');
  }

  const handleLogout = async () => {
    if (window.confirm('Vuoi uscire dal tuo account?')) {
      await supabase.auth.signOut();
      window.location.reload();
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput.trim() !== venueName) {
      setDeleteError('Il nome del locale non corrisponde.');
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      // CASCADE cancella piatti, dispensa, preparazioni, costi fissi, sezioni.
      const { error } = await supabase.from('restaurants').delete().eq('id', restaurant.id);
      if (error) throw error;
      await supabase.auth.signOut();
      window.location.reload();
    } catch (err) {
      setDeleteError(err.message || 'Errore durante l\'eliminazione.');
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <span className="modal-title">⚙️ Impostazioni</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {/* IL TUO LOCALE */}
          <Section title="🏠 Il tuo locale">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {restaurant?.logo_url ? (
                <img src={restaurant.logo_url} alt="Logo" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--gold-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>👨‍🍳</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {editName ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="form-input"
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      autoFocus
                      style={{ fontSize: 16 }}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); }}
                    />
                    <button className="btn-primary" style={{ padding: '8px 12px', minHeight: 44 }} disabled={savingName} onClick={handleSaveName}>✓</button>
                    <button className="btn-secondary" style={{ padding: '8px 12px', minHeight: 44 }} onClick={() => { setEditName(false); setNameInput(venueName); }}>✕</button>
                  </div>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{venueName || 'Il tuo locale'}</p>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                      <button className="btn-link" onClick={() => { setNameInput(venueName); setEditName(true); }} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Modifica nome</button>
                      <button className="btn-link" onClick={() => logoRef.current?.click()} disabled={logoBusy} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>{logoBusy ? 'Carico…' : 'Cambia logo'}</button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} style={{ display: 'none' }} />
            <Row label="Email account">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userEmail || '—'}
              </span>
            </Row>
          </Section>

          {/* I TUOI DATI */}
          <Section title="📊 I tuoi dati">
            <Row label="Piatti nel menù"><strong style={{ fontFamily: 'var(--font-mono)' }}>{dishesCount}</strong></Row>
            <Row label="Ingredienti in dispensa"><strong style={{ fontFamily: 'var(--font-mono)' }}>{ingredientsCount}</strong></Row>
            <Row label="Voci di costo fisso"><strong style={{ fontFamily: 'var(--font-mono)' }}>{fixedCount}</strong></Row>
            <Row label="Totale costi fissi / mese"><strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>{fmtEuro(totalFixed)}</strong></Row>
          </Section>

          {/* APP */}
          <Section title="🌙 App">
            <Row label="Tema scuro">
              <button
                onClick={toggleTheme}
                aria-label="Attiva/disattiva tema scuro"
                style={{ width: 48, height: 26, borderRadius: 13, background: isDark ? 'var(--gold)' : 'var(--border-color)', border: 'none', cursor: 'pointer', transition: 'background 0.2s', position: 'relative', flexShrink: 0 }}
              >
                <div style={{ position: 'absolute', top: 3, left: isDark ? 26 : 4, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              </button>
            </Row>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Sous Chef: fino a {DAILY_MESSAGE_LIMIT} messaggi al giorno.
            </p>
          </Section>

          {/* DEMO — solo per l'account proprietario (per le dimostrazioni) */}
          {isOwner && (
            <Section title="🎬 Demo">
              <button className="btn-secondary" style={{ fontSize: 13, minHeight: 44 }} disabled={seedingDemo} onClick={handleSeedDemo}>
                {seedingDemo ? 'Carico…' : '🎬 Carica Dati Demo'}
              </button>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Sostituisce i tuoi dati con un ristorante di esempio (solo il tuo account).
              </p>
            </Section>
          )}

          {/* LOGOUT */}
          <button
            className="btn-secondary"
            onClick={handleLogout}
            style={{ width: '100%', justifyContent: 'center', minHeight: 44, color: 'var(--status-risk)', borderColor: 'var(--status-risk-bg)', marginBottom: 24 }}
          >
            🚪 Logout
          </button>

          {/* ELIMINA ACCOUNT */}
          <Section title="⚠️ Zona pericolosa">
            {!showDelete ? (
              <button
                className="btn-secondary"
                onClick={() => { setShowDelete(true); setDeleteError(null); setDeleteInput(''); }}
                style={{ fontSize: 13, minHeight: 44, color: 'var(--status-risk)', borderColor: 'var(--status-risk)' }}
              >
                🗑️ Elimina account e tutti i dati
              </button>
            ) : (
              <div style={{ background: 'var(--status-risk-bg)', border: '1px solid var(--status-risk)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
                <p style={{ fontSize: 13, color: 'var(--status-risk)', fontWeight: 700, margin: '0 0 6px' }}>Questa azione è irreversibile.</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>
                  Verranno cancellati definitivamente tutti i piatti, la dispensa, i costi fissi e le impostazioni.
                  Per confermare scrivi il nome del locale: <strong>{venueName}</strong>
                </p>
                {deleteError && <p style={{ fontSize: 12, color: 'var(--status-risk)', margin: '0 0 8px' }}>{deleteError}</p>}
                <input
                  className="form-input"
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder={venueName}
                  style={{ marginBottom: 10, fontSize: 16 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" disabled={deleting} onClick={handleDeleteAccount} style={{ background: 'var(--status-risk)', minHeight: 44 }}>
                    {deleting ? 'Elimino...' : 'Elimina definitivamente'}
                  </button>
                  <button className="btn-secondary" onClick={() => setShowDelete(false)} disabled={deleting} style={{ minHeight: 44 }}>Annulla</button>
                </div>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
