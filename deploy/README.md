# Panduan deploy JPPhone

Dua susunan yang didukung:

| Susunan | Kapan dipakai |
|---|---|
| **A. Satu server** — dashboard + phone di mesin yang sama | Server ARM64 besar (mis. 8 core / 16 GB ke atas) |
| **B. Dua server** — dashboard di server kecil, phone di server ARM terpisah | Dashboard di VPS murah (mis. 2 vCPU / 2 GB), phone di server ARM |

Semua perintah dijalankan di **Ubuntu 22.04 / 24.04** sebagai user yang bisa `sudo`.

---

## Langkah 1 — Server dashboard

1. **Domain:** buat record DNS `A` untuk domainmu (mis. `jpphone.com`) ke IP server.
2. **Salin project** ke server (dari komputermu):
   ```bash
   scp -r JPPHONE_DASHBOARD ubuntu@IP-SERVER:~/
   ```
   (atau `git clone` kalau project sudah di GitHub)
3. **Install:**
   ```bash
   cd ~/JPPHONE_DASHBOARD
   sudo bash deploy/install-app.sh jpphone.com
   ```
   Skrip ini memasang Node 22, Docker, ADB, Caddy (HTTPS otomatis), membuat service `jpphone`, dan menampilkan **admin token** — simpan baik-baik.
4. Buka `https://jpphone.com` → buat akun. Saat ini `ENGINE=mock` (phone pura-pura) untuk mengecek dashboard, login, dan pembayaran dulu.

Pengaturan ada di `/etc/jpphone.env`. Setelah mengubah: `sudo systemctl restart jpphone`.

---

## Langkah 2 — Server phone (Redroid)

Di server yang akan menjalankan phone (**ARM64**, KVM/dedicated — bukan VPS container):

```bash
sudo ANDROID_VERSIONS="13 12" bash install-phone-host.sh
```

(Untuk susunan B, salin dulu file `deploy/install-phone-host.sh` ke server phone.)

Skrip ini memasang Docker + modul `binder`, mengunduh image Android, lalu **menyalakan satu phone uji**. Kalau muncul `Phone host ready.` → server cocok. Kalau `FAILED: this kernel has no binder support` → server tidak bisa dipakai untuk phone (ganti ke KVM/dedicated).

### Susunan A (satu server)

Edit `/etc/jpphone.env`:
```
ENGINE=redroid
REGION_HOSTS='{}'
```
lalu `sudo systemctl restart jpphone`.

### Susunan B (dua server, dihubungkan WireGuard)

Port ADB phone **tidak boleh terbuka ke internet**. Hubungkan kedua server lewat jaringan privat WireGuard:

1. Di **kedua** server: `sudo apt install -y wireguard` lalu `wg genkey | tee priv | wg pubkey > pub`.
2. Server phone — `/etc/wireguard/wg0.conf`:
   ```ini
   [Interface]
   Address = 10.8.0.2/24
   ListenPort = 51820
   PrivateKey = <isi file priv server phone>

   [Peer]
   PublicKey = <isi file pub server dashboard>
   AllowedIPs = 10.8.0.1/32
   ```
3. Server dashboard — `/etc/wireguard/wg0.conf`:
   ```ini
   [Interface]
   Address = 10.8.0.1/24
   PrivateKey = <isi file priv server dashboard>

   [Peer]
   PublicKey = <isi file pub server phone>
   Endpoint = <IP-PUBLIK-SERVER-PHONE>:51820
   AllowedIPs = 10.8.0.2/32
   PersistentKeepalive = 25
   ```
4. Di kedua server: `sudo systemctl enable --now wg-quick@wg0`, buka port UDP 51820 di firewall/security group server phone. Cek: `ping 10.8.0.2` dari server dashboard.
5. **SSH key:** tempel SSH key yang ditampilkan di akhir `install-app.sh` (atau `sudo cat /var/lib/jpphone/.ssh/id_ed25519.pub`) ke `/home/deploy/.ssh/authorized_keys` di server phone. Lalu sekali saja, dari server dashboard:
   ```bash
   sudo -u jpphone ssh deploy@10.8.0.2 docker ps
   ```
   (jawab `yes` untuk menyimpan host key).
