-- =============================================================
-- Elimina la funcionalidad de comentarios.
-- La tabla comments y sus políticas RLS se borran en cascada;
-- también se elimina el enum comment_status que ya no se usa.
-- =============================================================
drop table if exists public.comments cascade;
drop type if exists public.comment_status;
