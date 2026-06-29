-- =============================================================
-- Agrega la categoría "Otros" para campañas que no encajan en
-- las categorías existentes. Las categorías pueden seguir
-- creciendo con nuevos ALTER TYPE ... ADD VALUE.
-- =============================================================
alter type public.need_category add value if not exists 'other';
