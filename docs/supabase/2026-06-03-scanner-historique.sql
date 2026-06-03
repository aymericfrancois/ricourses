-- Historique des choix de répartition Tricount par article scanné.
-- Chaque validation de ticket insère une ligne par article reconnu.
-- Utilisé pour prédire automatiquement le split d'un ingrédient connu.
--
-- À exécuter dans le SQL Editor du dashboard Supabase.

CREATE TABLE IF NOT EXISTS scanner_historique (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_nom text        NOT NULL,
  split_choisi   text        NOT NULL CHECK (split_choisi IN ('me', 'both', 'ali')),
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE scanner_historique ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated access" ON scanner_historique;
CREATE POLICY "authenticated access" ON scanner_historique
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
