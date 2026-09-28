# analysis/ — Simulasi Monte Carlo pilihan jurusan & karier, 2026–2036

Folder ini berdiri sendiri dan tidak menyentuh firmware maupun dashboard
Aqua-M. Isinya dua simulasi Monte Carlo yang menjawab dua pertanyaan berbeda.

**Pertanyaan 1 — jurusan mana?** `major_demand_mc` membandingkan 25 jurusan:
mana yang permintaannya benar-benar tinggi lima sampai sepuluh tahun ke depan,
dan mana yang hanya terlihat begitu.

**Pertanyaan 2 — lalu kerja apa?** `robotics_career_mc` mengambil satu jurusan
(robotika di Indonesia) dan menyimulasikan sepuluh tahun karier satu orang
melintasi 14 segmen pemberi kerja yang benar-benar ada di sini.

| Berkas | Isi |
|---|---|
| [`LAPORAN_JURUSAN.md`](LAPORAN_JURUSAN.md) | **Pertanyaan 1.** Peringkat 25 jurusan, temuan, rekomendasi, batas model. |
| [`LAPORAN_KARIER_ROBOTIKA.md`](LAPORAN_KARIER_ROBOTIKA.md) | **Pertanyaan 2.** Prospek realistis lulusan robotika di Indonesia. |
| [`out/HASIL_SIMULASI.md`](out/HASIL_SIMULASI.md) | Delapan tabel keluaran mentah, dibuat otomatis. |
| [`out/hasil_simulasi.csv`](out/hasil_simulasi.csv) | 33 metrik × 25 jurusan, untuk diolah sendiri. |
| [`out/hasil_simulasi.json`](out/hasil_simulasi.json) | Sama, plus metadata run, pasangan lindung nilai, dan sumber. |
| [`major_demand_mc/params.py`](major_demand_mc/params.py) | Semua asumsi, dalam satu tempat. Ubah di sini. |
| [`major_demand_mc/mc.py`](major_demand_mc/mc.py) | Mesin simulasinya. |
| [`major_demand_mc/report.py`](major_demand_mc/report.py) | Pembentuk tabel dan penulis CSV/JSON. |
| [`major_demand_mc/run.py`](major_demand_mc/run.py) | CLI dan suite uji tekan asumsi. |
| [`out/robotika/HASIL_KARIER_ROBOTIKA.md`](out/robotika/HASIL_KARIER_ROBOTIKA.md) | Tujuh tabel keluaran simulasi karier. |
| [`out/robotika/profil_karier.csv`](out/robotika/profil_karier.csv) | 33 metrik × 5 profil lulusan. |
| [`out/robotika/segmen_kerja.csv`](out/robotika/segmen_kerja.csv) | 14 segmen kerja: porsi lulusan dan gaji. |
| [`robotics_career_mc/segments.py`](robotics_career_mc/segments.py) | Definisi 14 segmen + atribut pribadi. Ubah di sini. |
| [`robotics_career_mc/career.py`](robotics_career_mc/career.py) | Mesin simulasi karier per orang. |

## Menjalankan

```bash
cd analysis

# Pertanyaan 1: jurusan mana?
python3 -m major_demand_mc.run                  # 40.000 lintasan + 10 uji tekan
python3 -m major_demand_mc.run --trials 200000  # run lebih berat
python3 -m major_demand_mc.run --quick          # 5.000 lintasan, tanpa uji tekan

# Pertanyaan 2: lulusan robotika di Indonesia kerja apa?
python3 -m robotics_career_mc.run                  # 120.000 orang/profil + uji tekan
python3 -m robotics_career_mc.run --trials 400000  # run lebih berat
python3 -m robotics_career_mc.run --quick          # 15.000, tanpa uji tekan

# keduanya menerima --seed untuk cek konvergensi
python3 -m major_demand_mc.run --seed 12345
```

Python 3.8+, pustaka standar saja. Tanpa numpy, tanpa `pip install`.
Run jurusan 60.000 lintasan ≈ 28 detik; run karier 120.000 orang × 5 profil
≈ 39 detik.

## Model jurusan, singkat

Tiap lintasan mengundi satu dunia (rezim AI, siklus capex, kejutan sektor),
menumbuhkan permintaan tiap jurusan, mengurangi bagian yang diambil otomasi,
menumbuhkan pasokan lulusan dengan **jeda pendidikan empat tahun** — inilah
yang menghasilkan siklus boom-lalu-banjir — lalu menerjemahkan rasio
permintaan/pasokan menjadi upah riil dan peluang mendapat pekerjaan.

Keluarannya bukan ramalan, melainkan distribusi hasil di bawah asumsi yang
dinyatakan terbuka. Peringkat yang bertahan di kesepuluh uji tekan adalah
kesimpulan yang kuat; yang berayun jauh hanya benar kalau satu asumsi spesifik
kebetulan benar. Bagian "Yang model ini tidak tahu" di laporan menjelaskan
apa saja yang sengaja tidak dimodelkan.

## Model karier, singkat

Tiap lintasan adalah **satu orang**, bukan satu rata-rata. Diundi siapa dia
(kemampuan nyata, bahasa Inggris, jaringan, kesiapan pindah, toleransi risiko),
diundi dekade tempat dia lulus (siklus capex, komoditas, pendanaan startup),
lalu dia ditempatkan di salah satu dari 14 segmen dan menjalani sepuluh tahun:
PHK, pindah kerja, kenaikan upah riil, plafon yang dipersonalisasi. Pengalaman
di bidang membuka segmen yang tertutup bagi lulusan baru; tahun di luar bidang
mempersempit jalan kembali.

Temuannya, singkat: selisih antara profil lulusan pasif dan agresif adalah
**4 kali**, sementara tidak satu pun dari sembilan skenario makro menggeser
gaji median lebih dari **12%**.

Tidak setuju dengan sebuah angka? Ubah di `params.py` atau `segments.py`,
jalankan ulang, dan bandingkan. Itu gunanya ini berupa kode.
