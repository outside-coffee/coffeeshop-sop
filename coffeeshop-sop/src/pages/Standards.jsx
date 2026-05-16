import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const OUTSIDE_STANDARDS = {
  reception: {
    title: 'Accueil & séquence de service',
    icon: '👋',
    steps: [
      { step: 'Accueil (0–30 sec)', action: '«\u00a0Marhba bik fi Outside\u00a0!» + sourire + contact visuel' },
      { step: 'Installation', action: 'Proposer une table ou laisser choisir — présenter les zones' },
      { step: 'Commande (max 2 min)', action: '«\u00a0Chno theb tichreb lyoum\u00a0? Les spécialités du jour sont…\u00a0»' },
      { step: 'Confirmation', action: 'Répéter la commande\u00a0: «\u00a0Donc un flat white et un jus d'orange\u00a0?»' },
      { step: 'Service', action: 'Poser la boisson avec le sourire\u00a0: «\u00a0Tafadhal, seha w hana\u00a0!»' },
      { step: 'Check 5 min après', action: '«\u00a0Kol chay cava\u00a0? Theb haja okhra\u00a0?»' },
      { step: 'Au revoir', action: '«\u00a0Chokran w narouk qrib\u00a0! Nhar saïd\u00a0!» + sourire' },
    ]
  },
  standards: {
    title: 'Standards Outside',
    icon: '🎯',
    items: [
      { label: 'Accueil client', standard: 'Prise en charge en 30 secondes dès l\'entrée' },
      { label: 'Extraction espresso', standard: '25–30 secondes — crema dorée' },
      { label: 'Temps de service', standard: '5 minutes maximum pour toute boisson chaude' },
      { label: 'Nettoyage bar', standard: 'Toutes les 30 minutes minimum' },
      { label: 'Sourire', standard: 'Obligatoire — même les jours difficiles' },
      { label: 'Uniforme', standard: 'Propre, tablier attaché, cheveux attachés' },
    ]
  },
  espresso: {
    title: 'Standards espresso',
    icon: '☕',
    items: [
      { label: 'Dose café', standard: '18–20g par double shot' },
      { label: 'Temps d\'extraction', standard: '25–30 secondes' },
      { label: 'Volume en tasse', standard: '30–40ml (double espresso)' },
      { label: 'Pression machine', standard: '9 bars' },
      { label: 'Température eau', standard: '90–96°C' },
      { label: 'Couleur crema', standard: 'Brun doré — ni noire ni trop claire' },
    ]
  },
  milk: {
    title: 'Technique lait vapeur',
    icon: '🥛',
    steps: [
      { step: 'Remplissage', action: 'Remplir la carafe au 1/3 — le lait double de volume' },
      { step: 'Purge', action: 'Purger la lance vapeur 2 secondes avant de commencer' },
      { step: 'Position', action: 'Lance légèrement sous la surface — angle 45°' },
      { step: 'Phase 1 — texture', action: 'Lance près de la surface — créer un tourbillon — 5 à 7 sec' },
      { step: 'Phase 2 — chauffe', action: 'Plonger la lance plus profond pour monter en température' },
      { step: 'Stop', action: 'Arrêter à 60–65°C (ou quand la carafe brûle la main)' },
      { step: 'Finition', action: 'Taper la carafe, faire des cercles pour lisser' },
      { step: 'Service', action: 'Verser immédiatement — la mousse n\'attend pas' },
    ]
  },
  crossselling: {
    title: 'Cross-selling — Eau & Cookies',
    icon: '💧',
  },
  nono: {
    title: 'Ce qu\'on ne fait jamais',
    icon: '🚫',
    items: [
      'Ne jamais réchauffer du lait vapeur une deuxième fois — recommencer de zéro',
      'Ne jamais servir un espresso extrait depuis plus de 30 secondes — le refaire',
      'Ne jamais goûter avec une cuillère qu\'on remet dans la boisson',
      'Ne jamais utiliser du lait périmé, même «\u00a0pour tester\u00a0»',
      'Ne jamais laisser la machine sans surveillance',
      'Ne jamais dire «\u00a0non\u00a0» sans proposer une alternative',
      'Ne jamais parler entre collègues devant le client',
      'Ne jamais mettre son argent personnel dans la caisse pour compenser une erreur',
    ]
  },
  emergency: {
    title: 'Situations d\'urgence & difficiles',
    icon: '🚨',
    protocols: [
      { situation: 'Mauvaise commande', response: 'Refaire immédiatement sans discussion. «\u00a0Je vous refais ça tout de suite.»' },
      { situation: 'Longue attente', response: 'S\'excuser, expliquer, proposer de l\'eau pendant l\'attente' },
      { situation: 'Client agressif', response: 'Rester calme, baisser le ton, appeler le responsable immédiatement' },
      { situation: 'Commande oubliée', response: 'S\'excuser sincèrement, priorité immédiate, offrir un geste commercial' },
      { situation: 'Plainte sur le prix', response: 'Expliquer la valeur avec fierté — ne jamais négocier les prix' },
      { situation: 'Wi-Fi en panne', response: 'Informer immédiatement, donner une heure estimée, offrir un café pendant l\'attente' },
      { situation: 'Incendie', response: 'Évacuer tous les clients par la sortie principale — appeler les secours immédiatement' },
      { situation: 'Client malaise', response: 'Appeler les secours immédiatement — ne pas déplacer — rester à côté' },
    ]
  },
  evaluation: {
    title: 'Grille d\'évaluation mensuelle',
    icon: '📊',
    criteria: [
      { label: 'Ponctualité & uniforme', points: 20 },
      { label: 'Qualité des boissons (espresso, lait)', points: 20 },
      { label: 'Accueil & relation client', points: 20 },
      { label: 'Propreté du poste de travail', points: 15 },
      { label: 'Respect des protocoles d\'hygiène', points: 15 },
      { label: 'Esprit d\'équipe & communication', points: 10 },
    ],
    ratings: [
      { range: '85–100', label: 'Excellent', color: 'green', note: 'Bravo !' },
      { range: '70–84', label: 'Bien', color: 'amber', note: 'Points d\'amélioration à travailler' },
      { range: '< 70', label: 'À améliorer', color: 'red', note: 'Plan de progression avec le responsable' },
    ]
  }
}

const WATER_SCRIPTS = [
  { moment: 'À la prise de commande (toujours)', phrase: '«\u00a0Et pourquoi pas une eau fraîche\u00a0? On a des plateaux et des petites bouteilles.»' },
  { moment: 'Client commande un espresso', phrase: '«\u00a0Je t\'amène une petite eau avec le café\u00a0?»' },
  { moment: 'Client commande smoothie / frappé', phrase: '«\u00a0Une eau plate avec ta commande\u00a0? N\'oublie pas l\'hydratation\u00a0!»' },
  { moment: 'Client vient travailler avec laptop', phrase: '«\u00a0Je pose une bouteille d\'eau sur la table\u00a0?»' },
  { moment: 'Check 5 min après le service', phrase: '«\u00a0Tu veux que je t\'amène une eau fraîche\u00a0?»' },
  { moment: 'Journée chaude', phrase: '«\u00a0Il fait chaud aujourd\'hui — une eau fraîche avec ton café\u00a0?»' },
]

const COOKIE_SCRIPTS = [
  { moment: 'À la prise de commande (café)', phrase: '«\u00a0Et un cookie avec le café\u00a0? Ils sont arrivés ce matin, tout frais.»' },
  { moment: 'Client hésite sur son choix', phrase: '«\u00a0Le cookie [nom] va super bien avec le latte — les habitués adorent.»' },
  { moment: 'Client seul avec laptop', phrase: '«\u00a0Je t\'amène un cookie\u00a0? Carburant idéal pour bosser\u00a0!»' },
  { moment: 'Groupe / amis', phrase: '«\u00a0Je vous mets une assiette de cookies à partager\u00a0?»' },
  { moment: 'Client finit sa boisson', phrase: '«\u00a0Tu veux un cookie pour finir\u00a0?»' },
  { moment: 'Fin d\'après-midi (coup de mou)', phrase: '«\u00a0Cookie pour la pause de 16h45\u00a0?»' },
]

const COMBO_SCRIPTS = [
  { type: 'Café classique seul', phrase: '«\u00a0Et j\'ajoute une eau plate et un cookie chocolat\u00a0?»' },
  { type: 'Boisson sucrée / frappé', phrase: '«\u00a0Une eau pour équilibrer et un cookie pour le plaisir\u00a0?»' },
  { type: 'Client pressé', phrase: '«\u00a0Rapide — eau et cookie à emporter\u00a0?»' },
  { type: 'Client fidèle', phrase: '«\u00a0Ton habituel — et on ajoute un cookie aujourd\'hui\u00a0?»' },
  { type: 'Première visite', phrase: '«\u00a0Bienvenue\u00a0! On a des cookies maison — tu essaies avec ton café\u00a0?»' },
]

function Section({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card" style={{ marginBottom: '10px' }}>
      <div style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 400, flex: 1 }}>{title}</span>
        {open ? <ChevronUp size={18} color="var(--muted)" /> : <ChevronDown size={18} color="var(--muted)" />}
      </div>
      {open && <div style={{ padding: '0 1.5rem 1.25rem', borderTop: '1px solid var(--brown-100)' }}>
        {children}
      </div>}
    </div>
  )
}

