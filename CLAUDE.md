# CLAUDE.md — Ricourses

This file provides guidance for AI assistants working in this codebase.

## Project Overview

**Ricourses** is a French-language meal planning and grocery list web app. Users plan their week (assign meals per day, add free ingredients), and the app auto-generates a shopping list grouped by store section. All state is persisted in `localStorage`; there is no backend.

**Live app:** Deployed to GitHub Pages at `/ricourses/`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19.2 (JSX, no TypeScript) |
| Routing | React Router DOM 7.13 |
| Styling | Tailwind CSS 4.2 (via Vite plugin) |
| Icons | Lucide React 0.575 |
| Drag & Drop | @dnd-kit/core |
| Build | Vite 7.3 |
| Linting | ESLint 9 (flat config) |
| Deploy | GitHub Actions → GitHub Pages |

---

## Development Commands

```bash
npm run dev       # Start dev server (http://localhost:5173/ricourses/)
npm run build     # Production build to /dist
npm run lint      # Run ESLint
npm run preview   # Preview production build locally
```

No tests in this project.

---

## Repository Structure

```
src/
├── components/
│   └── Header.jsx              # Sticky header: logo, nav links, store selector
├── context/
│   ├── MagasinContext.jsx      # Global: active store + ingredient→section mappings
│   └── PlanningContext.jsx     # Global: weekly meals + free ingredient blocks
├── hooks/
│   ├── useMagasins.js          # Store & section CRUD → localStorage
│   └── usePlats.js             # Meal & ingredient CRUD → localStorage
├── pages/
│   ├── Home.jsx                # Landing page — navigation hub
│   ├── Planning.jsx            # Weekly planner + live shopping list with DnD
│   ├── ListeCourses.jsx        # Read-only aggregated shopping list (all meals)
│   └── Parametres.jsx          # Settings: Plats / Catalogue / Magasins tabs
├── data/
│   ├── initialMagasins.json    # 3 default stores: Lidl, Carrefour, E.Leclerc (12 sections each)
│   ├── initialPlats.json       # 38 pre-loaded meals with ingredients
│   └── mappingRayons.json      # ~90-entry map: ingredient name → section name
├── utils/
│   └── icones.js               # 13 Lucide icon names for meal icons
├── App.jsx                     # BrowserRouter + MagasinProvider + PlanningProvider + Header + Routes
├── index.css                   # @import "tailwindcss" + minimal body/root resets
└── main.jsx                    # React entry point
```

---

## Routing

Routes defined in `src/App.jsx` with `basename="/ricourses"`.
`Header` is rendered **outside** `<Routes>` — it persists on all pages.

| Path | Component | Purpose |
|---|---|---|
| `/` | `Home` | Landing page with navigation cards |
| `/planning` | `Planning` | Weekly planner + live shopping list |
| `/parametres` | `Parametres` | Manage meals, section catalogue, stores |
| `/liste` | `ListeCourses` | Read-only list from all meals |

---

## State Management

### MagasinContext (`src/context/MagasinContext.jsx`)

Active-store global context. Access with `useMagasinContext()`.

**Provides:**
- `magasins` — store objects array (from `useMagasins`)
- `magasinActif` / `setMagasinActif(nom)` — active store name (persisted)
- `rayonsParMagasin` — `{ [storeName]: { [ingredientLower]: sectionName } }`
- `getRayon(nomIngredient)` — case-insensitive lookup for active store (returns `''` if unmapped)
- `setRayon(nomIngredient, rayonNom)` — updates active store's mapping (keys always lowercase)
- Section CRUD: `moveRayonUp`, `moveRayonDown`, `renommerRayon`, `ajouterRayon`, `supprimerRayon`

**Seeding:** On first use, `rayonsParMagasin` is populated from `mappingRayons.json` for all stores.

---

### PlanningContext (`src/context/PlanningContext.jsx`)

Weekly planner global context. Access with `usePlanningContext()`.

**State shape (useReducer):**
```js
{
  semaine: [  // 7 entries: Lundi → Dimanche
    {
      jour: "Lundi",
      midi: null,          // platId or null
      midiDelta: { excluded: [], overrides: {}, extras: [] },
      soir: null,
      soirDelta: { excluded: [], overrides: {}, extras: [] },
    },
    ...
  ],
  espacesLibres: {
    petitDejeuner: [],      // [{ id, nom, quantite, unite }]
    achatsPonctuels: [],
    alicya: [],
  }
}
```

**Provides:**
- `semaine`, `espacesLibres`
- `setMidi(jourIdx, platId)`, `setSoir(jourIdx, platId)`
- `toggleExclu(jourIdx, repas, ingId)` — include/exclude ingredient from a planned meal
- `setOverride(jourIdx, repas, ingId, quantite, unite)` — override qty/unit per meal
- `addExtra(jourIdx, repas, {nom, quantite, unite})`, `removeExtra(jourIdx, repas, extraId)`
- `ajouterIngredientLibre(bloc, {nom, quantite, unite})`, `supprimerIngredientLibre(bloc, id)`, `updateIngredientLibre(bloc, id, quantite, unite)`
- `resetPlanning()` — clear all weekly data

---

### Custom Hooks

**`useMagasins()`** — `magasins` in localStorage (`ricourses_magasins`). Minimum 1 section per store.

**`usePlats()`** — `plats` in localStorage (`ricourses_plats`).
Returns: `plats`, `ajouterPlat`, `supprimerPlat`, `updatePlatIcone`, `ajouterIngredient`, `supprimerIngredient`.

