-- Ajout en masse d'articles dans "Achats Ponctuels" (Planning) à partir d'une
-- liste de courses fournie par l'utilisateur — insertion de données ponctuelle,
-- pas une migration de schéma. Peut être rejouée, mais rejouer duplique les
-- lignes (pas de déduplication par nom).
--
-- Notes de traduction de la liste :
--   - "4 kg de riz (moitié thaï moitié basmati)" → 2 lignes de 2 kg chacune.
--   - "6 jus : pommes / raisins" → 2 lignes de 3 pièce chacune (répartition
--     égale faute de précision).
--   - "6 paquets de flocons d'avoine 500g ou 3kg total" → 1 ligne de 3 kg.
--   - Items sans quantité précisée (œufs, céréales, whey, spaghettis, thon
--     mayo, pain de mie, sel, huile, shampoing…) → 1 pièce par défaut,
--     éditable directement dans l'app ensuite.
--
-- À exécuter dans le SQL Editor du dashboard Supabase.

WITH p AS (
  SELECT id FROM planning LIMIT 1
),
depart AS (
  SELECT COALESCE(MAX(el.position), -1) + 1 AS pos0
  FROM p
  LEFT JOIN espaces_libres el
    ON el.planning_id = p.id AND el.bloc = 'achatsPonctuels'
),
items (nom, quantite, unite, ordre) AS (
  VALUES
    ('Riz thaï',                                  2,  'kg',    1),
    ('Riz basmati',                                2,  'kg',    2),
    ('Balance de cuisine (≈10€)',                  1,  'pièce', 3),
    ('Sucre',                                     11,  'kg',    4),
    ('Citrons',                                    2,  'pièce', 5),
    ('Flocons d''avoine',                          3,  'kg',    6),
    ('Lait',                                       2,  'pièce', 7),
    ('Jus de pomme',                               3,  'pièce', 8),
    ('Jus de raisin',                              3,  'pièce', 9),
    ('Sel',                                        1,  'pièce', 10),
    ('Eau de coco',                                3,  'pièce', 11),
    ('Thon nature (boîtes)',                      12,  'pièce', 12),
    ('Betteraves (boîtes)',                        12,  'pièce', 13),
    ('Maquereaux (escabèche/tomate/moutarde)',    12,  'pièce', 14),
    ('Huile olive ou colza',                       1,  'pièce', 15),
    ('Noix de cajou crues',                        3,  'pièce', 16),
    ('Coca zéro (canettes)',                       2,  'pièce', 17),
    ('Shampoing camomille',                        1,  'pièce', 18),
    ('Soin cheveux',                               1,  'pièce', 19),
    ('Gel douche',                                 2,  'pièce', 20),
    ('Dentifrice',                                 2,  'pièce', 21),
    ('Œufs',                                       1,  'pièce', 22),
    ('Céréales',                                   1,  'pièce', 23),
    ('Whey',                                       1,  'pièce', 24),
    ('Spaghettis',                                 1,  'pièce', 25),
    ('Thon mayo',                                  1,  'pièce', 26),
    ('Pain de mie',                                1,  'pièce', 27)
)
INSERT INTO espaces_libres (id, planning_id, bloc, nom, quantite, unite, plat_id, position)
SELECT
  gen_random_uuid(),
  p.id,
  'achatsPonctuels',
  items.nom,
  items.quantite,
  items.unite,
  NULL,
  depart.pos0 + items.ordre - 1
FROM items, p, depart;
