// src/components/demo/DemoTour.jsx — V11
// Tour guidato a 3 step con react-joyride
import { useState, useEffect } from 'react';
import { Joyride, STATUS } from 'react-joyride';

const STEPS = [
  {
    target: '#product-list-demo',
    title: '📋 I tuoi prodotti',
    content: 'Qui vedi tutti i tuoi piatti. Il pallino colorato ti dice subito se ci guadagni o ci perdi.',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '.filter-btn-critical',
    title: '🔴 Filtra i piatti critici',
    content: 'Clicca qui per vedere solo i piatti che ti fanno perdere soldi.',
    placement: 'bottom',
  },
  {
    target: '.demo-first-red-edit',
    title: '✏️ Prova a modificare il prezzo',
    content: 'Prova a modificare il prezzo di questo piatto e guarda cosa succede al semaforo.',
    placement: 'top',
  },
];

export function DemoTour({ hasData }) {
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (!hasData) return;
    const done = localStorage.getItem('lc_demo_tour_done') === 'true';
    if (done) return;
    const timer = setTimeout(() => setRun(true), 900);
    return () => clearTimeout(timer);
  }, [hasData]);

  const handleCallback = ({ status }) => {
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      localStorage.setItem('lc_demo_tour_done', 'true');
      setRun(false);
    }
  };

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      showProgress
      showSkipButton
      disableScrolling={false}
      locale={{
        back:  '← Indietro',
        close: 'Chiudi',
        last:  'Fine',
        next:  'Avanti →',
        skip:  'Salta tour',
      }}
      callback={handleCallback}
      styles={{
        options: {
          primaryColor:     '#E69D43',
          backgroundColor:  '#ffffff',
          textColor:        '#333333',
          arrowColor:       '#ffffff',
          zIndex:           10000,
        },
        buttonNext: {
          background:   '#E69D43',
          borderRadius: 6,
          fontWeight:   700,
        },
        buttonBack: {
          color: '#666666',
        },
        buttonSkip: {
          color: '#999999',
        },
      }}
    />
  );
}
