# CLAUDE.md — Ricourses

This file provides guidance for AI assistants working in this codebase.

## Project Overview

**Ricourses** is a French-language meal planning, grocery list, and household expense splitting web app. Users plan their week (assign meals per day, add free ingredients), the app auto-generates a shopping list grouped by store section, and a Scanner page reads receipts to split expenses via a Tricount-style calculator. All state is persisted in `localStorage`; there is no backend.

**Live app:** Deployed to GitHub Pages at `/ricourses/`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19.2 (JSX, no TypeScript) |
| Routing | React Router DOM 7.13 |
| Styling | Tailwind CSS 4.2 (via Vite plugin) |
| Icons | Lucide React 0.575 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/utilities |
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
│   └── Header.jsx              # Sticky header: logo, flat nav, store selector
├── context/
│   ├── MagasinContext.jsx      # Global: stores, ingredient→section mappings, defaultSplit
│   └── PlanningContext.jsx     # Global: weekly meals + free ingredient blocks
├── hooks/
│   ├── useMagasins.js          # Store & section CRUD → localStorage
│   └── usePlats.js             # Meal & ingredient CRUD → localStorage
├── pages/
│   ├── Home.jsx                # Landing page — navigation hub
│   ├── Planning.jsx            # Weekly planner + live shopping list with DnD
│   ├── Scanner.jsx             # Receipt scanner (mock OCR) + Tricount calculator
│   ├── ListeCourses.jsx        # Read-only aggregated shopping list (all meals)
│   └── Parametres.jsx          # Settings: handles /plats, /rayons, /ingredients routes
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
| `/` | `Home` | Landing page |
| `/planning` | `Planning` | Weekly planner + live shopping list |
| `/scanner` | `Scanner` | Receipt scanner + Tricount |
| `/plats` | `Parametres` | Manage meals and their ingredients |
| `/rayons` | `Parametres` | Reorder/rename/add sections per store |
| `/ingredients` | `Parametres` | Searchable ingredient catalogue with section & split assignment |
| `/liste` | `ListeCourses` | Read-only list from all meals (not in main nav) |

`Parametres` uses `useLocation()` to detect which of the three sub-routes is active and renders the corresponding tab content.

---

## Component: Header (`src/components/Header.jsx`)

Persistent sticky header on all pages. Flat navigation — no dropdown menus.

**Nav links (in order):**
- **Planning** → `/planning` (CalendarDays icon)
- **Scanner** → `/scanner` (ScanLine icon)
- **Plats** → `/plats` (UtensilsCrossed icon)
- **Rayons** → `/rayons` (LayoutList icon)
- **Ingrédients** → `/ingredients` (Leaf icon)

Plus a `<select>` store picker (right side) → `setMagasinActif`.

Active NavLink: `bg-green-50 text-green-700 border-b-2 border-green-600`.

---

## State Management

### MagasinContext (`src/context/MagasinContext.jsx`)

Global context for stores, section mappings, standalone ingredients, and Tricount splits.
Access with `useMagasinContext()`.

