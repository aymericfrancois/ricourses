-- Historique des tickets scannés : une ligne par ticket (tickets) + une ligne
-- par article du ticket (ticket_articles), TOUS les articles validés — reconnus
-- ou non — contrairement à prix_observations qui ne garde que les articles
-- reconnus (utilisée par l'estimateur/comparateur de prix, pas par l'historique).
-- Sert la page /historique : liste des tickets, détail par ticket, export CSV
-- (par ticket ou global) et lien vers la photo du ticket si elle a été conservée.
--
-- À exécuter dans le SQL Editor du dashboard Supabase.

CREATE TABLE IF NOT EXISTS tickets (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  magasin_id      uuid            NOT NULL REFERENCES magasins(id) ON DELETE CASCADE,
  magasin_nom     text            NOT NULL,
  date_ticket     date            NOT NULL DEFAULT CURRENT_DATE,
  total_officiel  numeric(10,2),
  total_calcule   numeric(10,2)   NOT NULL,
  nb_articles     int             NOT NULL,
  image_path      text,
  created_at      timestamptz     DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_date
  ON tickets (date_ticket DESC, created_at DESC);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated access" ON tickets;
CREATE POLICY "authenticated access" ON tickets
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);


CREATE TABLE IF NOT EXISTS ticket_articles (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid            NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  nom_article     text            NOT NULL,   -- nom brut lu sur le ticket (OCR)
  ingredient_nom  text,                       -- ingrédient associé, si reconnu (peut être NULL)
  prix            numeric(10,2)   NOT NULL,
  nombre          numeric(6,2)    NOT NULL DEFAULT 1,
  quantite        numeric(12,3),              -- contenance totale (nombre × contenance unitaire)
  unite           text,
  prix_normalise  numeric(12,4),              -- €/kg, €/L ou €/pièce
  famille         text,
  split_choisi    text            CHECK (split_choisi IN ('me', 'both', 'ali')),
  created_at      timestamptz     DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_articles_ticket
  ON ticket_articles (ticket_id);

ALTER TABLE ticket_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated access" ON ticket_articles;
CREATE POLICY "authenticated access" ON ticket_articles
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- PARTIE OPTIONNELLE — Stockage de la photo du ticket
-- Sans cette partie, tout fonctionne (liste, détail, export CSV) mais la photo
-- n'est jamais conservée : "image_path" reste toujours NULL et aucun bouton
-- "voir la photo" n'apparaît. À exécuter seulement si vous voulez garder les
-- photos (coût de stockage Supabase à surveiller si beaucoup de tickets/an).
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('tickets-images', 'tickets-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "authenticated access tickets-images" ON storage.objects;
CREATE POLICY "authenticated access tickets-images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'tickets-images')
  WITH CHECK (bucket_id = 'tickets-images');
