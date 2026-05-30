-- =============================================================================
-- Ricourses — Resserrer les RLS policies à `TO authenticated`
-- Date : 2026-05-30
-- Motif : Ajout de l'auth Supabase (1 compte partagé foyer). Les policies
--         actuelles `FOR ALL USING (true)` ouvrent les tables au rôle `anon`,
--         dont la clé est dans le bundle GitHub Pages. On les remplace par
--         `FOR ALL TO authenticated USING (true) WITH CHECK (true)` :
--         seuls les utilisateurs logés ont accès.
-- ⚠️ PRÉ-REQUIS :
--    1. Créer au moins 1 user dans Authentication → Users → Add user
--    2. Déployer le code applicatif avec Login + useAuth
--    Sinon l'app sera cassée tant qu'aucun utilisateur n'est logé.
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- =============================================================================


-- Bloc idempotent : drop l'ancienne policy "public access" et la remplace par
-- "authenticated access" scopée au rôle `authenticated`. Ré-exécutable sans
-- effet de bord.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "public access" ON public.%I;', t.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated access" ON public.%I;', t.tablename);
    EXECUTE format(
      'CREATE POLICY "authenticated access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
      t.tablename
    );
  END LOOP;
END $$;


-- Diagnostic : lister les policies restantes sur public, doit montrer 1 ligne
-- "authenticated access" par table, avec roles = {authenticated}.

SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
