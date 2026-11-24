# Project #2 — FRANKENBAND (Kiroween 2026, kategori Frankenstein)

Keputusan: 23 Nov 2026 (asisten memutuskan atas pertanyaan Ajeng; aturan resmi membolehkan
banyak submission asal unik dan beda jauh dari submission lain — REVENANT beda total dari ini).

## Konsep
Satu halaman web yang menjahit TIGA teknologi suara dari tiga zaman yang tidak kompatibel
menjadi satu band monster yang bisa dimainkan:

1. **Theremin (1920-an)** — instrumen elektronik tertua: osilator Web Audio yang nadanya
   dikendalikan gerakan mouse/sentuhan (X = pitch, Y = volume), tanpa menyentuh apa pun.
2. **Chiptune 8-bit (1980-an)** — melodi digenerate dari teks yang diketik user: hash teks
   menjadi seed, seed menjadi melodi square-wave ala Game Boy (skala minor, pola arpeggio).
3. **Suara AI modern (2020-an)** — narasi text-to-speech (suara perempuan muda, aturan tetap
   Ajeng) yang "mengumumkan" lagu ciptaan user di atas panggung konser monster.

User mengetik satu kalimat → band memainkan: melodi chiptune dari kalimat itu + user bisa
solo theremin di atasnya + MC AI mengumumkan judul lagunya. Semua di browser, tanpa API key,
tanpa server (Web Audio API + SpeechSynthesis/TTS file untuk video demo).

Kenapa Frankenstein: tiga organ dari tiga abad berbeda dijahit ke satu tubuh — persis definisi
kategori ("stitch together a chimera of technologies... seemingly incompatible elements").

## Bedanya dari REVENANT (syarat "substantially different")
- Domain: musik/permainan interaktif, bukan developer tool.
- Tidak ada GitHub API, tidak ada registry, tidak ada diagnosis/score.
- Interaksi utama: bermain suara real-time, bukan analisis URL.

## Fitur minimum (target terkirim)
- Panggung visual haunted (CSS murni, tanpa gambar AI): tirai, bulan, siluet organ pipa.
- Kotak teks "Write your monster's song" → tombol "Stitch it together".
- Engine melodi: hash deterministik (FNV-1a) → seed → melodi 16 langkah (skala A minor
  harmonik), tempo 112 BPM, square wave + noise drum sederhana.
- Theremin layer: pointermove di area panggung mengendalikan osilator + gain; tombol on/off.
- Rekam & putar ulang aransemen terakhir (MediaRecorder bila tersedia; fallback: replay
  deterministik dari seed yang sama).
- Halaman menampilkan "organ" yang sedang aktif (Theremin / Chip Heart / AI Voice) sebagai
  indikator jahitan.

## Pemakaian Kiro (wajib asli, spec-first, seperti REVENANT)
- `.kiro/specs/melody-engine/` (requirements.md, design.md, tasks.md) ditulis asisten dulu.
- Sesi Kiro CLI asli mengimplementasikan `melody.js` (pure logic, UMD) + tes node:test.
- Verifikasi mandiri: tes hijau, file inti yang tidak boleh berubah tetap byte-identical.
- Klaim hanya yang benar-benar terjadi. Tidak ada klaim Crew/MCP bila tidak dijalankan.

## Paket submission (sama seperti REVENANT)
- Repo publik GitHub + MIT + folder `/.kiro` di root.
- App live di GitHub Pages; render diverifikasi di browser asli (tidak boleh blank).
- Video demo YouTube publik < 3 menit, rekaman layar asli, narasi suara perempuan 19 tahun
  membaca teks yang persis sama dengan subtitle (aturan tetap Ajeng 22 Nov 2026).
- Devpost: kategori Frankenstein; bonus yang realistis: Best Demo + Bonus Blog (blog dev.to
  kedua, beda isi) + Social Blitz post ke-2 (post baru, mulai dengan #KiroweenHackathon26).
- Overall otomatis ikut; Best Kiro Crew App TIDAK dicentang kecuali Crew benar-benar dipakai.

## Jadwal
- 24–27 Nov: bangun app + sesi Kiro + tes + Pages live.
- 28 Nov–1 Des: JEDA (Agentware 72 jam prioritas penuh).
- 1 Des: kuota Kiro gratis reset — sesi Kiro tambahan bila perlu.
- 2–4 Des: video, blog, submit Devpost. Semua terkunci sebelum 5 Des 05:00 WIB.
- REVENANT diperkuat di jendela yang sama (sesi Kiro tambahan 1 Des, edit Devpost ≤ 4 Des).
