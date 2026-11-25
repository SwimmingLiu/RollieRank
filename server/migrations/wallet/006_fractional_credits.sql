-- Store wallet ledger quantities in fixed-point tenths (1 credit = 10 units) so 0.1-credit tool pricing stays exact.
ALTER TABLE wallet_rules ADD COLUMN credit_scale smallint NOT NULL DEFAULT 10 CHECK (credit_scale = 10);

UPDATE wallet_ledger
SET amount = amount * 10,
    balance_after = balance_after * 10;

UPDATE wallet_credit_lots
SET remaining = remaining * 10;

UPDATE wallet_tool_operations
SET cost = cost * 10;

UPDATE wallet_tool_holds
SET amount = amount * 10;

UPDATE wallet_invitations
SET reward = reward * 10;

UPDATE wallet_rules
SET value = jsonb_set(value, '{costs,answer-sheet}', '0.1'::jsonb)
WHERE value #> '{costs,answer-sheet}' = '1'::jsonb;
