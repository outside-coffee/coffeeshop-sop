# ☕ SOP Manager — Coffeeshop Operations

Application web de gestion opérationnelle pour coffee shop.
Multi-utilisateurs, données temps réel, mobile & tablette.
Hébergée gratuitement sur **Vercel** + **Supabase**.

---

## 🚀 Mise en ligne — guide complet

### Étape 1 — Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com) → **Start your project** (gratuit)
2. **New project** → nom `coffeeshop-sop`, région **West EU (Paris)**
3. Attends ~2 min que le projet démarre
4. **SQL Editor** → **New query** → colle tout le contenu de `supabase-schema.sql` → **Run**
5. Résultat attendu : *"Success. No rows returned."*

Récupère tes clés dans **Settings → API** :
- **Project URL** → `https://xxxxxxxx.supabase.co`
- **anon public key** → longue chaîne `eyJ...`

---

### Étape 2 — Créer le dépôt GitHub

1. Va sur [github.com](https://github.com) → **New repository**
2. Nom : `coffeeshop-sop` → Public ou Private (les deux marchent avec Vercel)
3. **Create repository**
4. Dans le dossier du projet :

```bash
git init
git add .
git commit -m "Initial commit — SOP Manager"
git branch -M main
git remote add origin https://github.com/outside-coffee/coffeeshop-sop.git
git push -u origin main
```

---

### Étape 3 — Déployer sur Vercel

1. Va sur [vercel.com](https://vercel.com) → **Sign up with GitHub** (gratuit)
2. **Add New Project** → importe `coffeeshop-sop`
3. Dans **Environment Variables**, ajoute :

| Nom | Valeur |
|-----|--------|
| `REACT_APP_SUPABASE_URL` | `https://xxxxxxxx.supabase.co` |
| `REACT_APP_SUPABASE_ANON_KEY` | `eyJ...` |

4. Clique **Deploy** → attends ~2 min
5. Ton URL sera : `https://coffeeshop-sop.vercel.app`

---

### Étape 4 — Autoriser le domaine dans Supabase

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL** : `https://coffeeshop-sop.vercel.app`
3. **Redirect URLs** : ajoute `https://coffeeshop-sop.vercel.app`
4. **Save**

---

### Étape 5 — Premier compte

1. Ouvre `https://coffeeshop-sop.vercel.app`
2. **Créer un compte** → prénom, email, mot de passe, rôle **Manager**
3. Partage l'URL à ton équipe (rôle **Barista**)

---

## 🔄 Mettre à jour l'app

Chaque `git push` déclenche un déploiement automatique sur Vercel :

```bash
git add .
git commit -m "description du changement"
git push
# → Vercel rebuild et redéploie automatiquement en ~1 min
```

---

## 💻 Développement local

```bash
# Copier le fichier d'environnement
cp .env.example .env.local
# Éditer .env.local avec tes clés Supabase

# Installer et lancer
npm install
npm start   # → http://localhost:3000
```

---

## Architecture

```
coffeeshop-sop/
├── public/index.html
├── src/
│   ├── hooks/useAuth.js        # Auth Supabase
│   ├── lib/supabase.js         # Client + constantes
│   ├── components/
│   │   ├── Sidebar.jsx         # Navigation
│   │   └── UI.jsx              # Composants réutilisables
│   ├── pages/
│   │   ├── Login.jsx           # Connexion / inscription
│   │   ├── Dashboard.jsx       # Vue du jour
│   │   ├── Checklist.jsx       # Ouverture & fermeture
│   │   ├── ShiftReport.jsx     # Rapport de shift
│   │   ├── Stock.jsx           # Stock
│   │   └── Recipes.jsx         # Recettes
│   ├── index.css
│   └── App.js                  # Routes (BrowserRouter)
├── supabase-schema.sql         # ← à exécuter dans Supabase SQL Editor
├── vercel.json                 # Réécriture des routes pour SPA
└── .env.example                # Template variables d'environnement
```

## Stack

- React 18 + React Router v6 (BrowserRouter)
- Supabase — PostgreSQL + Auth + Row Level Security
- Vercel — hébergement + CI/CD automatique
- lucide-react, date-fns

## Fonctionnalités

| Module | Description |
|--------|-------------|
| Dashboard | Vue du jour : checklists, rapport, alertes stock |
| Checklist ouverture | 12 tâches par catégorie, progression temps réel |
| Checklist fermeture | 11 tâches, validation par barista |
| Rapport de shift | CA, passages, incidents, passation équipe |
| Stock | Niveaux visuels, alertes seuil bas, réceptions |
| Recettes | Fiches standards avec étapes & grammages |

## Évolutions possibles

- [ ] Notifications push (stock bas, checklist oubliée)
- [ ] Export PDF des rapports
- [ ] Graphiques CA hebdo / mensuel
- [ ] Suivi températures frigo
- [ ] Planning de l'équipe
