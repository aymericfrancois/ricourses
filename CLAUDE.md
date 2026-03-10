# CLAUDE.md — Ricourses

This file provides guidance for AI assistants working in this codebase.

## Project Overview

**Ricourses** is a French-language meal planning and grocery list web app. Users select meals, and the app auto-generates a shopping list grouped by store section. All state is persisted in `localStorage`; there is no backend.

**Live app:** Deployed to GitHub Pages at `/ricourses/`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19.2 (JSX, no TypeScript) |
| Routing | React Router DOM 7.13 |
| Styling | Tailwind CSS 4.2 (via Vite plugin) |
| Icons | Lucide React 0.575 |
| Build | Vite 7.3 |
| Linting | ESLint 9 (flat config) |
| Deploy | GitHub Actions → GitHub Pages |

---

## Development Commands

```bash
npm run dev       # Start dev server with HMR (http://localhost:5173/ricourses/)
npm run build     # Production build to /dist
npm run lint      # Run ESLint
npm run preview   # Preview production build locally
```

There are **no tests** in this project.

---

## Repository Structure

```
src/
├── context/
│   └── MagasinContext.jsx   # Global state: active store + ingredient→section mappings
├── hooks/
│   ├── useMagasins.js       # Store & section CRUD, persisted to localStorage
│   └── usePlats.js          # Meal & ingredient CRUD, persisted to localStorage
├── pages/
│   ├── Home.jsx             # Store selector + navigation hub
│   ├── Parametres.jsx       # Settings: manage meals and stores
│   └── ListeCourses.jsx     # Shopping list grouped by store section
├── data/
│   ├── initialMagasins.json # 3 default stores: Lidl, Carrefour, E.Leclerc
│   ├── initialPlats.json    # 38 pre-loaded meals with ingredients
│   └── mappingRayons.json   # 90-entry map: ingredient name → section name
├── utils/
│   └── icones.js            # 13 Lucide icon names for meal icons
├── App.jsx                  # BrowserRouter + MagasinProvider + Routes
├── index.css                # Global styles — imports Tailwind via @import "tailwindcss"
└── main.jsx                 # React entry point
```

---

## Routing

Routes are defined in `src/App.jsx` with `basename="/ricourses"`:

| Path | Component | Purpose |
|---|---|---|
| `/` | `Home` | Select active store, navigate to list or settings |
| `/parametres` | `Parametres` | Add/edit/delete meals, stores, and sections |
| `/liste` | `ListeCourses` | View aggregated shopping list by section |

---

## State Management

### MagasinContext (`src/context/MagasinContext.jsx`)

The single global context. Wrap consumers with `useMagasinContext()`.

Provides:
- `magasins` — array of store objects (from `useMagasins`)
- `magasinActif` / `setMagasinActif` — currently selected store name
- `rayonsParMagasin` — `{ [storeName]: { [ingredientLower]: sectionName } }`
- `getRayon(nomIngredient)` — looks up section for active store (case-insensitive)
- `setRayon(nomIngredient, rayonNom)` — assigns ingredient to a section
- Section CRUD: `moveRayonUp`, `moveRayonDown`, `renommerRayon`, `ajouterRayon`, `supprimerRayon`

### Custom Hooks

**`useMagasins()`** — manages `magasins` array in localStorage under `ricourses_magasins`.
Returns CRUD functions for stores and their sections. The minimum section count per store is 1 (enforced in `supprimerRayon`).

**`usePlats()`** — manages `plats` array in localStorage under `ricourses_plats`.
Returns: `plats`, `ajouterPlat`, `supprimerPlat`, `updatePlatIcone`, `ajouterIngredient`, `supprimerIngredient`.

### localStorage Keys

| Key | Content |
|---|---|
| `ricourses_magasins` | Array of store objects with sections |
| `ricourses_plats` | Array of meal objects with ingredients |
| `ricourses_magasin_actif` | Active store name (string) |
| `ricourses_rayons_par_magasin` | Ingredient→section mappings per store |

---

## Data Shapes

### Store (`magasin`)
```json
{
  "id": "magasin-lidl",
  "nom": "Lidl",
  "rayons": [
    { "id": "lidl-r1", "nom": "Fruits & Légumes" }
  ]
}
```

### Meal (`plat`)
```json
{
  "id": "uuid-or-string",
  "nom": "Spaghetti Carbo",
  "icone": "utensils",
  "ingredients": [
    { "id": "uuid", "nom": "Lardons", "quantite": 200, "unite": "g" }
  ]
}
```

New IDs are generated with `crypto.randomUUID()`.

---

## Key Conventions

- **Language:** All UI text, variable names, function names, and comments are in **French**. Follow this convention for any new code.
- **No TypeScript:** The project uses plain `.jsx` and `.js` files. Do not add `.ts`/`.tsx` files.
- **No test framework:** There are no tests; do not add test files unless explicitly requested.
- **Tailwind only:** Use Tailwind utility classes for all styling. Do not add CSS modules or styled-components. The `App.css` file exists but is unused.
- **Functional components only:** No class components.
- **State immutability:** All state updates use immutable patterns (`prev.map(...)`, spread operators). Never mutate state directly.
- **Ingredient lookup is case-insensitive:** `getRayon` and `setRayon` lowercase the ingredient name. Always store mapping keys in lowercase.
- **No backend/API calls:** Everything is client-side. Do not introduce fetch/axios/API dependencies.

---

## Deployment

The app is auto-deployed to GitHub Pages on every push to `main` via `.github/workflows/deploy.yml`:

1. Checkout → Node 20 → `npm install && npm run build`
2. Upload `/dist` as GitHub Pages artifact
3. Deploy to GitHub Pages environment

The `vite.config.js` sets `base: '/ricourses/'` to match the GitHub Pages subpath. This is required for routing and asset paths to work correctly — do not change it.

---

## Adding New Features

**New page:**
1. Create `src/pages/NouveauePage.jsx`
2. Add a `<Route>` in `src/App.jsx`
3. Add navigation link in `Home.jsx` or relevant page

**New store/meal data:**
- Edit `src/data/initialMagasins.json` or `src/data/initialPlats.json`
- Note: once a user has data in localStorage, seeded defaults are ignored

**New ingredient→section mappings:**
- Edit `src/data/mappingRayons.json` (key = ingredient name, value = section name)
- Keys are case-insensitive at runtime but conventionally written in title case in the JSON

**New meal icons:**
- Add the Lucide icon name to `src/utils/icones.js`
- Ensure it is exported from `lucide-react`
