# Güncellenmiş Bot Sistemi ve Backoffice Panel — Brief

## 1) Botun Temel İşlevleri ve Karşılama
- Kullanıcı “Merhaba” veya “Start” yazınca: “Merhaba, hoş geldiniz!”
- Ardından temel seçenekler: “Çekilişe Katıl”, “Etkinlikleri Gör”, “Hesap Bilgilerini Güncelle”.
- Menü öğeleri panelden yönetilebilir.

## 2) Uzun Vadeli ve Esnek Yapı
- Tüm içerik ve komutlar backoffice panelinden değiştirilebilir.
- Karşılama mesajları, seçenekler, kullanıcıya özel ayarlar dinamik.

## 3) Kişiselleştirme ve Kayıt
- Kullanıcı tercihleri ve istatistikleri saklanır.
- Kullanıcıya özel bonus/ayar tanımlanır.

## 4) Genel Hedef
- Sadece bot değil, satılabilir ve farklı ortamlarda çalışabilir sistem.
- Modüler mimari. Bileşenler değiştirilebilir. Yönetici dostu kontrol.

## MVP Kapsamı (Teknik)
- Postgres (Railway)
- API servis (Express)
- Bot servis (Telegram örnek)
- SQL şeması: users, messages, commands, menu_options, audit_logs
- ENV: DATABASE_URL, BOT_TOKEN, APP_URL, NODE_ENV, PORT
