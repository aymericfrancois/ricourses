# Design — Synchronisation de l'état coché de la liste de courses via Supabase

**Date :** 2026-03-31  
**Périmètre :** `src/pages/ShoppingList.jsx` uniquement

---

## Contexte

L'état coché de la liste de courses (`checkedItems`) est aujourd'hui un `useState(() => new Set())` purement local — perdu au rechargement, non partagé entre appareils.

---

## Base de données

Table Supabase `courses_cochees` (déjà créée) :

```sql
CREATE TABLE courses_cochees (
  ingredient_nom TEXT PRIMARY KEY
);
ALTER TABLE courses_cochees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access" ON courses_cochees FOR ALL USING (true) WITH CHECK (true);
```

- Clé primaire = `ingredient_nom` en lowercase (cohérent avec `ingredient_splits` et `ingredient_rayons`)
- Pas de FK, couvre aussi les ingrédients orphelins (sans rayon)
- Pas de colonne `magasin_id` — l'état coché est global, indépendant du store sélectionné

---

## Architecture

Aucun nouveau contexte global. La logique est encapsulée dans un hook local `useCoursesCoches` utilisé uniquement par `ShoppingList.jsx`.

### Hook `useCoursesCoches()`

**Retourne :** `{ checkedItems: Set, toggleChecked(key), uncheckAll() }`

**Init (montage) :**
```
SELECT ingredient_nom FROM courses_cochees
→ hydrate Set<string>
```

**Toggle :**
1. Mise à jour optimiste locale immédiate (pas d'attente réseau)
2. Si la clé était absente → `INSERT INTO courses_cochees (ingredient_nom) VALUES (key)`
3. Si la clé était présente → `DELETE FROM courses_cochees WHERE ingredient_nom = key`
4. Erreur Supabase → loguée en console, pas de rollback (acceptable pour un état UI non critique)

**Tout décocher (`uncheckAll`) :**
1. `setCheckedItems(new Set())` immédiat
2. `DELETE FROM courses_cochees` (sans filtre — vide toute la table)

**Realtime :**
- Souscription `supabase.channel('courses_cochees').on('postgres_changes', ...)` au montage
- `INSERT` → ajoute `ingredient_nom` au Set
- `DELETE` → retire `ingredient_nom` du Set
- Désabonnement au démontage (`useEffect` cleanup)

### Bouton "Tout décocher"

- Affiché dans le header de `ShoppingList`, à droite du titre
- Visible uniquement si `checkedItems.size > 0`
- Icône `RotateCcw` + texte "Tout décocher"
- Appelle `uncheckAll()`

---

## Comportement de persistance

- L'état coché **persiste** à travers les changements de planning (voulu explicitement)
- L'état coché **ne se remet pas à zéro** si un ingrédient disparaît de la liste — il est simplement ignoré puisque le composant ne rend que les ingrédients présents dans `ingredientsMap`
- Nettoyage implicite : quand l'utilisateur clique "Tout décocher", la table est vidée

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/pages/ShoppingList.jsx` | Remplace `useState(new Set)` + `toggleChecked` par le hook `useCoursesCoches` ; ajoute bouton "Tout décocher" |

Aucun autre fichier modifié.

---

## Non-périmètre

- Pas de gestion d'erreur réseau avec rollback
- Pas d'authentification (RLS permissive, cohérent avec le reste du projet)
- Pas de migration de données depuis `localStorage`
