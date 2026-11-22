CREATE TABLE wallet_accounts (
  id text PRIMARY KEY,
  wechat_key text NOT NULL UNIQUE,
  created_at bigint NOT NULL,
  legacy_member boolean NOT NULL,
  first_use_at bigint
);

CREATE TABLE wallet_account_devices (
  guest_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES wallet_accounts(id)
);

CREATE TABLE wallet_sessions (
  token_hash text PRIMARY KEY,
  account_id text NOT NULL REFERENCES wallet_accounts(id),
  guest_id text,
  expires_at bigint NOT NULL
);
CREATE INDEX wallet_sessions_expiry ON wallet_sessions(expires_at);

CREATE TABLE wallet_rules (
  id integer PRIMARY KEY CHECK (id = 1),
  value jsonb NOT NULL
);

CREATE TABLE wallet_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id text REFERENCES wallet_accounts(id),
  source text NOT NULL,
  amount integer NOT NULL,
  balance_after bigint,
  reference text NOT NULL,
  reason text NOT NULL,
  tool text,
  operator text,
  created_at bigint NOT NULL,
  UNIQUE (source, reference)
);
CREATE INDEX wallet_ledger_account ON wallet_ledger(account_id, id DESC);

CREATE TABLE wallet_credit_lots (
  id bigint PRIMARY KEY REFERENCES wallet_ledger(id),
  account_id text NOT NULL REFERENCES wallet_accounts(id),
  remaining integer NOT NULL CHECK (remaining >= 0)
);
CREATE INDEX wallet_credit_lots_account ON wallet_credit_lots(account_id, id) WHERE remaining > 0;

CREATE TABLE wallet_tool_operations (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES wallet_accounts(id),
  tool text NOT NULL,
  operation_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('reserved', 'settled', 'released', 'expired')),
  cost integer NOT NULL CHECK (cost > 0),
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  delivery_ref text,
  settled_at bigint,
  UNIQUE (account_id, tool, operation_id),
  UNIQUE (account_id, tool, delivery_ref)
);
CREATE INDEX wallet_operations_expiry ON wallet_tool_operations(account_id, expires_at) WHERE state = 'reserved';

CREATE TABLE wallet_tool_holds (
  operation_id text NOT NULL REFERENCES wallet_tool_operations(id),
  lot_id bigint NOT NULL REFERENCES wallet_credit_lots(id),
  amount integer NOT NULL CHECK (amount > 0),
  PRIMARY KEY (operation_id, lot_id)
);
CREATE INDEX wallet_holds_by_lot ON wallet_tool_holds(lot_id);

CREATE TABLE wallet_invite_codes (
  code text PRIMARY KEY,
  account_id text NOT NULL REFERENCES wallet_accounts(id),
  channel text NOT NULL,
  UNIQUE (account_id, channel)
);

CREATE TABLE wallet_invite_visits (
  claim text PRIMARY KEY,
  wechat_key text NOT NULL,
  visitor_id text NOT NULL,
  code text NOT NULL REFERENCES wallet_invite_codes(code),
  entered_at bigint NOT NULL,
  claimed_by text REFERENCES wallet_accounts(id)
);
CREATE INDEX wallet_invite_visits_identity ON wallet_invite_visits(wechat_key, entered_at);

CREATE TABLE wallet_invite_visit_proofs (
  proof_key text PRIMARY KEY,
  claim text NOT NULL REFERENCES wallet_invite_visits(claim)
);

CREATE TABLE wallet_invitations (
  account_id text PRIMARY KEY REFERENCES wallet_accounts(id),
  inviter_id text NOT NULL REFERENCES wallet_accounts(id),
  reward integer NOT NULL,
  monthly_limit integer NOT NULL,
  expires_at bigint NOT NULL,
  reward_month text
);
CREATE INDEX wallet_invite_monthly ON wallet_invitations(inviter_id, reward_month);

CREATE TABLE wallet_first_use_events (reference text PRIMARY KEY);
