CREATE TABLE wallet_wechat_orders (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES wallet_accounts(id),
  request_id text NOT NULL,
  openid text NOT NULL,
  offer_id text NOT NULL,
  product_id text NOT NULL,
  tool text NOT NULL,
  title text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  cents integer NOT NULL CHECK (cents > 0),
  state text NOT NULL CHECK (state IN ('pending', 'paid', 'closed', 'refunding', 'refunded', 'review')),
  wx_order_id text UNIQUE,
  channel integer CHECK (channel IN (0, 7)),
  delivered boolean NOT NULL DEFAULT false,
  delivery_claim_until bigint NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  next_check_at bigint NOT NULL,
  UNIQUE (account_id, request_id)
);

CREATE INDEX wallet_wechat_orders_by_account ON wallet_wechat_orders(account_id, created_at DESC);
CREATE INDEX wallet_wechat_orders_due ON wallet_wechat_orders(next_check_at)
  WHERE state IN ('pending', 'paid', 'refunding');

CREATE TABLE wallet_wechat_refunds (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES wallet_wechat_orders(id),
  request_id text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('0', '1', '2', '3', '4', '5')),
  operator text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending', 'submitted', 'failed', 'succeeded')),
  submit_attempts integer NOT NULL DEFAULT 0,
  submit_claim_until bigint NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  UNIQUE (order_id, request_id)
);

CREATE UNIQUE INDEX wallet_wechat_refunds_one_active ON wallet_wechat_refunds(order_id)
  WHERE state IN ('pending', 'submitted', 'succeeded');

ALTER TABLE wallet_tool_operations ADD COLUMN payment_order_id text REFERENCES wallet_wechat_orders(id);
ALTER TABLE wallet_tool_operations DROP CONSTRAINT wallet_tool_operations_cost_check;
ALTER TABLE wallet_tool_operations ADD CONSTRAINT wallet_tool_operations_payment_check
  CHECK ((payment_order_id IS NULL AND cost > 0) OR (payment_order_id IS NOT NULL AND cost = 0));

CREATE UNIQUE INDEX wallet_wechat_orders_single_use ON wallet_tool_operations(payment_order_id)
  WHERE payment_order_id IS NOT NULL AND state IN ('reserved', 'settled');
