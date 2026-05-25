-- 1) Novo valor de enum (em transação isolada, ainda não usado neste mesmo arquivo)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor_grupo';

-- 2) Tabelas
CREATE TABLE IF NOT EXISTS public.educational_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_ies (
  group_id uuid NOT NULL REFERENCES public.educational_groups(id) ON DELETE CASCADE,
  ies_id   uuid NOT NULL REFERENCES public.ies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, ies_id)
);
CREATE INDEX IF NOT EXISTS idx_group_ies_ies_id ON public.group_ies(ies_id);

CREATE TABLE IF NOT EXISTS public.user_groups (
  user_id  uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES public.educational_groups(id) ON DELETE CASCADE,
  role     text NOT NULL DEFAULT 'gestor_grupo',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON public.user_groups(user_id);

-- 3) Funções utilitárias (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_user_group_ies(_user uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT gi.ies_id), ARRAY[]::uuid[])
  FROM public.user_groups ug
  JOIN public.group_ies gi ON gi.group_id = ug.group_id
  WHERE ug.user_id = _user;
$$;

CREATE OR REPLACE FUNCTION public.get_accessible_ies(_user uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT ies_id), ARRAY[]::uuid[])
  FROM (
    SELECT id_ies AS ies_id FROM public.users WHERE id = _user AND id_ies IS NOT NULL
    UNION
    SELECT gi.ies_id
    FROM public.user_groups ug
    JOIN public.group_ies gi ON gi.group_id = ug.group_id
    WHERE ug.user_id = _user
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_ies(_user uuid, _ies uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _ies IS NULL THEN false
    WHEN public.has_role(_user, 'admin'::public.app_role) THEN true
    WHEN public.has_role(_user, 'b2b_partner'::public.app_role) THEN true
    ELSE _ies = ANY (public.get_accessible_ies(_user))
  END;
$$;

-- 4) RLS das novas tabelas
ALTER TABLE public.educational_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_ies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage educational_groups" ON public.educational_groups;
CREATE POLICY "Admins manage educational_groups"
ON public.educational_groups FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Members can read their educational_groups" ON public.educational_groups;
CREATE POLICY "Members can read their educational_groups"
ON public.educational_groups FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_groups ug
    WHERE ug.group_id = id AND ug.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins manage group_ies" ON public.group_ies;
CREATE POLICY "Admins manage group_ies"
ON public.group_ies FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Members can read their group_ies" ON public.group_ies;
CREATE POLICY "Members can read their group_ies"
ON public.group_ies FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_groups ug
    WHERE ug.group_id = group_ies.group_id AND ug.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins manage user_groups" ON public.user_groups;
CREATE POLICY "Admins manage user_groups"
ON public.user_groups FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users read own user_groups" ON public.user_groups;
CREATE POLICY "Users read own user_groups"
ON public.user_groups FOR SELECT TO authenticated
USING (user_id = auth.uid());