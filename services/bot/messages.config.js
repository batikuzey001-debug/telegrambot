// Bot mesajları – sadece burayı düzenleyin.
// image_url vermezseniz sadece metin gönderilir.
// İlk gönderimde fotoğrafı Telegram file_id olarak önbelleğe almayacağız (basit tutuyoruz).
export default {
  welcome: {
    content: "📣 Merhaba, hoş geldiniz!",
    image_url: null
  },
  not_member: {
    content: "Devam edebilmek için resmi kanala katılın ve 'Kontrol Et' tuşuna basın.",
    image_url: null
  },
  events: {
    content: "Şu an gösterilecek etkinlik bulunamadı.",
    image_url: null
  },
  guest_become_member: {
    content: "Kayıt bağlantısını kullanarak hızlıca üye olabilirsiniz.",
    image_url: null
  },
  guest_benefits: {
    content: "Üyelere özel ayrıcalıklar burada listelenecek.",
    image_url: null
  },
  member_update_account: {
    content: "Hesap bilgilerinizi yakında buradan güncelleyebileceksiniz.",
    image_url: null
  },
  member_free_events: {
    content: "Ücretsiz etkinlik bulunamadı.",
    image_url: null
  },
  member_personal_offers: {
    content: "Size özel fırsatlar hazırlandığında burada göreceksiniz.",
    image_url: null
  },
  raffle_joined: {
    content: "🎟️ Çekilişe katılımınız alındı. Bol şans!",
    image_url: null
  },
  raffle_already: {
    content: "🔁 Bu çekilişe zaten katılmışsınız.",
    image_url: null
  }
};
