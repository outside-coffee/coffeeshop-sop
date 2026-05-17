import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const OUTSIDE_STANDARDS = {
  reception: {
    title: 'Accueil & service',
    icon: '👋',
    steps: [
      { step: 'Accueil (0-30 sec)', action: 'Marhba bik fi Outside ! + sourire + contact visuel' },
      { step: 'Installation', action: 'Proposer une table ou laisser choisir' },
      { step: 'Commande (max 2 min)', action: 'Chno theb tichreb lyoum ? Les speciales du jour sont...' },
      { step: 'Confirmation', action: 'Repeter la commande avant de lancer' },
      { step: 'Service', action: 'Tafadhal, seha w hana !' },
      { step: 'Check 5 min apres', action: 'Kol chay cava ? Theb haja okhra ?' },
      { step: 'Au revoir', action: 'Chokran w narouk qrib ! Nhar said !' },
    ]
  },
  espresso: {
    title: 'Standards espresso',
    icon: '☕',
    items: [
      { label: 'Dose cafe', standard: '18-20g par double shot' },
      { label: 'Extraction', standard: '25-30 secondes' },
      { label: 'Volume', standard: '30-40ml (double)' },
      { label: 'Pression machine', standard: '9 bars' },
      { label: 'Temperature eau', standard: '90-96°C' },
      { label: 'Crema', standard: 'Brun dore — ni noire ni trop claire' },
    ]
  },
  milk: {
    title: 'Technique lait vapeur',
    icon: '🥛',
    steps: [
      { step: 'Remplissage', action: 'Carafe au 1/3 — le lait double de volume' },
      { step: 'Purge', action: 'Purger la lance 2 secondes avant' },
      { step: 'Phase texture', action: 'Lance pres surface — tourbillon 5-7 sec' },
      { step: 'Phase chauffe', action: 'Lance plus profond — monter en temperature' },
      { step: 'Stop', action: '60-65 degres (carafe brule la main)' },
      { step: 'Finition', action: 'Taper la carafe, faire des cercles' },
      { step: 'Service', action: 'Verser immediatement' },
    ]
  },
  crossselling: {
    title: 'Cross-selling Eau & Cookies',
    icon: '💧',
    scripts: [
      { moment: 'A la prise de commande', phrase: 'Et pourquoi pas une eau fraiche ? On a des plateaux et des petites bouteilles.' },
      { moment: 'Client espresso', phrase: "Je t'amene une petite eau avec le cafe ?" },
      { moment: 'Client avec laptop', phrase: "Je pose une bouteille d'eau sur la table ?" },
      { moment: 'A la prise de commande (cafe)', phrase: "Et un cookie avec le cafe ? Ils sont arrives ce matin, tout frais." },
      { moment: 'Combo gagnant', phrase: "Mzien — et j'ajoute une eau fraiche et un cookie ?" },
    ]
  },
  nono: {
    title: 'Ce qu\'on ne fait jamais',
    icon: '🚫',
    items: [
      'Ne jamais rechauffer du lait vapeur une deuxieme fois',
      'Ne jamais servir un espresso extrait depuis plus de 30 secondes',
      'Ne jamais utiliser du lait perime',
      'Ne jamais laisser la machine sans surveillance',
      'Ne jamais dire non sans proposer une alternative',
      'Ne jamais parler entre collegues devant le client',
      'Ne jamais mettre son argent dans la caisse pour compenser',
    ]
  },
  emergency: {
    title: 'Situations difficiles',
    icon: '🚨',
    protocols: [
      { situation: 'Mauvaise commande', response: 'Refaire immediatement sans discussion.' },
      { situation: 'Longue attente', response: "S'excuser, expliquer, proposer de l'eau." },
      { situation: 'Client agressif', response: 'Rester calme, appeler le responsable.' },
      { situation: 'Commande oubliee', response: "S'excuser sincèrement, priorite immediate." },
      { situation: 'Plainte sur le prix', response: 'Expliquer la valeur — ne jamais negocier.' },
    ]
  },
  evaluation: {
    title: 'Evaluation mensuelle',
    icon: '📊',
    criteria: [
      { label: 'Ponctualite & uniforme', points: 20 },
      { label: 'Qualite des boissons', points: 20 },
      { label: 'Accueil & relation client', points: 20 },
      { label: 'Proprete du poste', points: 15 },
      { label: 'Respect protocoles hygiene', points: 15 },
      { label: 'Esprit equipe', points: 10 },
    ]
  }
}

