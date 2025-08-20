## Fhenix Auto Deposit Bot

Bot otomatis untuk melakukan deposit ETH ke jaringan Fhenix melalui kontrak proxy di jaringan Ethereum Sepolia. Bot ini dirancang untuk berjalan 24/7 dengan jadwal harian yang dapat dikonfigurasi.

# 🚀 Fitur

· Deposit ETH otomatis ke kontrak Fhenix
· Penjadwalan deposito harian yang dapat dikustomisasi
· Gas fee optimization dengan EIP-1559
· Progress tracking dengan visual bar
· Penanganan error dan retry mechanism
· Support jaringan Sepolia testnet

# 📋 Prasyarat

· Node.js (v18 atau lebih baru)
· npm atau yarn
· Akun Ethereum dengan private key
· ETH di jaringan Sepolia (untuk gas fee)

# ⚙️ Instalasi

1. Clone atau download proyek ini
2. Install dependencies:

```bash
git clone https://github.com/dicoderin/fhenix.git
cd fhenix
npm install ethers chalk
```

1. Buat file pv.txt di root directory dan masukkan private key Anda (format hex dengan 0x prefix)

# 🛠 Konfigurasi

Semua konfigurasi dapat diubah dalam file config.js:

```javascript
const CONFIG = {
  RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
  CHAIN_ID: 11155111,
  MIN_AMOUNT_ETH: 0.0001,
  MAX_AMOUNT_ETH: 0.0004,
  PRIORITY_FEE_GWEI: 0.26,
  TIMEZONE_OFFSET_MIN: 330, // IST (UTC+5:30)
  MIN_DELAY_SEC: 1,
  MAX_DELAY_SEC: 5,
};
```

# 🚀 Penggunaan

Jalankan bot dengan perintah:

```bash
node bot.js
```

Bot akan meminta jumlah deposit harian yang diinginkan dan mulai bekerja secara otomatis.

# 📝 Catatan Penting

· Bot ini dibuat untuk jaringan Sepolia testnet
· Pastikan wallet memiliki cukup ETH untuk gas fee dan deposit
· Private key disimpan secara lokal dalam file pv.txt
· Bot akan berjalan terus hingga dihentikan secara manual

## ⚠️ Disclaimer

Bot ini ditujukan untuk tujuan edukasi dan pengembangan di jaringan testnet. Penggunaan di mainnet memerlukan penyesuaian dan audit keamanan tambahan.
