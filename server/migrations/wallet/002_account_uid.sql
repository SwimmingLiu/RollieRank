CREATE SEQUENCE IF NOT EXISTS wallet_account_uid_seq START WITH 10001;

ALTER TABLE wallet_accounts
  ADD COLUMN IF NOT EXISTS uid integer;

UPDATE wallet_accounts
SET uid = nextval('wallet_account_uid_seq')
WHERE uid IS NULL;

ALTER TABLE wallet_accounts
  ALTER COLUMN uid SET DEFAULT nextval('wallet_account_uid_seq');

ALTER TABLE wallet_accounts
  ALTER COLUMN uid SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_accounts_uid_idx ON wallet_accounts(uid);
