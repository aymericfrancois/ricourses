-- Historique des observations de prix par magasin et ingrédient.
-- Append-only : le "prix actuel" = la dernière ligne (ORDER BY created_at DESC).
-- prix = prix de BASE (gross, après détection de promo : prixBase ≠ prix net payé).
-- prix_normalise + famille sont dénormalisés à l'écriture (€/kg, €/L, €/pièce).
--
-- À exécuter dans le SQL Editor du dashboard Supabase.

CREATE TABLE IF NOT EXISTS prix_observations (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  magasin_id      uuid            NOT NULL REFERENCES magasins(id) ON DELETE CASCADE,
  ingredient_nom  text            NOT NULL,
  prix            numeric(10,2)   NOT NULL,
  quantite        numeric(12,3),
  unite           text,
  prix_normalise  numeric(12,4),
  famille         text,
  source          text            NOT NULL DEFAULT 'scanner',
  created_at      timestamptz     DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prix_obs_lookup
  ON prix_observations (magasin_id, ingredient_nom, created_at DESC);

ALTER TABLE prix_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated access" ON prix_observations;
CREATE POLICY "authenticated access" ON prix_observations
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
