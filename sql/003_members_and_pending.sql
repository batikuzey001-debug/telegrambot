-- RadissonBet üyelik master listesi (backoffice önceden yükleyecek)
CREATE TABLE IF NOT EXISTS members (
  membership_id TEXT PRIMARY KEY,           -- sadece sayılardan oluşacak (uygulama tarafında doğrulanır)
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hızlı arama için
CREATE INDEX IF NOT EXISTS idx_membership_id ON members (membership_id);

-- Bot üzerinden doğrulanamayanlar için bekleyen talepler
CREATE TABLE IF NOT EXISTS pending_verifications (
  id BIGSERIAL PRIMARY KEY,
  external_id TEXT NOT NULL,                -- Telegram user id
  provided_membership_id TEXT,              -- kullanıcı yazdıysa
  full_name TEXT,                           -- kullanıcıdan alınan ad soyad
  status TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'approved' | 'rejected'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_verifications (status);
CREATE INDEX IF NOT EXISTS idx_pending_external ON pending_verifications (external_id);

-- users tablosunda isim alanlarını kolayca doldurabilmek için opsiyonel kolonlar
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name  TEXT;

-- Örnek seed (isteğe bağlı, silebilirsin)
-- INSERT INTO members (membership_id, first_name, last_name) VALUES
--   ('10001','Alparslan','Yılmaz'),
--   ('10002','Tuğrul','Çakır')
-- ON CONFLICT (membership_id) DO NOTHING;
