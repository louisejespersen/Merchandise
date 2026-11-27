-- Trøjeordrer v1.3
-- Tilføjer status "Klar til udlevering" og fortløbende synlige ordrenumre.
-- Kør efter 001_initial_schema.sql.
-- Kør IKKE reset-scriptet herfra; reset-scriptet er separat og kun til engangsbrug.

BEGIN;

-- 1. Nye statusfelter og synligt ordrenummer.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number bigint,
  ADD COLUMN IF NOT EXISTS ready_for_pickup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ready_for_pickup_at timestamptz;

-- Hvis der allerede findes udleverede ordrer fra før denne migration,
-- registreres de også som tidligere klarmeldte. Tidsstemplet er et estimat
-- baseret på udleveringstidspunktet/oprettelsestidspunktet for historiske rækker.
UPDATE public.orders
SET ready_for_pickup = true,
    ready_for_pickup_at = COALESCE(ready_for_pickup_at, delivered_at, created_at)
WHERE delivered = true
  AND ready_for_pickup = false;

-- 2. Backfill af synlige ordrenumre for eventuelle eksisterende rækker.
-- Nye installationer efter reset har ingen rækker, så første ordrenummer bliver 1.
WITH rows_to_number AS (
  SELECT
    id,
    COALESCE((SELECT MAX(order_number) FROM public.orders), 0)
      + ROW_NUMBER() OVER (ORDER BY created_at, id) AS assigned_order_number
  FROM public.orders
  WHERE order_number IS NULL
)
UPDATE public.orders AS o
SET order_number = n.assigned_order_number
FROM rows_to_number AS n
WHERE o.id = n.id;

ALTER TABLE public.orders
  ALTER COLUMN order_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_uidx
  ON public.orders (order_number);

CREATE INDEX IF NOT EXISTS orders_ready_delivery_idx
  ON public.orders (ready_for_pickup, delivered);

-- En ordre kan først markeres udleveret, når den er markeret klar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND conname = 'orders_delivered_requires_ready'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivered_requires_ready
      CHECK (NOT delivered OR ready_for_pickup);
  END IF;
END;
$$;

-- 3. Transaktionel tæller til synlige ordrenumre.
-- I modsætning til PostgreSQL-sequences rulles denne ændring tilbage,
-- hvis oprettelsen af ordren fejler senere i samme transaktion.
CREATE TABLE IF NOT EXISTS public.order_number_counter (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  last_order_number bigint NOT NULL DEFAULT 0 CHECK (last_order_number >= 0)
);

INSERT INTO public.order_number_counter AS counter (singleton, last_order_number)
VALUES (true, COALESCE((SELECT MAX(order_number) FROM public.orders), 0))
ON CONFLICT (singleton) DO UPDATE
SET last_order_number = GREATEST(
  counter.last_order_number,
  EXCLUDED.last_order_number
);

-- Tællertabellen skal ikke kunne læses eller ændres via Supabase Data API.
ALTER TABLE public.order_number_counter ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_number_counter FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  assigned_number bigint;
BEGIN
  UPDATE public.order_number_counter
  SET last_order_number = last_order_number + 1
  WHERE singleton = true
  RETURNING last_order_number INTO assigned_number;

  IF assigned_number IS NULL THEN
    RAISE EXCEPTION 'Ordrenummer-tælleren er ikke initialiseret.';
  END IF;

  NEW.order_number := assigned_number;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_order_number() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_assign_order_number ON public.orders;
CREATE TRIGGER orders_assign_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_order_number();

-- 4. Udvid serverstyret timestamp-trigger med klarmeldingstidspunkt.
CREATE OR REPLACE FUNCTION public.set_order_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := now();

  IF TG_OP = 'UPDATE' THEN
    IF NEW.ready_for_pickup = true AND OLD.ready_for_pickup = false THEN
      NEW.ready_for_pickup_at := now();
    ELSIF NEW.ready_for_pickup = false THEN
      NEW.ready_for_pickup_at := NULL;
    ELSE
      NEW.ready_for_pickup_at := OLD.ready_for_pickup_at;
    END IF;

    IF NEW.delivered = true AND OLD.delivered = false THEN
      NEW.delivered_at := now();
    ELSIF NEW.delivered = false THEN
      NEW.delivered_at := NULL;
    ELSE
      NEW.delivered_at := OLD.delivered_at;
    END IF;
  ELSE
    IF NEW.ready_for_pickup = true AND NEW.ready_for_pickup_at IS NULL THEN
      NEW.ready_for_pickup_at := now();
    END IF;
    IF NEW.delivered = true AND NEW.delivered_at IS NULL THEN
      NEW.delivered_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Administratorer må ændre statusflaget, men ikke selv angive timestamps.
GRANT UPDATE (ready_for_pickup) ON TABLE public.orders TO authenticated;

COMMIT;