function Section({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card" style={{ marginBottom: '8px' }}>
      <div style={{ padding: '0.9rem 1.1rem', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.975rem', fontWeight: 400, flex: 1 }}>{title}</span>
        {open ? <ChevronUp size={17} color="var(--muted)" /> : <ChevronDown size={17} color="var(--muted)" />}
      </div>
      {open && <div style={{ padding: '0 1.1rem 1rem', borderTop: '1.5px solid var(--outside-cream)' }}>{children}</div>}
    </div>
  )
}

export default function Standards() {
  const s = OUTSIDE_STANDARDS
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Standards SOP</h1>
        <p className="page-subtitle">Outside v1 2025 — Your Everyday Escape</p>
      </div>

      <div className="page-content">
        {/* VALEURS */}
        <div style={{ background: 'var(--outside-dark)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--outside-amber)', fontWeight: 800, marginBottom: '8px' }}>
            Les 4 valeurs Outside
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { v: 'Qualite', d: 'Chaque boisson preparee avec soin' },
              { v: 'Accueil', d: 'Sourire sincere, meme en rush' },
              { v: 'Regularite', d: 'Le cafe du matin = le cafe du soir' },
              { v: 'Ambiance', d: 'On cree une atmosphere' },
            ].map(({ v, d }) => (
              <div key={v} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', padding: '8px 10px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--outside-orange)', marginBottom: '2px' }}>{v}</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>

        <Section title={s.reception.title} icon={s.reception.icon} defaultOpen>
          {s.reception.steps.map((st, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', padding: '0.6rem 0', borderBottom: '1px solid var(--outside-cream)' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--outside-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: 'var(--outside-dark)', flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{st.step}</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '1px' }}>{st.action}</div>
              </div>
            </div>
          ))}
        </Section>

        <Section title={s.espresso.title} icon={s.espresso.icon}>
          {s.espresso.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--outside-cream)', fontSize: '0.875rem' }}>
              <span style={{ fontWeight: 600 }}>{it.label}</span>
              <span style={{ fontWeight: 800, color: 'var(--outside-orange)' }}>{it.standard}</span>
            </div>
          ))}
        </Section>

        <Section title={s.milk.title} icon={s.milk.icon}>
          {s.milk.steps.map((st, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', padding: '0.6rem 0', borderBottom: '1px solid var(--outside-cream)' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--outside-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: 'var(--outside-dark)', flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>{st.step}</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '1px' }}>{st.action}</div>
              </div>
            </div>
          ))}
        </Section>

        <Section title={s.crossselling.title} icon={s.crossselling.icon}>
          <div style={{ background: 'var(--outside-cream)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', margin: '0.75rem 0', fontSize: '0.82rem', fontWeight: 700, borderLeft: '3px solid var(--outside-orange)' }}>
            Proposer une seule fois, avec sourire. Ne jamais insister.
          </div>
          {s.crossselling.scripts.map((sc, i) => (
            <div key={i} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--outside-cream)' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '3px' }}>{sc.moment}</div>
              <div style={{ fontSize: '0.875rem', fontStyle: 'italic', background: 'var(--outside-cream)', padding: '5px 9px', borderRadius: 'var(--radius-sm)', borderLeft: '2px solid var(--outside-orange)', fontWeight: 600 }}>
                {sc.phrase}
              </div>
            </div>
          ))}
        </Section>

        <Section title={s.nono.title} icon={s.nono.icon}>
          {s.nono.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', padding: '0.55rem 0', borderBottom: '1px solid var(--outside-cream)', fontSize: '0.875rem', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--danger)', flexShrink: 0, fontWeight: 800 }}>✕</span>
              <span style={{ fontWeight: 600 }}>{item}</span>
            </div>
          ))}
        </Section>

        <Section title={s.emergency.title} icon={s.emergency.icon}>
          {s.emergency.protocols.map((p, i) => (
            <div key={i} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--outside-cream)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--danger)', textTransform: 'uppercase', marginBottom: '2px' }}>{p.situation}</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.response}</div>
            </div>
          ))}
        </Section>

        <Section title={s.evaluation.title} icon={s.evaluation.icon}>
          {s.evaluation.criteria.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--outside-cream)', fontSize: '0.875rem' }}>
              <span style={{ fontWeight: 600 }}>{c.label}</span>
              <span style={{ fontWeight: 800, color: 'var(--outside-orange)', fontSize: '1rem', fontFamily: 'var(--font-display)' }}>/{c.points}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '6px', marginTop: '0.75rem' }}>
            {[{ r: '85-100', l: 'Excellent', c: 'green' }, { r: '70-84', l: 'Bien', c: 'amber' }, { r: '<70', l: 'A ameliorer', c: 'red' }].map(r => (
              <div key={r.r} style={{ flex: 1, background: r.c === 'green' ? '#E0F2EB' : r.c === 'amber' ? '#FEF3DC' : '#FDEEEC', borderRadius: 'var(--radius-md)', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: r.c === 'green' ? 'var(--outside-green)' : r.c === 'amber' ? '#7A5000' : 'var(--danger)' }}>{r.r}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: r.c === 'green' ? 'var(--outside-green)' : r.c === 'amber' ? '#7A5000' : 'var(--danger)' }}>{r.l}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}
