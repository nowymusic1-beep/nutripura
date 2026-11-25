create table if not exists public.storefront_prices (
 id text primary key check (id in ('berberina','magnesio')),
 price_clp integer not null check (price_clp between 1000 and 1000000),
 updated_at timestamptz not null default now(),
 updated_by text
);
alter table public.storefront_prices enable row level security;
revoke all on public.storefront_prices from public, anon, authenticated;
grant select, insert, update on public.storefront_prices to service_role;
insert into public.storefront_prices (id,price_clp) values ('berberina',24990),('magnesio',14850) on conflict (id) do nothing;
