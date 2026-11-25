create table if not exists public.mercadopago_orders (
 id uuid primary key, token_hash text not null unique, email text not null, customer jsonb not null,
 items jsonb not null, subtotal integer not null, discount integer not null, shipping integer not null,
 amount integer not null check(amount = subtotal - discount + shipping and amount > 0),
 status text not null check(status in ('pending','paid','failed','refunded')),
 preference_id text unique, payment_id text unique, meta_event_id text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.mercadopago_orders enable row level security;
revoke all on public.mercadopago_orders from public, anon, authenticated;
grant select,insert,update on public.mercadopago_orders to service_role;
notify pgrst, 'reload schema';