**Provides:**
- `magasins` — store objects array (from `useMagasins`)
- `magasinActif` / `setMagasinActif(nom)` — active store name (persisted)
- `rayonsParMagasin` — `{ [storeName]: { [ingredientLower]: sectionName } }`
- `getRayon(nomIngredient)` — case-insensitive lookup for active store (returns `''` if unmapped)
- `setRayon(nomIngredient, rayonNom)` — updates active store's mapping (keys always lowercase)
- `renommerIngredientDansRayons(ancienNom, nouveauNom)` — renames key in all stores
- `supprimerIngredientDansRayons(nom)` — removes ingredient from all store mappings + standalone list
- Section CRUD: `renommerRayon`, `ajouterRayon`, `supprimerRayon`, `reorderRayons`
- `standaloneIngredients` — string array of ingredients created directly in the catalogue (not from plats)
- `ajouterIngredientStandalone(nom, rayon)` — adds to standalone list + assigns section
- `getSplit(nomIngredient)` — returns `'me'|'ali'|'both'` for ingredient (default `'both'`)
- `setSplit(nomIngredient, valeur)` — persists Tricount default for ingredient (key: lowercase)

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
    // ...
  ],
  espacesLibres: {
    petitDejeuner: [],      // [{ id, nom, quantite, unite, platId? }]
    achatsPonctuels: [],
    alicya: [],
  }
}
```

**Note on `espacesLibres`:** Each entry can be a plain ingredient (`platId: null`) or a reference to a full meal (`platId: <id>`). When `platId` is set, the shopping list expands all ingredients of that meal multiplied by `quantite` (used as a multiplier).

**Delta pattern:** `midiDelta`/`soirDelta` store per-instance overrides that are strictly local — they never touch the original recipe:
- `excluded: [ingId, ...]` — ingredients removed from this meal instance
- `overrides: { [ingId]: { quantite, unite } }` — qty/unit overrides
- `extras: [{ id, nom, quantite, unite }]` — additional ingredients added only for this meal

**Provides:**
- `semaine`, `espacesLibres`
- `setMidi(jourIdx, platId)`, `setSoir(jourIdx, platId)` — also resets the corresponding delta
- `toggleExclu(jourIdx, repas, ingId)`
- `setOverride(jourIdx, repas, ingId, quantite, unite)`
- `addExtra(jourIdx, repas, {nom, quantite, unite})`, `removeExtra(jourIdx, repas, extraId)`
- `ajouterIngredientLibre(bloc, {nom, quantite, unite})`, `supprimerIngredientLibre(bloc, id)`, `updateIngredientLibre(bloc, id, quantite, unite)`
- `resetPlanning()` — clears all weekly data

---

### Custom Hooks

**`useMagasins()`** — `magasins` in localStorage (`ricourses_magasins`). Minimum 1 section per store. Exposes: `moveRayonUp`, `moveRayonDown`, `renommerRayon`, `ajouterRayon`, `supprimerRayon`, `reorderRayons`.

**`usePlats()`** — `plats` in localStorage (`ricourses_plats`).
Returns: `plats`, `ajouterPlat`, `supprimerPlat`, `renommerPlat`, `updatePlatIcone`, `updatePlatCategorie`, `ajouterIngredient`, `supprimerIngredient`, `updateIngredient`, `renommerIngredient`, `supprimerIngredientDePlats`.

---

### localStorage Keys

| Key | Content |
|---|---|
| `ricourses_magasins` | Array of store objects with sections |
| `ricourses_plats` | Array of meal objects with ingredients |
| `ricourses_magasin_actif` | Active store name (string) |
| `ricourses_rayons_par_magasin` | `{ storeName: { ingredientLower: sectionName } }` |
| `ricourses_ingredients_standalone` | `string[]` — ingredients added directly in catalogue |
| `ricourses_splits` | `{ ingredientLower: 'me'|'ali'|'both' }` — Tricount defaults |
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
{ "id": "uuid", "nom": "Spaghetti Carbo", "icone": "utensils", "categorie": "PÂTES",
  "ingredients": [{ "id": "uuid", "nom": "Lardons", "quantite": 200, "unite": "g" }] }
```

### Free ingredient (`ingredientLibre`)
```json
{ "id": "uuid", "nom": "Café", "quantite": 250, "unite": "g", "platId": null }
```
When `platId` is set: the item represents a full meal, and `quantite` is a multiplier applied to each ingredient of that meal.

New IDs via `crypto.randomUUID()`.

---

## Key Pages

### Planning (`/planning`)
The main page. Two columns (stacked on mobile, side by side on desktop):

**Left (3/5):**
- **La Semaine:** Grid (days × Midi/Soir). Each cell has a `PlatCombobox` (alphabetically sorted autocomplete). Opening a meal cell shows a `RepasEditor`: exclude ingredients, override qty/unit, add extras — all strictly local via the delta pattern.
- **Espaces Libres:** Three free blocks — "Petit déjeuner", "Achats ponctuels", "Alicya". Each accepts ingredients or full plat references. Inline qty/unit editing on existing entries.
- **Reset** button with two-step confirmation.

