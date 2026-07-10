// src/components/tutorial/TutorialPage.jsx
import { TopBar } from '../layout/TopBar';

export function TutorialPage({ currentPage, onNavigate, onOpenSettings }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <TopBar currentPage={currentPage} onNavigate={onNavigate} onOpenSettings={onOpenSettings} />
      <div style={{
        flex:           1,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '40px 24px',
        textAlign:      'center',
        background:     'var(--bg-primary)',
      }}>
        <div style={{
          width:          '96px',
          height:         '96px',
          borderRadius:   '50%',
          background:     'var(--bg-card)',
          border:         '2px solid var(--gold)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       '46px',
          marginBottom:   '24px',
          boxShadow:      '0 4px 20px rgba(0,0,0,0.08)',
        }}>
          👨‍🍳
        </div>

        <h1 style={{
          fontFamily: 'Playfair Display, serif',
          fontSize:   '26px',
          fontWeight: '700',
          margin:     '0 0 12px',
          color:      'var(--text-primary)',
        }}>
          Tutorial
        </h1>

        <span style={{
          display:       'inline-block',
          padding:       '5px 14px',
          background:    'var(--gold-badge)',
          border:        '1px solid var(--gold)',
          borderRadius:  '20px',
          color:         'var(--gold-text)',
          fontSize:      '11px',
          fontWeight:    '700',
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          marginBottom:  '24px',
        }}>
          In Arrivo
        </span>

        <p style={{
          fontSize:   '15px',
          color:      'var(--text-secondary)',
          lineHeight: '1.65',
          maxWidth:   '300px',
          margin:     0,
        }}>
          Qui troverai brevi video di <strong>30 secondi</strong> per sfruttare
          al massimo l'ingegneria dei menù di LittleChef.
        </p>
      </div>
    </div>
  );
}

export default TutorialPage;
