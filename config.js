// 1) Import data.csv ke Google Sheets.
// 2) Di Google Sheets: Share/Bagikan -> General access -> Anyone with the link -> Viewer.
// 3) Copy LINK Google Sheets (contoh .../spreadsheets/d/ID/edit#gid=0) ke sheetUrl.
// 4) Simpan perubahan config.js di GitHub. Tidak perlu ubah file lain saat tambah PO.
// PERHATIAN: Data Google Sheets yang dibuat publik dapat dibaca orang yang punya link.
window.MERCY_CONFIG = {
  sheetUrl: "", // GANTI: tempel link Google Sheets kamu di antara tanda petik
  sheetGid: "", // Opsional: isi angka gid tab data. Kosong = ambil dari link / default 0
  autoRefreshMinutes: 5
};