**Right (2/5, sticky):**
- Live shopping list aggregated from all meal slots (applying deltas) + all free blocks.
- Grouped by active store's section order, alphabetically within each section.
- All sections rendered (including empty ones with dashed "Aucun ingrédient" placeholder).
- Checkboxes to mark items done (strikethrough + green fill).
- **DnD** (`@dnd-kit/core`): drag an ingredient onto a section header to permanently reassign it via `setRayon`.
- `DragOverlay` shows a floating ghost card during drag.
- Orphaned ingredients (no section) shown at the bottom in a droppable "Autres / Non classés" zone.

### Scanner (`/scanner`)
Two-step receipt analysis workflow with Tricount expense splitting.

**Step 1 — Capture:**
- Drop zone (drag & drop image) with preview.
- "Caméra" button (`capture="environment"`, opens camera on mobile) and "Galerie" button (file picker).
- "Analyser le ticket" button (disabled until image selected).
- On click: 2-second loading state (spinner + animated text), then transitions to Step 2.

**Step 2 — Répartition:**
- Renders `MOCK_ARTICLES` (10 hardcoded articles — current mock OCR, to be replaced).
- Each article: name, matched ingredient name (if recognized), price, and a 3-state `SplitToggle`.
- `SplitToggle` values: `'me'` (👦 Moi, blue) | `'both'` (👥 50/50, green) | `'ali'` (👩 Ali, pink).
- Color-coded left border per article (blue/green/pink).
- **Initialization:** each article's split is set from `getSplit(article.matchedNom)` when entering Step 2. Articles without a match default to `'both'`.
- **Local-only:** changing the toggle updates only the local `articleSplits` state — it does NOT call `setSplit`.
- **"Mémoriser" button:** appears when `articleSplits[id] !== getSplit(matchedNom)` (i.e., the user changed it). Clicking calls `setSplit(matchedNom, newVal)` to persist the default globally. Shows a `BookmarkCheck` "Mémorisé" confirmation for 1.5 seconds, then disappears.

**Fixed bottom panel — Tricount:**
- Total ticket (sum of all articles).
- Part Moi = sum of `'me'` articles + 50% of `'both'` articles.
- Part Ali = total − Part Moi.
- Sub-labels show breakdown (n solo + n partagés). Updates in real time on every toggle change.

**Mock OCR data (`MOCK_ARTICLES`):**
```js
[
  { id: 1, nom: 'LARDONS FUMÉS 200G',  prix: 2.15, matchedNom: 'Lardons' },
  { id: 2, nom: 'SPAGHETTIS 500G',     prix: 1.05, matchedNom: 'Spaghetti' },
  { id: 3, nom: 'TOMATES GRAPPE 500G', prix: 2.90, matchedNom: 'Tomates' },
  { id: 4, nom: 'CRÈME FRAÎCHE 20CL',  prix: 1.40, matchedNom: 'Crème fraiche' },
  { id: 5, nom: 'THON AU NATUREL',     prix: 3.20, matchedNom: 'Thon' },
  { id: 6, nom: 'YAOURT NATURE X8',    prix: 2.40, matchedNom: null },
  { id: 7, nom: 'BEURRE DEMI SEL 250G',prix: 2.30, matchedNom: null },
  { id: 8, nom: 'POULET FERMIER 1KG',  prix: 8.50, matchedNom: 'Poulet' },
  { id: 9, nom: 'SAUMON ATLANTIQUE',   prix: 6.80, matchedNom: 'Saumon' },
  { id: 10,nom: 'MAÏS DOUX 285G',      prix: 1.20, matchedNom: 'Maïs' },
]
```
When the real OCR is implemented, replace `MOCK_ARTICLES` with the API response (same shape).

### Parametres (`/plats`, `/rayons`, `/ingredients`)

Single component serving three routes. Active tab detected via `useLocation().pathname`.

**Tab Plats (`/plats`):**
- Add meal (name + category selector). Categories: PÂTES | Dej | Dîner | Élaborés | Conserves | Surgelés | Autres.
- Meals grouped by category in `DroppableCategorie` zones — drag a meal card to change its category.
- Click a meal to open its ingredient editor (desktop: right panel; mobile: inline below).
- Per ingredient: qty/unit editor + rayon select (inline) + rename + delete.
- Add ingredient form per meal.

**Tab Rayons (`/rayons`):**
- Store selector (left, or top on mobile).
- For active store: draggable section list (`DraggableRayonRow` with DnD reorder).
- Inline rename + delete per section. Add section form at the bottom.

