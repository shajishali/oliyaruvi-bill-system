-- Backfill: for bills with amount_paid > 0, add advance to payment_transactions if missing
-- Handles bills created when payment_transactions insert failed or before migration 021
INSERT OR IGNORE INTO payment_transactions (bill_id, amount, paid_at, payment_method, payment_type)
SELECT b.id, (b.amount_paid - COALESCE(t.s, 0)), b.bill_date,
  CASE WHEN LOWER(COALESCE(b.payment_method, 'Cash')) = 'bank' THEN 'Bank' ELSE 'Cash' END,
  'advance'
FROM bills b
LEFT JOIN (
  SELECT bill_id, SUM(amount) as s FROM payment_transactions GROUP BY bill_id
) t ON b.id = t.bill_id
WHERE COALESCE(b.amount_paid, 0) > 0
  AND (b.amount_paid - COALESCE(t.s, 0)) > 0;
