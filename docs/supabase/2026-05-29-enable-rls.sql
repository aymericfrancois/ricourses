-- =============================================================================
-- Ricourses — Activer RLS sur toutes les tables de `public`
-- Date : 2026-05-29
-- Motif : Alerte Supabase Security Advisor `rls_disabled_in_public` sur le projet
--         `vqfyjhquxiqarilwfuhx`. La clé `anon` étant publique (bundle GitHub
--         Pages), RLS désactivé permet à n'importe qui de CRUD toutes les tables.
-- Posture : Quick fix permissif. RLS activé + policy `FOR ALL USING (true)`,
--           identique au pattern déjà en place pour `courses_cochees`. Ne
--           protège pas réellement les données tant qu'il n'y a pas d'auth ;
--           ferme l'alerte du dashboard et unifie la posture entre toutes les
--           tables.
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PARTIE A — Diagnostic
-- Lister les tables de `public` sans RLS activé. À exécuter avant et après la
-- partie B (après, doit retourner 0 lignes).
-- -----------------------------------------------------------------------------

SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false
ORDER BY tablename;


-- -----------------------------------------------------------------------------
-- PARTIE B — Fix idempotent
-- Boucle sur toutes les tables de `public` :
--   - active RLS (no-op si déjà actif)
--   - ajoute une policy permissive « public access » uniquement si elle n'existe
--     pas déjà
-- Ré-exécutable sans effet de bord.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.tablename);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t.tablename
        AND policyname = 'public access'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "public access" ON public.%I FOR ALL USING (true) WITH CHECK (true);',
        t.tablename
      );
    END IF;
  END LOOP;
END $$;