**Tab Ingrédients (`/ingredients`):**
- Aggregates all known ingredients: from `plats`, from `espacesLibres` (excluding `platId` entries), from `standaloneIngredients`.
- Add ingredient form: name + rayon + `SplitMini` Tricount default (👦/👥/👩).
- Search bar (filters by name).
- Ingredients grouped by section in `DroppableSection` zones.
- **DnD:** drag ingredient tags between sections to reassign `setRayon`. During drag, sections collapse to condensed headers-only.
- Each ingredient row (`IngredientTag`) shows: drag handle, name, `SplitMini` toggle (reads/writes `getSplit`/`setSplit`), rename (inline input), delete (with confirmation dialog).
- **Suppression en cascade:** deleting an ingredient calls both `supprimerIngredientDePlats` (removes from all recipes) and `supprimerIngredientDansRayons` (removes from all store mappings + standalone list).
- `DragOverlay` shows a rotated floating ghost tag during drag.

### ListeCourses (`/liste`)
Read-only (not in main nav). Aggregates all 38+ meals' ingredients regardless of weekly planning, grouped by section for the active store, alphabetically within. Orphaned ingredients shown in orange at the bottom.

---

## Key Conventions

- **Language:** All UI text, variable/function names, and comments in **French**.
- **No TypeScript:** `.jsx` / `.js` only.
- **No tests.**
- **Tailwind only:** No CSS modules or styled-components. `App.css` is unused.
- **Functional components only.** No class components.
- **Immutable state:** `prev.map(...)` and spread operators everywhere. Never mutate state directly.
- **Ingredient names are case-insensitive:** `getRayon`/`setRayon`/`getSplit`/`setSplit` always lowercase the key. Keys stored lowercase.
- **No backend:** Client-side only.
- **DnD (`@dnd-kit/core`):** Used in `Planning.jsx` (ingredient→section drag), `Parametres.jsx` (meal→category drag, ingredient→section drag, section reorder). Always `PointerSensor { distance: 8 }` + `TouchSensor { delay: 250, tolerance: 5 }`.
- **Tricount:** `'me'` = Moi (blue), `'both'` = 50/50 (green), `'ali'` = Ali (pink). Default is always `'both'`.

---

## Deployment

Auto-deployed on push to `main` via `.github/workflows/deploy.yml`:
1. Checkout → Node 20 → `npm ci` → `npm run build` (in `ricourses/` subdirectory)
2. Upload `./ricourses/dist` as GitHub Pages artifact
3. Deploy to GitHub Pages environment

`vite.config.js` sets `base: '/ricourses/'`. Do not change this.

---

## Next Steps (Roadmap)

- **Remplacer le Mock OCR du Scanner :** Intégrer une vraie solution de lecture d'image (ex: API Vision — Google Cloud Vision, AWS Textract, ou Mistral OCR). Remplacer `MOCK_ARTICLES` dans `Scanner.jsx` par l'appel API réel. La shape de données attendue reste la même : `{ id, nom, prix, matchedNom }`.
- **Migration vers Supabase :** Remplacer le stockage `localStorage` par une vraie base de données Supabase (PostgreSQL). Ajouter authentification utilisateur, synchronisation multi-appareils, et partage de planning entre utilisateurs du foyer.
- **DnD depuis ListeCourses :** Permettre le drag & drop pour réassigner un ingrédient depuis `/liste` (le Planning a déjà ce DnD).
- **defaultSplit dans l'onglet Plats :** Afficher et éditer le `defaultSplit` directement depuis la fiche d'un plat (actuellement uniquement dans l'onglet Ingrédients).

---

## Adding New Features

**New page:**
1. `src/pages/NouvellePage.jsx`
2. `<Route>` in `src/App.jsx`
3. `NavLink` in `src/components/Header.jsx`

**New meal icon:** Add Lucide icon name to `src/utils/icones.js`.

**New ingredient→section mapping:** Edit `src/data/mappingRayons.json` (title case by convention, lowercase at runtime).

**New seed data:** Edit `initialMagasins.json` or `initialPlats.json` — ignored once user has localStorage data.