function StepTable({ steps }) {
  return (
    <div style={{ marginTop: '0.75rem' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', padding: '0.6rem 0', borderBottom: '1px solid var(--brown-50)', alignItems: 'flex-start' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--brown-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--brown-600)', flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.step}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--ink)', marginTop: '1px' }}>{s.action}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function StandardsTable({ items }) {
  return (
    <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
      <table>
        <thead><tr><th>Élément</th><th>Standard</th></tr></thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500, fontSize: '0.875rem' }}>{item.label}</td>
              <td style={{ fontSize: '0.875rem' }}>{item.standard}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ScriptTable({ scripts }) {
  return (
    <div style={{ marginTop: '0.75rem' }}>
      {scripts.map((s, i) => (
        <div key={i} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--brown-50)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{s.moment || s.type}</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--brown-700)', fontStyle: 'italic', background: 'var(--brown-50)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', borderLeft: '2px solid var(--accent)' }}>{s.phrase}</div>
        </div>
      ))}
    </div>
  )
}

export default function Standards() {
  const s = OUTSIDE_STANDARDS

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Standards Outside</h1>
        <p className="page-subtitle">SOP v1 2025 — Your Everyday Escape</p>
      </div>

      <div className="page-content">
        {/* VALEURS */}
        <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--brown-800)', border: 'none' }}>
          <div style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--brown-300)', marginBottom: '8px' }}>Les 4 valeurs Outside</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
              {[
                { v: 'Qualité', d: 'Chaque boisson préparée avec soin' },
                { v: 'Accueil', d: 'Sourire sincère, même en rush' },
                { v: 'Régularité', d: 'Le café du matin = le café du soir' },
                { v: 'Ambiance', d: 'On crée une atmosphère, pas juste un service' },
              ].map(({ v, d }) => (
                <div key={v} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--accent)', marginBottom: '2px' }}>{v}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--brown-300)', lineHeight: 1.4 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Section title={s.reception.title} icon={s.reception.icon} defaultOpen>
          <StepTable steps={s.reception.steps} />
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--brown-50)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--muted)' }}>
            💡 Règle d'or : toujours être proactif. Si tu vois un client attendre — va lui parler. <strong>Un client informé = un client patient.</strong>
          </div>
        </Section>

        <Section title={s.standards.title} icon={s.standards.icon}>
          <StandardsTable items={s.standards.items} />
        </Section>

        <Section title={s.espresso.title} icon={s.espresso.icon}>
          <StandardsTable items={s.espresso.items} />
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#FEF3DC', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#7A5000' }}>
            ⚠️ Machine ne chauffe pas correctement\u00a0? 1. Vérifier l'interrupteur principal (ON). 2. Vérifier la pression (8–9 bars). 3. Si problème persiste\u00a0: appeler le responsable technique immédiatement. 4. Prévoir des alternatives\u00a0: café filtre, boissons froides. Ne pas servir un espresso raté sans en informer le responsable.
          </div>
        </Section>

        <Section title={s.milk.title} icon={s.milk.icon}>
          <StepTable steps={s.milk.steps} />
        </Section>

        <Section title={s.crossselling.title} icon={s.crossselling.icon}>
          <div style={{ padding: '0.75rem 1rem', background: 'var(--brown-50)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', marginTop: '0.75rem', borderLeft: '3px solid var(--accent)' }}>
            <strong>La règle d'or du cross-selling Outside :</strong> Proposer une seule fois, avec le sourire, au bon moment. Ne jamais insister. «\u00a0Non merci\u00a0» s'accepte avec courtoisie.
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <div className="section-label">💧 Eau — scripts et moments</div>
            <ScriptTable scripts={WATER_SCRIPTS} />
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <div className="section-label">🍪 Cookies — scripts et moments</div>
            <ScriptTable scripts={COOKIE_SCRIPTS} />
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <div className="section-label">🎯 Combo gagnant — Eau + Cookie</div>
            <div style={{ padding: '0.75rem 1rem', background: 'var(--brown-800)', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--brown-300)', marginBottom: '4px' }}>La phrase Outside</div>
              <div style={{ fontSize: '0.95rem', color: 'var(--cream)', fontStyle: 'italic' }}>«\u00a0Mzien — et j'ajoute une eau fraîche et un cookie [nom du cookie]\u00a0?»</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--brown-300)', marginTop: '4px' }}>Dire avec le sourire au moment de confirmer la commande — taux de conversion élevé.</div>
            </div>
            <ScriptTable scripts={COMBO_SCRIPTS} />
          </div>

          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--brown-50)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--muted)' }}>
            <strong>Objectif équipe :</strong> Proposer l'eau sur 100% des tables · Proposer le cookie sur 80% des commandes
          </div>
        </Section>

        <Section title={s.nono.title} icon={s.nono.icon}>
          <div style={{ marginTop: '0.75rem' }}>
            {s.nono.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', padding: '0.5rem 0', borderBottom: '1px solid var(--brown-50)', fontSize: '0.875rem', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '1px' }}>✕</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title={s.emergency.title} icon={s.emergency.icon}>
          <div style={{ marginTop: '0.75rem' }}>
            {s.emergency.protocols.map((p, i) => (
              <div key={i} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--brown-50)' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{p.situation}</div>
                <div style={{ fontSize: '0.875rem' }}>{p.response}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#FDEEEC', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--danger)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><strong>N° Responsable :</strong><br /><span style={{ color: 'var(--ink)' }}>_________________</span></div>
            <div><strong>N° Urgences :</strong><br /><span style={{ color: 'var(--ink)' }}>_________________</span></div>
          </div>
        </Section>

        <Section title={s.evaluation.title} icon={s.evaluation.icon}>
          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            <table>
              <thead><tr><th>Critère</th><th style={{ textAlign: 'right' }}>Points</th></tr></thead>
              <tbody>
                {s.evaluation.criteria.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: '0.875rem' }}>{c.label}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-display)' }}>/  {c.points}</td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--brown-50)' }}>
                  <td style={{ fontWeight: 600 }}>Total</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>/ 100</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '1rem', flexWrap: 'wrap' }}>
            {s.evaluation.ratings.map(r => (
              <div key={r.range} style={{ flex: 1, minWidth: '120px', padding: '10px', borderRadius: 'var(--radius-md)', background: r.color === 'green' ? '#EBF5EE' : r.color === 'amber' ? '#FEF3DC' : '#FDEEEC' }}>
                <div style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', color: r.color === 'green' ? '#2D6A3F' : r.color === 'amber' ? '#7A5000' : 'var(--danger)' }}>{r.range}</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: r.color === 'green' ? '#2D6A3F' : r.color === 'amber' ? '#7A5000' : 'var(--danger)' }}>{r.label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px' }}>{r.note}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}
