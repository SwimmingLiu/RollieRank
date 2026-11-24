ALTER TABLE wallet_credit_lots ADD COLUMN frozen boolean NOT NULL DEFAULT false;

CREATE TABLE wallet_coin_recharges (
  id text PRIMARY KEY CHECK (id ~ '^RC[0-9a-f]{30}$'),
  account_id text NOT NULL REFERENCES wallet_accounts(id),
  request_id text NOT NULL,
  app_id text NOT NULL,
  openid text NOT NULL,
  offer_id text NOT NULL,
  env smallint NOT NULL CHECK (env IN (0, 1)),
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  credits integer NOT NULL CHECK (credits BETWEEN 1 AND 10000),
  cents integer NOT NULL CHECK (cents = credits * 100),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'paid', 'credited', 'closed', 'refund_pending', 'refunded', 'review')),
  wx_order_id text,
  debit_signature text CHECK (debit_signature ~ '^[0-9a-f]{64}$'),
  lot_id bigint UNIQUE REFERENCES wallet_credit_lots(id),
  issue text,
  trade_updated_at bigint NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  next_check_at bigint NOT NULL,
  UNIQUE (account_id, request_id),
  CONSTRAINT wallet_coin_recharges_wx_order UNIQUE (offer_id, env, wx_order_id)
);

CREATE INDEX wallet_coin_recharges_account ON wallet_coin_recharges(account_id, created_at DESC, id);
CREATE INDEX wallet_coin_recharges_due ON wallet_coin_recharges(app_id, offer_id, env, next_check_at)
  WHERE state IN ('pending', 'paid', 'refund_pending');

-- Existing package quantities are valid. Replace their pilot prices with the published exchange rate.
UPDATE wallet_rules
SET value = jsonb_set(value, '{purchase,packages}', (
  SELECT COALESCE(jsonb_agg(jsonb_set(item, '{cents}', to_jsonb((item->>'credits')::integer * 100)) ORDER BY position), '[]'::jsonb)
  FROM jsonb_array_elements(value #> '{purchase,packages}') WITH ORDINALITY AS p(item, position)
))
WHERE jsonb_typeof(value #> '{purchase,packages}') = 'array';
