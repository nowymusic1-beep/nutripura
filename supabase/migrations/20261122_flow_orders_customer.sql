-- Datos de contacto y despacho del cliente (nombre, teléfono, región, comuna, dirección).
alter table public.flow_orders
  add column if not exists customer jsonb
  check (customer is null or pg_column_size(customer) <= 4096);

comment on column public.flow_orders.customer is
  'Nombre, teléfono y dirección de despacho ingresados en el checkout.';

-- Hace visible la columna nueva para la API de inmediato.
notify pgrst, 'reload schema';
