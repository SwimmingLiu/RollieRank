-- Include credited orders in daily reconciliation for refunds whose push was lost.
DROP INDEX wallet_coin_recharges_due;
CREATE INDEX wallet_coin_recharges_due ON wallet_coin_recharges(app_id, offer_id, env, next_check_at)
  WHERE state IN ('pending', 'paid', 'credited', 'refund_pending');