6. Edit `/etc/jpphone.env` di server dashboard:
   ```
   ENGINE=redroid
   REGION_HOSTS='{"*": {"docker": "ssh://deploy@10.8.0.2", "adb": "10.8.0.2", "bind": "10.8.0.2"}}'
   ```
   `bind` membuat port ADB phone hanya terbuka di jaringan WireGuard. Lalu `sudo systemctl restart jpphone`.

---

## Langkah 3 — Video & kontrol cepat (scrcpy)

Di **server dashboard**:
```bash
sudo curl -L -o /opt/jpphone/server/data/scrcpy-server \
  https://github.com/Genymobile/scrcpy/releases/download/v3.1/scrcpy-server-v3.1
sudo chown jpphone:jpphone /opt/jpphone/server/data/scrcpy-server
sudo systemctl restart jpphone
```
`SCRCPY_VERSION` di `/etc/jpphone.env` harus sama dengan versi file (`3.1`).

## Langkah 4 — Pembayaran & email

Di `/etc/jpphone.env`:
- **Midtrans:** `MIDTRANS_SERVER_KEY=...` (sandbox dulu; `MIDTRANS_PRODUCTION=1` untuk live). Di dashboard Midtrans isi *Payment Notification URL*: `https://jpphone.com/api/payments/midtrans`.
- **Email:** `RESEND_API_KEY=...` **atau** `SMTP_URL=smtps://user:pass@smtp.server.com:465`, dan `MAIL_FROM="JPPhone <no-reply@jpphone.com>"`.

Restart: `sudo systemctl restart jpphone`.

## Langkah 5 — Isi toko & redeem code (admin)

```bash
TOKEN=<admin token dari langkah 1>
# APK Cloud store (nama sesuai katalog: roblox, chrome, telegram, ...)
curl -X PUT -H "Authorization: Bearer $TOKEN" --data-binary @Roblox.apk https://jpphone.com/api/admin/apks/roblox
# 10 redeem code MVIP 30 hari
curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"kind":"plan","planSlug":"mvip","days":30,"count":10}' https://jpphone.com/api/admin/codes
```

## Langkah 6 (opsional) — Ping per region

Di setiap server region: pasang Caddy, salin `deploy/Caddyfile.ping` ke `/etc/caddy/Caddyfile` (ganti domainnya), `sudo systemctl reload caddy`. Lalu di server dashboard:
```
REGION_PING='{"sg":"https://sg.jpphone.com/ping"}'
```

---

## Sehari-hari

| Perlu | Perintah |
|---|---|
| Lihat log | `journalctl -u jpphone -f` |
| Restart | `sudo systemctl restart jpphone` |
| Update kode | salin project baru → `sudo bash deploy/install-app.sh jpphone.com` (data & pengaturan tetap) |
| Lihat phone yang jalan | `docker ps` (di server phone) |
| Masuk ke shell phone | `adb connect 127.0.0.1:<port>` lalu `adb shell` |

### Phone kedaluwarsa
Otomatis: email + notifikasi 24 jam sebelum habis → saat habis phone dimatikan + email "akan dihapus tanggal X" → email terakhir sehari sebelum dihapus → setelah `EXPIRE_GRACE_DAYS` (default 7 hari) phone dan datanya dihapus permanen. Renew sebelum itu = phone aman.

### Kalau ada masalah
- **Phone status "Error: Boot timed out"** → di server phone: `docker logs jp-<id-device>`; cek RAM cukup (`free -h`).
- **Video tidak muncul, hanya gambar diam** → file `scrcpy-server` belum ada / versinya beda, atau browser lama. Player otomatis pakai mode screenshot.
- **Game tidak bisa dibuka** → hampir selalu karena server x86. Pakai server ARM64.
- **Email tidak terkirim** → `journalctl -u jpphone | grep mail`.
