import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      external_id TEXT UNIQUE NOT NULL,
      name TEXT, first_name TEXT, last_name TEXT,
      membership_id TEXT,
      tg_first_name TEXT, tg_last_name TEXT, tg_username TEXT,
      submitted_username TEXT,
      preferences JSONB DEFAULT '{}'::jsonb,
      bonus JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      file_id TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id),
      action TEXT NOT NULL,
      meta JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS members (
      membership_id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name  TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_membership_id ON members (membership_id);

    CREATE TABLE IF NOT EXISTS pending_verifications (
      id BIGSERIAL PRIMARY KEY,
      external_id TEXT NOT NULL,
      provided_membership_id TEXT,
      full_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_verifications (status);
    CREATE INDEX IF NOT EXISTS idx_pending_external ON pending_verifications (external_id);

    CREATE TABLE IF NOT EXISTS raffles (
      key TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS raffle_entries (
      id BIGSERIAL PRIMARY KEY,
      raffle_key TEXT NOT NULL REFERENCES raffles(key) ON DELETE CASCADE,
      external_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (raffle_key, external_id)
    );

    CREATE TABLE IF NOT EXISTS notification_templates (
      id BIGSERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      buttons JSONB DEFAULT '[]'::jsonb,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    INSERT INTO messages (key,content) VALUES
      ('welcome','Merhaba, hoş geldiniz!'),
      ('not_member','Devam için resmi kanala katılın.'),
      ('events','Güncel etkinlik bulunamadı.'),
      ('guest_become_member','Kayıt bağlantısı yakında.'),
      ('guest_benefits','Ayrıcalıklar listesi yakında.'),
      ('member_update_account','Hesap güncelleme yakında.'),
      ('member_free_events','Şu an ücretsiz etkinlik yok.'),
      ('member_personal_offers','Yakında sunulacak.'),
      ('raffle_joined','Çekilişe katılımınız alındı. Bol şans!'),
      ('raffle_already','Zaten bu çekilişe katılmışsınız.')
    ON CONFLICT (key) DO NOTHING;

    INSERT INTO raffles (key,title,active)
      VALUES ('default_raffle','Genel Çekiliş',true)
      ON CONFLICT (key) DO NOTHING;
  `);
}