---

### localStorage Keys

| Key | Content |
|---|---|
| `ricourses_magasins` | Array of store objects with sections |
| `ricourses_plats` | Array of meal objects with ingredients |
| `ricourses_magasin_actif` | Active store name (string) |
| `ricourses_rayons_par_magasin` | `{ storeName: { ingredientLower: sectionName } }` |
| `ricourses_planning` | Weekly planning: semaine + espacesLibres |

---

## Data Shapes

### Store (`magasin`)
```json
{ "id": "magasin-lidl", "nom": "Lidl",
  "rayons": [{ "id": "lidl-r1", "nom": "Fruits & Légumes" }] }
```

### Meal (`plat`)
```json
{ "id": "uuid", "nom": "Spaghetti Carbo", "icone": "utensils",
  "ingredients": [{ "id": "uuid", "nom": "Lardons", "quantite": 200, "unite": "g" }] }
```

### Free ingredient (`ingredientLibre`)
```json
{ "id": "uuid", "nom": "Café", "quantite": 250, "unite": "g" }
```

New IDs via `crypto.randomUUID()`.

---

## Key Pages

### Planning (`/planning`)
The main page. Two columns (stacked on mobile, side by side on desktop):

**Left (3/5):**
- **La Semaine:** A table (days × Midi/Soir). Each cell has a `PlatCombobox` (autocomplete search over meal names). Clicking a day's meal opens a `RepasEditor`: exclude individual ingredients, override quantities/units, add extra ingredients.
- **Espaces Libres:** Three free-ingredient blocks — "Petit déjeuner", "Achats ponctuels", "Alicya". Each supports add/edit/delete of ingredients.
- **Reset** button with confirmation dialog.

**Right (2/5, sticky):**
- Live shopping list aggregated from all selected meals (with overrides + extras) + all free blocks.
- Grouped by active store's section order, alphabetically sorted within each section.
- Checkboxes to mark items done.
- Drag & drop (`@dnd-kit/core`) to reassign an ingredient to a different section directly from the list.
- Orphaned ingredients (no section) shown at the bottom.

### Parametres (`/parametres`)
Three tabs (uses shared `Header`, no page-level header):
- **Plats:** Add/edit/delete meals and their ingredients. Desktop: 2-column (list + detail panel). Mobile: inline expand.
- **Catalogue:** Searchable list of all known ingredients (from meals + free blocks), with a section select per ingredient for the active store. The canonical place to bulk-assign sections.
- **Magasins:** Reorder sections per store (↑↓), rename, add, delete.

### ListeCourses (`/liste`)
Read-only. Aggregates all 38+ meals' ingredients (regardless of weekly planning), grouped by section for the active store, alphabetically within each section. Orphaned ingredients shown in orange at the bottom with a hint to assign sections.

---

## Component: Header (`src/components/Header.jsx`)

Persistent sticky header on all pages. Contains:
- "Ricourses" logo → `/`
- NavLink: "Planning" → `/planning`
- NavLink: "Paramètres" → `/parametres`
- "Scanner" button (disabled, placeholder for future feature)
- `<select>` store picker → `setMagasinActif` from `useMagasinContext()`

Active NavLink is highlighted with green styling.

---

## Key Conventions

- **Language:** All UI text, variable/function names, and comments in **French**.
- **No TypeScript:** `.jsx` / `.js` only.
- **No tests.**
- **Tailwind only:** No CSS modules or styled-components. `App.css` is unused.
- **Functional components only.** No class components.
- **Immutable state:** `prev.map(...)` and spread operators everywhere. Never mutate state directly.
- **Ingredient names are case-insensitive:** `getRayon`/`setRayon` lowercase the key. Mapping keys always stored lowercase.
- **No backend:** Client-side only.
- **DnD:** `@dnd-kit/core` used in `Planning.jsx` only (PointerSensor + TouchSensor).

---

## Deployment

Auto-deployed on push to `main` via `.github/workflows/deploy.yml`:
1. Checkout → Node 20 → `npm ci` → `npm run build` (in `ricourses/` subdirectory)
2. Upload `./ricourses/dist` as GitHub Pages artifact
3. Deploy to GitHub Pages environment

`vite.config.js` sets `base: '/ricourses/'`. Do not change this.

---

## Next Steps (Roadmap)

- **Liste de courses — tous les rayons affichés :** Afficher tous les rayons du magasin actif dans la liste de courses, même ceux sans ingrédient (section vide avec état élégant). Actuellement seuls les rayons non vides sont rendus.
- **DnD depuis ListeCourses :** Permettre le drag & drop pour réassigner un ingrédient à un autre rayon directement depuis `/liste` (le Planning a déjà ce DnD).
- **Refonte Paramètres :** Refonte de l'onglet Plats avec une UI par tags/rayons (ingrédients groupés par rayon plutôt que par plat).

---

## Adding New Features

**New page:**
1. `src/pages/NouveauePage.jsx`
2. `<Route>` in `src/App.jsx`
3. NavLink in `src/components/Header.jsx`

**New meal icon:** Add Lucide icon name to `src/utils/icones.js`.

**New ingredient→section mapping:** Edit `src/data/mappingRayons.json` (title case by convention, lowercase at runtime).

**New seed data:** Edit `initialMagasins.json` or `initialPlats.json` — ignored once user has localStorage data.
