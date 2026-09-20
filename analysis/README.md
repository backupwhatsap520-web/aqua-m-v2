# analysis/ — Simulasi permintaan lulusan 2026–2036

Folder ini berdiri sendiri dan tidak menyentuh firmware maupun dashboard
Aqua-M. Isinya satu simulasi Monte Carlo untuk menjawab: **jurusan kuliah mana
yang permintaannya benar-benar tinggi lima sampai sepuluh tahun ke depan, dan
mana yang hanya terlihat begitu.**

| Berkas | Isi |
|---|---|
| [`LAPORAN_JURUSAN.md`](LAPORAN_JURUSAN.md) | **Mulai dari sini.** Peringkat, temuan, rekomendasi, dan batas-batas modelnya. |
| [`out/HASIL_SIMULASI.md`](out/HASIL_SIMULASI.md) | Delapan tabel keluaran mentah, dibuat otomatis. |
| [`out/hasil_simulasi.csv`](out/hasil_simulasi.csv) | 33 metrik × 25 jurusan, untuk diolah sendiri. |
| [`out/hasil_simulasi.json`](out/hasil_simulasi.json) | Sama, plus metadata run, pasangan lindung nilai, dan sumber. |
| [`major_demand_mc/params.py`](major_demand_mc/params.py) | Semua asumsi, dalam satu tempat. Ubah di sini. |
| [`major_demand_mc/mc.py`](major_demand_mc/mc.py) | Mesin simulasinya. |
| [`major_demand_mc/report.py`](major_demand_mc/report.py) | Pembentuk tabel dan penulis CSV/JSON. |
| [`major_demand_mc/run.py`](major_demand_mc/run.py) | CLI dan suite uji tekan asumsi. |

## Menjalankan

```bash
cd analysis
python3 -m major_demand_mc.run                  # 40.000 lintasan + 10 uji tekan
python3 -m major_demand_mc.run --trials 200000  # run lebih berat
python3 -m major_demand_mc.run --quick          # 5.000 lintasan, tanpa uji tekan
python3 -m major_demand_mc.run --seed 12345     # seed lain untuk cek konvergensi
```

Python 3.8+, pustaka standar saja. Tanpa numpy, tanpa `pip install`. Run
60.000 lintasan memakan sekitar 28 detik.

## Modelnya, singkat

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

Tidak setuju dengan sebuah angka? Ubah di `params.py`, jalankan ulang, dan
bandingkan. Itu gunanya ini berupa kode.
