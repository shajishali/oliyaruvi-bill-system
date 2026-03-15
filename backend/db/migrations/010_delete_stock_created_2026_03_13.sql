-- Delete stock items created/updated on 13/03/2026
DELETE FROM frame_sizes WHERE date(updated_at) = '2026-03-13';
DELETE FROM photo_sizes WHERE date(updated_at) = '2026-03-13';
