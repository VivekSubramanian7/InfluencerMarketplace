-- Barter deal statuses and payment mode (must commit before use in 0032).
alter type public.deal_status add value if not exists 'product_sent';
alter type public.deal_status add value if not exists 'product_received';
alter type public.payment_mode add value if not exists 'barter';
