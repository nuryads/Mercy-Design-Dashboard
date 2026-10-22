# MERCY ✿ Design & PO Dashboard (GitHub Pages)

Website dashboard MERCY dibuat dari data awal **61 baris**. Bisa online gratis di GitHub Pages dan mengambil pembaruan dari **Google Sheets** tanpa token/API key. Ada ringkasan QTY, follow-up ACC, status, grafik bulanan, filter, pencarian, dan ekspor CSV.

**Paling disarankan:** GitHub Pages untuk web + Google Sheets sebagai tempat edit PO. Website ini **read-only**; tombol **「＋ Tambah / Edit PO」** membuka Google Sheets yang hanya bisa diedit oleh orang yang punya izin. Jangan menaruh password atau data yang harus rahasia di repository/config.js.

## Bagian A — Supaya web bisa online di GitHub

1. Download file ZIP yang diberikan, lalu **ekstrak/unzip** di komputer.
2. Buka [GitHub](https://github.com/) → **New repository**, nama misalnya `mercy-dashboard`. Pilih **Public** jika akunmu menggunakan GitHub Free.
3. Upload **ISI folder** `MERCY_GitHub_Pages` langsung ke root repository (bukan file ZIP atau folder luarnya):
   - `index.html`
   - `app.js`
   - `data.js`
   - `data.csv`
   - `config.js`
   - `README.md`
   - `.nojekyll` (file tersembunyi; boleh diabaikan jika tidak terlihat)
4. Klik **Commit changes**.
5. Masuk **Settings → Pages** → **Build and deployment → Source: Deploy from a branch** → pilih `main` dan `/(root)` → **Save**.
6. Alamat website akan berbentuk `https://NAMAUSER.github.io/mercy-dashboard/`. GitHub mungkin memerlukan beberapa menit untuk menerbitkannya.

> `index.html` harus ada di root repository. Dashboard langsung menampilkan data awal **tanpa Google Sheets**, tetapi belum sinkron sampai Bagian B selesai.

## Bagian B — Hubungkan Google Sheets supaya PO bisa terus bertambah

1. Buka [Google Sheets](https://sheets.google.com) → buat spreadsheet baru, misalnya **MERCY DATA PO**.
2. Pilih **File → Import → Upload**, upload `data.csv` dari ZIP ini. Impor sebagai sheet baru/replace current sheet dan pastikan header ada di **baris 1** tanpa baris judul tambahan:

   | TGL | DESIGN | WARNA | QTY | CUSTOMER | KODE | KET |
   | --- | --- | --- | --- | --- | --- | --- |
   | 2026-10-21 | ORANGE STAR | ORANGE | 3000 | MERCY | DGT#MERCY-26-3781 | REPEAT |

3. Pada Google Sheets, klik **Share / Bagikan** → **General access / Akses umum: Anyone with the link / Siapa saja yang memiliki link** → hak akses **Viewer / Pelihat** → **Done**. Pemilik dan orang yang secara khusus diberi akses Editor tetap bisa mengubah data. **Jangan set Anyone with the link = Editor.**
4. Copy **URL Google Sheets yang biasa dari address bar**, formatnya seperti ini (ini **contoh format**, bukan link spreadsheet sungguhan):

   `https://docs.google.com/spreadsheets/d/ID_SPREADSHEET_KAMU/edit#gid=0`

   Pastikan `gid` merujuk pada tab data yang kolomnya TGL, DESIGN, dst. Jika Google Sheets punya beberapa tab, ambil URL saat tab data terbuka.
5. Di GitHub, buka file `config.js` → klik ikon pensil **Edit this file** → ubah **hanya** nilai `sheetUrl` seperti ini:

   ```javascript
   window.MERCY_CONFIG = {
     sheetUrl: "https://docs.google.com/spreadsheets/d/ID_SPREADSHEET_KAMU/edit#gid=0",
     sheetGid: "",
     autoRefreshMinutes: 5
   };
   ```

6. Klik **Commit changes**. Selesai! Dashboard akan membaca Google Sheets saat halaman dibuka, otomatis mencoba refresh tiap **5 menit** selama tab terbuka, dan ada tombol **「↻ Refresh data」** untuk memuat ulang.

**Penting:** akses publik Viewer digunakan supaya website bisa membaca data tanpa login. Ini artinya orang lain yang mempunyai URL file spreadsheet dapat melihat isinya. Jangan pakai skema ini untuk data internal rahasia, informasi sensitif, atau data pelanggan yang tidak boleh dipublikasikan.

## Bagian C — Kalau ada tambah PO, bagaimana?

1. Buka website MERCY, klik tombol **「＋ Tambah / Edit PO ↗」**.
2. Kamu akan diarahkan ke Google Sheets. Isi baris baru paling bawah. Contoh:

   | TGL | DESIGN | WARNA | QTY | CUSTOMER | KODE | KET |
   | --- | --- | --- | ---: | --- | --- | --- |
   | 2026-10-23 | ROSE GARDEN | PINK | 2000 | MERCY | PO-001 | ACC |

3. Atau edit baris lama jika terjadi revisi status atau perubahan QTY. Pastikan **QTY angka**, contohnya `2000`, bukan teks `2.000 pcs`.
4. Kembali ke dashboard, tekan **「↻ Refresh data」** (atau biarkan refresh otomatis). Kadang cache Google membutuhkan beberapa menit untuk menampilkan perubahan.
5. Semua grafik, jumlah PO, jumlah menunggu ACC, dan total QTY akan dihitung ulang.

**Status yang disarankan:** `TUNGGU ACC`, `REV SO`, `SO`, `ACC`, `REPEAT`. Status lain juga akan tampil di dashboard sebagai kategori tambahan.

**Kolom tambahan?** Jika mau menambah kolom `NO PO`, dashboard versi ini belum menampilkannya. Kolom utamanya jangan dihapus atau diganti nama sebelum kode disesuaikan.

## Bagian D — Alternatif kalau masih mau edit Excel biasa (tanpa Google Sheets)

1. Di `config.js`, biarkan `sheetUrl: ""`.
2. Buka `data.csv` dengan Excel lalu edit/tambah baris; atau simpan tabel Excel sebagai **CSV UTF-8** dengan header 7 kolom yang sama.
3. Di repository GitHub, **replace/upload ulang file `data.csv`**, lalu **Commit changes**.
4. Website membaca `data.csv` yang baru ketika dibuka atau ketika tombol **Refresh data** diklik. Tidak perlu edit `index.html`.

Ini tetap membutuhkan commit ke GitHub tiap kali ada update CSV. **Google Sheets lebih mudah untuk update harian.** File `data.js` hanya sebagai data cadangan untuk pratinjau offline atau saat file CSV gagal dimuat.

## Tanya-jawab singkat

**Q: Bisa edit langsung dalam dashboard tanpa pindah Google Sheets?**

A: Belum. GitHub Pages merupakan static hosting dan tidak mempunyai server untuk menyimpan perubahan langsung. Untuk form input PO di dalam website yang menyimpan data untuk semua orang, diperlukan backend/layanan autentikasi (mis. Apps Script + sistem izin atau Supabase). Jangan memasukkan token atau password Google ke `config.js`.

**Q: Saya sudah tambah PO tapi belum muncul?**

A: Periksa kolom header di baris 1, pastikan PO ada di tab/gid yang benar, akses Viewer publik aktif, lalu klik Refresh. Perubahan Google Sheets kadang butuh beberapa menit karena cache. Perhatikan indikator di atas dashboard: **Terhubung ke Google Sheets** atau **Tidak bisa sinkron**.

**Q: QTY dashboard beda dengan total di dokumen awal?**

A: Pada data asli yang dikirim, jumlah seluruh baris QTY adalah **48.500**, tetapi footer manual bertuliskan **40.000**. Dashboard menjumlahkan QTY **per baris**, tidak mengambil nilai footer manual. Periksa apakah ada PO repeat yang sengaja harus dihitung / tidak.

**Q: Gratis?**

A: GitHub Pages tersedia untuk repository publik pada GitHub Free. Google Sheets dapat digunakan secara gratis dengan akun Google pribadi, tergantung kebijakan dan kuota layanan. Pastikan data aman untuk dipublikasikan.

Referensi: [GitHub Pages: Configure a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [Google Sheets: Sharing](https://support.google.com/docs/answer/2494822) · [Google Charts: Google Spreadsheets data sources](https://developers.google.com/chart/interactive/docs/spreadsheets)
