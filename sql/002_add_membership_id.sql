ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_id TEXT;

-- Daha önce aynı kullanıcı için membership_id varsa güncellenir.
