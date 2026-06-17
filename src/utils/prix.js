// Familles d'unités et facteurs de conversion vers l'unité de base (kg / L / pièce).
// c.à.s et c.à.c sont traités comme 'piece' : pas convertibles en volume sans
// connaître l'ingrédient. Unité vide '' = pièce implicite.

const FAMILLES = {
  g: 'masse', kg: 'masse',
  mL: 'volume', cL: 'volume', L: 'volume',
  'pièce': 'piece', '': 'piece', 'c.à.s': 'piece', 'c.à.c': 'piece',
}

const VERS_BASE = {
  g: 0.001, kg: 1,
  mL: 0.001, cL: 0.01, L: 1,
  'pièce': 1, '': 1, 'c.à.s': 1, 'c.à.c': 1,
}

export const UNITE_BASE_NOM = {
  masse: 'kg', volume: 'L', piece: 'pièce',
}

// famille(unite) → 'masse' | 'volume' | 'piece' | null
export function famille(unite) {
  if (unite === null || unite === undefined) return null
  return FAMILLES[unite] ?? null
}

// toBase(quantite, unite) → { valeur, famille } | null
export function toBase(quantite, unite) {
  const fam = famille(unite)
  if (!fam) return null
  return { valeur: Number(quantite) * VERS_BASE[unite], famille: fam }
}

// prixNormalise(prix, quantite, unite) → { prixNorm, famille, uniteBase } | null
export function prixNormalise(prix, quantite, unite) {
  if (!quantite || Number(quantite) <= 0) return null
  const base = toBase(quantite, unite)
  if (!base) return null
  return {
    prixNorm: Number(prix) / base.valeur,
    famille: base.famille,
    uniteBase: UNITE_BASE_NOM[base.famille],
  }
}

// coutIngredient(qtyRecette, uniteRecette, priceRecord) → { cout, estimable, raison? }
// priceRecord = { prix_normalise, famille, prix, quantite, unite }
export function coutIngredient(qtyRecette, uniteRecette, priceRecord) {
  if (!priceRecord) return { cout: null, estimable: false, raison: 'prix_manquant' }

  const famRecette = famille(uniteRecette)
  const famPrix = priceRecord.famille

  // Prix sans normalisation (quantite inconnue lors de l'obs)
  if (!priceRecord.prix_normalise || !famPrix) {
    // Si les deux sont pièce, on multiplie le prix par la quantité recette
    if (famRecette === 'piece' || !famRecette) {
      return { cout: Number(priceRecord.prix) * (Number(qtyRecette) || 1), estimable: true }
    }
    return { cout: null, estimable: false, raison: 'quantite_manquante' }
  }

  if (famRecette !== famPrix) {
    return { cout: null, estimable: false, raison: 'unite_incompatible' }
  }

  const base = toBase(qtyRecette, uniteRecette)
  if (!base) return { cout: null, estimable: false, raison: 'unite_incompatible' }

  return { cout: base.valeur * Number(priceRecord.prix_normalise), estimable: true }
}

// Formate un prix normalisé pour l'affichage : "2,40 €/kg"
export function formatPrixNorm(prixNorm, uniteBase) {
  if (prixNorm == null) return null
  return `${prixNorm.toFixed(2).replace('.', ',')} €/${uniteBase ?? 'u'}`
}

// Valeur forfaitaire (€) appliquée à un article dont le prix est totalement inconnu
// (jamais scanné, dans aucune enseigne). Estimation grossière "au doigt mouillé".
export const PRIX_DEFAUT_ARTICLE = 2.5

// estimerCoutItem(item, magasinActif, prixObservations)
//   item = { nom, quantite, unite }
//   prixObservations = { [magasinNom]: { [ingredientLower]: [obs, ...] } } (obs[0] = + récent)
//   → { cout, source: 'magasin' | 'autre' | 'defaut' }
//
// Stratégie de repli en cascade :
//   1. dernier prix observé dans le magasin actif
//   2. dernier prix observé dans une autre enseigne (le + récent toutes enseignes)
//   3. valeur forfaitaire PRIX_DEFAUT_ARTICLE
export function estimerCoutItem(item, magasinActif, prixObservations) {
  const qty = item.quantite > 0 ? item.quantite : 1
  const key = item.nom.toLowerCase()
  const obsParMagasin = prixObservations || {}

  // 1. Magasin actif
  const direct = obsParMagasin[magasinActif]?.[key]?.[0]
  if (direct) {
    const { cout, estimable } = coutIngredient(qty, item.unite, direct)
    if (estimable && cout != null) return { cout, source: 'magasin' }
  }

  // 2. Autre enseigne — on retient l'observation la plus récente
  let best = null
  for (const mag in obsParMagasin) {
    if (mag === magasinActif) continue
    const obs = obsParMagasin[mag]?.[key]?.[0]
    if (!obs) continue
    if (!best || (obs.date_ticket ?? '').localeCompare(best.date_ticket ?? '') > 0) best = obs
  }
  if (best) {
    const { cout, estimable } = coutIngredient(qty, item.unite, best)
    if (estimable && cout != null) return { cout, source: 'autre' }
  }

  // 3. Forfait — aucun prix connu, ou unité incompatible avec les obs connues
  return { cout: PRIX_DEFAUT_ARTICLE, source: 'defaut' }
}
