import { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';

const DEFAULT_SETTINGS = {
  restaurantName: 'Il mio Ristorante',
  email: '',
  foodCostTarget: 30,
  subscriptionStatus: 'active',
};

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('lc-settings') || '{}') };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(s) {
  localStorage.setItem('lc-settings', JSON.stringify(s));
}

export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);
  const update = (key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  };
  return { settings, update };
}

// ── SECTION ──
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--text-muted)', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
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
//  SETTINGS MODAL
// ══════════════════════════════════════════════════════
export function SettingsModal({ onClose, restaurant, onOpenScanner, isDark: isDarkProp, toggleTheme: toggleThemeProp }) {
  const { settings, update } = useSettings();
  const { isDark: isDarkHook, toggleTheme: toggleThemeHook } = useTheme();
  const isDark      = isDarkProp      !== undefined ? isDarkProp      : isDarkHook;
  const toggleTheme = toggleThemeProp !== undefined ? toggleThemeProp : toggleThemeHook;
  const [editName,  setEditName]  = useState(false);
  const [nameInput, setNameInput] = useState(settings.restaurantName);
  const [confirmUnsub, setConfirmUnsub] = useState(false);

  // ── Eliminazione account e dati ──
  const venueName = restaurant?.name || '';
  const [showDelete,   setShowDelete]   = useState(false);
  const [deleteInput,  setDeleteInput]  = useState('');
  const [deleteError,  setDeleteError]  = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteInput.trim() !== venueName) {
      setDeleteError('Il nome del locale non corrisponde.');
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      // Elimina la riga restaurants: CASCADE cancella piatti, dispensa,
      // preparazioni, costi fissi, sezioni e contatori collegati.
      const { error } = await supabase.from('restaurants').delete().eq('id', restaurant.id);
      if (error) throw error;
      await supabase.auth.signOut();
      window.location.reload();
    } catch (err) {
      setDeleteError(err.message || 'Errore durante l\'eliminazione.');
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Vuoi uscire dal tuo account?')) {
      await supabase.auth.signOut();
      window.location.reload();
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

          {/* PROFILO */}
          <Section title="👤 Profilo">
            <Row label="Email">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
                {settings.email || '—'}
              </span>
            </Row>
            <Row label="Password">
              <span style={{ color: 'var(--text-muted)', letterSpacing: 3, fontSize: 14 }}>••••••••</span>
            </Row>
          </Section>

          {/* LOCALE */}
          <Section title="🏠 Locale">
            {editName ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') { update('restaurantName', nameInput.trim()); setEditName(false); } }}
                />
                <button className="btn-primary" style={{ padding: '10px 14px' }} onClick={() => { update('restaurantName', nameInput.trim()); setEditName(false); }}>✓</button>
                <button className="btn-secondary" style={{ padding: '10px 14px' }} onClick={() => setEditName(false)}>✕</button>
              </div>
            ) : (
              <Row label={settings.restaurantName}>
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { setNameInput(settings.restaurantName); setEditName(true); }}>
                  Modifica
                </button>
              </Row>
            )}
          </Section>

          {/* TARGET FOOD COST */}
          <Section title="🎯 Target Food Cost">
            <Row label={`Target attuale: ${settings.foodCostTarget}%`}>
              <input
                type="number" min="10" max="60" step="1"
                value={settings.foodCostTarget}
                onChange={e => update('foodCostTarget', parseInt(e.target.value) || 30)}
                style={{ width: 80, fontFamily: 'var(--font-mono)', textAlign: 'right', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, outline: 'none' }}
              />
            </Row>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Il costo materie prime non dovrebbe superare questa % sul prezzo di vendita.
            </p>
          </Section>

          {/* ABBONAMENTO */}
          <Section title="💳 Abbonamento">
            <Row label="Piano">
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>Pro</span>
            </Row>
            <Row label="Stato">
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-top)' }}>
                {settings.subscriptionStatus === 'active' ? '✅ Attivo' : '❌ Inattivo'}
              </span>
            </Row>
            {!confirmUnsub ? (
              <button className="btn-secondary" onClick={() => setConfirmUnsub(true)} style={{ fontSize: 12, color: 'var(--status-risk)', borderColor: 'var(--status-risk-bg)' }}>
                Disdici abbonamento
              </button>
            ) : (
              <div style={{ background: 'var(--status-risk-bg)', border: '1px solid var(--status-risk)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                <p style={{ fontSize: 13, color: 'var(--status-risk)', marginBottom: 10 }}>Sicuro di voler disdire?</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" style={{ background: 'var(--status-risk)' }} onClick={() => { update('subscriptionStatus', 'inactive'); setConfirmUnsub(false); }}>Sì, disdici</button>
                  <button className="btn-secondary" onClick={() => setConfirmUnsub(false)}>Annulla</button>
                </div>
              </div>
            )}
          </Section>

          {/* APP */}
          <Section title="🌙 App">
            <Row label="Dark Mode">
              <button
                onClick={toggleTheme}
                style={{
                  width: 48, height: 26, borderRadius: 13,
                  background: isDark ? 'var(--gold)' : 'var(--border-color)',
                  border: 'none', cursor: 'pointer',
                  transition: 'background 0.2s', position: 'relative', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: isDark ? 26 : 4,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                }} />
              </button>
            </Row>
          </Section>

          {/* IMPORTA DATI */}
          {onOpenScanner && (
            <Section title="📷 Importa dati">
              <button className="btn-secondary" style={{ fontSize: 13 }} onClick={onOpenScanner}>
                📷 Importa da foto, PDF o Excel
              </button>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Scansiona un menù o un listino fornitore: rivedi i dati estratti prima di salvarli.
              </p>
            </Section>
          )}

          {/* DEMO */}
          <Section title="🎬 Demo">
            <button className="btn-secondary" style={{ fontSize: 13 }} onClick={async () => {
              const { seedDemoSupabase } = await import('../../lib/dataService');
              await seedDemoSupabase();
              window.location.reload();
            }}>
              🎬 Carica Dati Demo
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Sostituisce tutti i dati con un ristorante di esempio.
            </p>
          </Section>

          {/* LOGOUT */}
          <button
            className="btn-secondary"
            onClick={handleLogout}
            style={{ width: '100%', justifyContent: 'center', color: 'var(--status-risk)', borderColor: 'var(--status-risk-bg)' }}
          >
            🚪 Logout
          </button>

          {/* ELIMINA ACCOUNT */}
          <Section title="⚠️ Zona pericolosa">
            {!showDelete ? (
              <button
                className="btn-secondary"
                onClick={() => { setShowDelete(true); setDeleteError(null); setDeleteInput(''); }}
                style={{ fontSize: 13, color: 'var(--status-risk)', borderColor: 'var(--status-risk)' }}
              >
                🗑️ Elimina account e tutti i dati
              </button>
            ) : (
              <div style={{ background: 'var(--status-risk-bg)', border: '1px solid var(--status-risk)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
                <p style={{ fontSize: 13, color: 'var(--status-risk)', fontWeight: 700, margin: '0 0 6px' }}>
                  Questa azione è irreversibile.
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>
                  Verranno cancellati definitivamente tutti i piatti, la dispensa, i costi fissi e le impostazioni.
                  Per confermare scrivi il nome del locale: <strong>{venueName}</strong>
                </p>
                {deleteError && (
                  <p style={{ fontSize: 12, color: 'var(--status-risk)', margin: '0 0 8px' }}>{deleteError}</p>
                )}
                <input
                  className="form-input"
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder={venueName}
                  style={{ marginBottom: 10 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-primary"
                    disabled={deleting}
                    onClick={handleDeleteAccount}
                    style={{ background: 'var(--status-risk)' }}
                  >
                    {deleting ? 'Elimino...' : 'Elimina definitivamente'}
                  </button>
                  <button className="btn-secondary" onClick={() => setShowDelete(false)} disabled={deleting}>
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
