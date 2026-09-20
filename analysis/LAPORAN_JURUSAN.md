# Jurusan Kuliah dengan Permintaan Tertinggi, 2026–2036

Simulasi Monte Carlo 25 jurusan × 60.000 lintasan × 10 tahun, plus 10 skenario
uji tekan asumsi — sekitar 40 juta tahun-jurusan yang disimulasikan. Angka
mentahnya ada di [`out/HASIL_SIMULASI.md`](out/HASIL_SIMULASI.md),
[`out/hasil_simulasi.csv`](out/hasil_simulasi.csv) dan
[`out/hasil_simulasi.json`](out/hasil_simulasi.json). Kodenya ada di
[`major_demand_mc/`](major_demand_mc/).

Dokumen ini ditulis untuk seseorang yang bekal awalnya di robotika/embedded —
konteksnya ada di repo ini sendiri: Aqua-M V2 adalah robot irigasi rel-guided
berbasis ESP32 dengan sensor, aktuator, dan fallback kendali on-board.

---

## Jawaban singkat

Kalau Anda hanya punya waktu membaca satu bagian, baca yang ini.

**Lapis 1 — langka secara struktural, bertahan di hampir semua skenario**

| Jurusan | Gaji riil 2036 (median) | Peluang bidang langka | Hasil di skenario terburuk |
|---|---|---|---|
| Mikroelektronika & Semikonduktor | Rp 15,0 jt/bln | 81% | 10,34 |
| Teknik Elektro — Sistem Tenaga | Rp 12,8 jt/bln | 85% | 9,27 |
| Teknik Metalurgi & Material | Rp 12,4 jt/bln | 80% | 9,27 |
| Teknik Pertambangan | Rp 13,2 jt/bln | 61% | 9,24 |
| Kedokteran | Rp 11,1 jt/bln | 83% | 9,03 |

**Lapis 2 — permintaan kuat, cocok dengan bekal robotika Anda**

| Jurusan | Gaji riil 2036 (median) | Peluang bidang langka | Irisan dgn robotika |
|---|---|---|---|
| Teknik Dirgantara & UAV | Rp 11,9 jt/bln | 74% | 0,80 |
| Teknik Kendali & Otomasi Industri | Rp 11,5 jt/bln | 74% | 0,92 |
| Teknik Komputer / Sistem Tertanam | Rp 11,5 jt/bln | 64% | 0,90 |
| Teknik Robotika & Mekatronika | Rp 11,1 jt/bln | 65% | 1,00 |
| Keamanan Siber | Rp 11,7 jt/bln | 47% | 0,40 |

**Lapis 3 — gaji masih tinggi, tetapi gerbang masuknya sempit**

Ilmu Komputer AI/ML (Rp 10,7 jt/bln, tapi 69% peluang banjir lulusan),
Sains Data (Rp 8,1 jt, 78% banjir), Teknik Energi Terbarukan, Biomedis.

**Lapis 4 — hindari sebagai taruhan tunggal sepuluh tahun**

Desain Komunikasi Visual (95% peluang banjir lulusan, 47% tugas inti terotomasi),
Akuntansi & Keuangan (89%, 36%), Rekayasa Perangkat Lunak generalis (83%, 47%),
Teknik Industri (74%).

Semua rupiah di harga 2026 (sudah riil, bukan nominal), untuk lulusan baru
Indonesia yang naik ke tahun ke-10 kariernya.

---

## Cara membaca angkanya

Tiga kolom yang dipakai berulang:

- **Skor peluang** — gaji riil bulanan di 2036 dikali peluang benar-benar
  bekerja di bidang itu. Jadi jurusan bergaji tinggi tapi sulit dimasuki akan
  otomatis terpotong. Satuannya juta rupiah per bulan, harga 2026.
- **Ketat** — rasio permintaan terhadap pasokan lulusan di tahun ke-10. Di atas
  1,0 berarti pemberi kerja yang berebut; di bawah 1,0 berarti pelamar yang
  berebut.
- **Skenario terburuk** — skor rata-rata di rezim dunia yang paling tidak
  ramah bagi jurusan itu. Ini angka yang seharusnya memutuskan komitmen
  sepuluh tahun, bukan rata-rata.

Setiap lintasan mengundi satu "dunia": rezim AI (akselerasi 35%, baseline 45%,
koreksi 20%), satu siklus capex global, dan satu kejutan per sektor. Jurusan
di sektor yang sama naik-turun bersama, persis seperti di dunia nyata.

---

## Lima temuan yang berlawanan dengan intuisi

### 1. Yang paling langka justru yang paling sepi peminat

Mikroelektronika & Semikonduktor keluar sebagai peringkat 1, dan bertahan di
peringkat 1 di **kesepuluh** uji tekan asumsi — tidak bergeser satu tingkat pun,
bahkan ketika semua CAGR permintaan dipangkas 2 poin persen atau peluang AI
Winter digandakan. Penyebabnya bukan permintaannya yang paling meledak,
melainkan pasokannya yang paling seret: Deloitte memperkirakan kebutuhan
tambahan lebih dari satu juta pekerja terampil secara global pada 2030,
sementara di AS hanya sekitar 3% lulusan teknik yang masuk industri chip.

Pola yang sama berlaku untuk Teknik Elektro Sistem Tenaga. Kearney dan IEEE
memperkirakan sektor listrik global butuh 450.000–1.500.000 insinyur tambahan
pada 2030 untuk membangun infrastruktur energi, sementara enrolmen power
engineering menyusut dan angkatan kerjanya menua.

**Kelangkaan adalah cerita pasokan, bukan cerita permintaan.** Jurusan yang
"kelihatan keren" menarik pendaftar, dan pendaftar adalah pasokan.

### 2. Robotika bagus, tapi bukan yang paling ketat — dan alasannya penting

Robotika & Mekatronika keluar di peringkat 10 dari 25, dengan gaji median
Rp 11,1 juta dan peluang langka 65%. Itu hasil yang baik, tetapi di bawah
semikonduktor dan sistem tenaga.

Alasannya bukan permintaan. Modal yang masuk ke robotika nyata: startup
robotika dan physical-AI menarik $47,4 miliar dalam 521 transaksi hanya di
paruh pertama 2026. Alasannya adalah **pasokan lulusan robotika tumbuh cepat** —
prodi robotika/mekatronika bermunculan justru karena bidang ini terlihat
menarik.

Uji tekan mengonfirmasi ini dengan brutal: skenario "ledakan lulusan robotika"
menjatuhkan Robotika dari #10 ke #15 dan Kendali/Otomasi dari #6 ke #13 —
penurunan terbesar yang dialami jurusan mana pun di seluruh suite uji tekan.
Sebaliknya, skenario "capex robotika meledak" hanya menaikkannya dua tingkat.

Artinya: **risiko terbesar bidang robotika bukan AI mengganti Anda, melainkan
terlalu banyak orang lain ikut masuk.**

### 3. Untuk AI/ML, AI bukan ancamannya — teman seangkatan Anda ancamannya

AI/ML tetap bergaji tinggi (median Rp 10,7 juta, tertinggi kedua di antara
jurusan IT) tetapi peluang banjir lulusannya 69% dan peluang lulusan baru
tembus pekerjaan pertama hanya 55%.

Dekomposisi sensitivitas menunjukkan sumbernya. Untuk AI/ML, kejutan pasokan
lulusan menjelaskan porsi ragam terbesar kedua (r = −0,54), sementara
kecepatan otomasi hampir tidak berpengaruh sama sekali (r = −0,03). Untuk
Rekayasa Perangkat Lunak generalis polanya lebih ekstrem lagi: pasokan
menjelaskan ~32% ragam hasil.

Ini cocok dengan yang sudah terlihat di 2026: lulusan ilmu komputer baru
menganggur 6,1%, lebih tinggi daripada lulusan komunikasi atau sejarah;
lowongan entry-level software turun sekitar 30% year-over-year; kurang dari 2%
lowongan adalah posisi junior. Bidang ini tidak mati — ia sedang kelebihan
pendaftar di pintu masuknya.

**Ini juga asumsi paling rapuh di seluruh model saya.** Saya memberi AI/ML
pertumbuhan pasokan lulusan 14%/tahun. Kalau itu ternyata hanya separuhnya,
AI/ML melompat dari #11 ke **#2** — lompatan terbesar di seluruh uji tekan.
Jadi jangan baca peringkat AI/ML sebagai vonis; bacalah sebagai: *taruhannya
sepenuhnya tergantung berapa banyak orang lain yang ikut mendaftar.*

### 4. Otomasi memukul lewat level, bukan lewat ketidakpastian

Di tabel sensitivitas, "kecepatan otomasi" hampir selalu punya korelasi nol.
Itu bukan berarti otomasi tidak penting — justru sebaliknya. Otomasi di model
ini masuk lewat parameter struktural (paparan tugas, benteng fisik, benteng
lisensi), jadi efeknya muncul sebagai **perbedaan level permanen antarjurusan**,
bukan sebagai ketidakpastian di dalam satu jurusan.

Lihat kolom porsi tugas inti yang terotomasi pada 2036: DKV 47%, SW generalis
47%, Sains Data 37%, Akuntansi 36%, AI/ML 32% — lawan Elektro Tenaga 4%,
Dirgantara 4%, Metalurgi 5%, Robotika 6%, Kendali 6%, Kedokteran 2%.

Pekerjaan yang butuh tangan, lokasi fisik, dan tanda tangan berlisensi bertahan.
Pekerjaan yang seluruhnya hidup di dalam layar tidak. Skenario "otomasi
menembus kerja fisik lebih cepat" pun tidak menggeser satu pun peringkat
tujuh jurusan utama — benteng fisik itu tebal.

### 5. Hampir tidak ada lindung nilai sejati di teknik

Saya mencari pasangan bidang dengan korelasi terendah di antara 12 jurusan
terkuat. Korelasi terendah yang ditemukan adalah **+0,08** (Kedokteran ×
AI/ML). Tidak ada satu pun pasangan yang negatif.

Semua bidang teknik naik dan turun bersama siklus capex global. Kalau belanja
modal dunia berhenti, semuanya kena — semikonduktor, robotika, energi,
pertambangan. Satu-satunya peredam nyata di daftar ini adalah Kedokteran
(sensitivitas capex 0,35 versus 1,25 untuk robotika dan 1,30 untuk semikonduktor),
dan itu bukan bidang yang bisa Anda ambil sebagai pelengkap.

Konsekuensi praktisnya: **jangan berpura-pura sedang melakukan diversifikasi
dengan mengambil dua jurusan teknik.** Yang bisa Anda lakukan adalah memilih
bidang yang kasus terburuknya paling tidak menyakitkan.

---

## Untuk Anda yang bekalnya robotika

Peringkat berikut menyesuaikan skor dengan irisan terhadap bekal yang sudah
Anda punya — karena ramp-up Anda di bidang bersebelahan lebih cepat daripada
orang yang mulai dari nol.

| # | Jurusan | Skor + fit | Irisan | Terotomasi 2036 |
|---|---|---|---|---|
| 1 | Mikroelektronika & Semikonduktor | 11,40 | 0,70 | 8% |
| 2 | Teknik Kendali & Otomasi Industri | 9,52 | 0,92 | 6% |
| 3 | Teknik Dirgantara & UAV | 9,34 | 0,80 | 4% |
| 4 | Teknik Robotika & Mekatronika | 9,29 | 1,00 | 6% |
| 5 | Teknik Komputer / Sistem Tertanam | 9,26 | 0,90 | 13% |
| 6 | Teknik Elektro — Sistem Tenaga | 9,21 | 0,55 | 4% |

Kesimpulan strategisnya satu kalimat: **robotika adalah lapisan aplikasi;
kelangkaan ada di lapisan yang menopangnya.** Anda sudah punya lapisan
aplikasinya. Yang perlu ditambahkan adalah salah satu lapisan bawah.

Tiga jalur yang masuk akal, berurut dari nilai harapan tertinggi:

**Jalur A — Elektro dengan konsentrasi mikroelektronika/VLSI.**
Nilai harapan tertinggi dan paling tahan banting di seluruh model (#1 di 10 dari
10 uji tekan). Irisan dengan bekal Anda 0,70: Anda sudah paham datasheet,
timing, I/O, catu daya. Yang baru adalah desain di level silikon. Ini pilihan
kalau Anda mau memaksimalkan nilai harapan dan tahan belajar hal yang jauh
lebih abstrak daripada merakit robot.

**Jalur B — Kendali & Otomasi Industri, atau Mekatronika.**
Irisan tertinggi (0,92) dengan yang sudah Anda kerjakan, dan hanya 6% tugas
intinya terotomasi. Ramp-up tercepat. Risikonya sudah disebut di atas: ini
jalur yang paling rentan terhadap membanjirnya lulusan sejenis. Ambil ini
kalau Anda siap membedakan diri lewat kedalaman, bukan lewat label jurusan.

**Jalur C — Elektro Sistem Tenaga, spesialisasi elektronika daya.**
Ini irisan yang sering terlewat. Motor drive, BLDC, inverter, manajemen
baterai — itu *adalah* elektronika daya, dan itu juga persis yang dibutuhkan
robot. Bidang ini peringkat #2 secara keseluruhan, peluang langka tertinggi
di seluruh daftar (85%), dan paparan otomasinya paling rendah (4%). Ditambah
konteks Indonesia: hilirisasi nikel dan target produksi baterai 140 GWh pada
2030 menaruh permintaan ini di dalam negeri, bukan hanya di luar.

Yang **tidak** saya sarankan: mengambil jurusan robotika lalu berhenti di situ,
dengan asumsi labelnya sendiri sudah cukup langka. Model ini mengatakan
sebaliknya, dan uji tekannya mengatakannya dengan keras.

Satu catatan tentang bukti kerja. Repo ini sendiri — robot rel dengan ESP32
ganda, UART antar-board, line following, probe tanah, fallback kendali
on-board ketika jaringan mati — adalah persis jenis portofolio yang
membedakan pelamar di bidang mana pun di atas. Sistem yang tetap berfungsi
saat jaringannya putus jauh lebih sulit dibuat daripada notebook yang
memanggil API, dan pewawancara di bidang embedded tahu itu.

---

## Bagaimana model ini bekerja

Setiap lintasan menjalankan lima langkah:

1. **Undi dunianya.** Satu rezim (AI Akselerasi 35% / Baseline 45% / Koreksi
   20%), satu faktor capex global, satu kejutan per sektor. Jurusan sesektor
   berbagi kejutan yang sama — ini yang membuat hasilnya berkorelasi seperti
   karier sungguhan, bukan 25 lemparan koin independen.
2. **Tumbuhkan permintaan.** CAGR permintaan tiap jurusan = prior + rezim +
   capex × sensitivitas + kejutan sektor + kejutan idiosinkratik.
3. **Kurangi yang diambil mesin.** Hazard otomasi tahunan, diskalakan oleh
   paparan tugas, benteng fisik, dan benteng lisensi. Sebagian yang terotomasi
   kembali sebagai permintaan baru (porsi Jevons) — karena output yang lebih
   murah memperbesar pasarnya.
4. **Tumbuhkan pasokan dengan jeda empat tahun.** Enrolmen mengejar premi upah
   yang dilihat calon mahasiswa **empat tahun sebelum lulus**. Jeda inilah yang
   menghasilkan siklus cobweb boom-lalu-banjir, bukan kurva mulus.
5. **Hargai hasilnya.** Ketat = permintaan/pasokan; ketat menggerakkan
   pertumbuhan upah riil dan peluang benar-benar mendapat pekerjaan.

Hasil akhirnya bukan ramalan. Ia adalah **distribusi masa depan di bawah asumsi
yang dinyatakan terbuka**, dan tugasnya adalah menunjukkan jurusan mana yang
kokoh di banyak dunia — bukan mana yang menang di satu dunia yang kebetulan
saya tebak.

### Mutu numerik

Galat baku Monte Carlo terbesar adalah ±0,013 indeks, yaitu 0,10% dari nilai
tengahnya. Artinya peringkat di atas sudah konvergen: menjalankan ulang dengan
seed berbeda tidak akan menukar urutannya. Seluruh run 60.000 lintasan selesai
dalam 28 detik, murni pustaka standar Python — tanpa numpy, tanpa dependensi.

---

## Yang model ini tidak tahu

Saya lebih suka Anda tahu kelemahannya daripada mempercayainya terlalu jauh.

1. **Semua parameternya adalah penilaian, bukan pengukuran.** Prior-nya
   dikalibrasi terhadap sumber di bawah, tetapi tidak ada satu pun lembaga yang
   menerbitkan "CAGR permintaan per jurusan untuk Indonesia 2026–2036". Angka
   di [`params.py`](major_demand_mc/params.py) bisa diperdebatkan, dan
   seharusnya diperdebatkan.
2. **Data ketenagakerjaan yang paling kuat berasal dari AS.** BLS, WEF,
   Deloitte, Kearney/IEEE mengukur pasar yang strukturnya berbeda dari
   Indonesia. Saya memakainya untuk bentuk relatif antarbidang, lalu menambatkan
   level gaji ke rentang Indonesia. Bentuknya lebih bisa dipercaya daripada
   levelnya.
3. **Gaji awal adalah titik tambat yang kasar.** Rentang gaji fresh graduate
   Indonesia sangat lebar antarperusahaan dan antarkota; saya memakai satu
   angka tengah per jurusan.
4. **Tidak ada model untuk kualitas kampus, jaringan, atau keberuntungan.**
   Sebaran hasil dalam satu jurusan di dunia nyata jauh lebih lebar daripada
   sebaran antarjurusan di simulasi ini. Lulusan terbaik jurusan lapis 4 akan
   mengalahkan lulusan medioker jurusan lapis 1, dan model ini tidak menangkap
   itu sama sekali.
5. **Tidak ada guncangan diskret.** Perang, pandemi, perubahan aturan ekspor
   mineral, atau satu terobosan model yang mengubah segalanya — tidak ada di
   sini. Rezim menangkap kecepatan, bukan kejutan mendadak.
6. **Pasokan lulusan Indonesia tidak diukur langsung.** Pertumbuhan pasokan
   diambil dari momentum enrolmen yang diamati secara kualitatif, dan seperti
   ditunjukkan bagian 3 di atas, itu asumsi yang paling menentukan hasil.

Kalau Anda tidak setuju dengan satu angka, ubah di `params.py` dan jalankan
ulang. Itulah gunanya ini berupa kode dan bukan tabel statis.

---

## Menjalankan ulang

```bash
cd analysis
python3 -m major_demand_mc.run                  # 40.000 lintasan + uji tekan
python3 -m major_demand_mc.run --trials 200000  # run lebih berat
python3 -m major_demand_mc.run --quick          # 5.000 lintasan, tanpa uji tekan
```

Butuh Python 3.8+ dan tidak ada lagi. Keluaran ditulis ke `analysis/out/`.

---

## Sumber

Prior model dikalibrasi terhadap:

- [BLS Employment Projections 2024–2034](https://www.bls.gov/news.release/ecopro.nr0.htm) — pekerjaan komputer & matematika +10,1% sedekade, tiga kali laju rata-rata ekonomi; kesehatan tumbuh tercepat
- [BLS Occupational Outlook Handbook — fastest growing occupations](https://www.bls.gov/ooh/fastest-growing.htm)
- [WEF Future of Jobs Report 2025](https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/2-jobs-outlook/) — 170 juta pekerjaan tercipta, 92 juta tergeser pada 2030; robot & otomasi menggeser 5 juta lebih banyak daripada yang diciptakannya
- [Deloitte — global semiconductor talent shortage](https://www.deloitte.com/us/en/industries/tmt/articles/global-semiconductor-talent-shortage.html) — kebutuhan >1 juta pekerja terampil tambahan pada 2030
- [Tom's Hardware — 157.000 kekurangan pekerja chip AS pada 2030](https://www.tomshardware.com/tech-industry/semiconductors/us-chip-manufacturers-are-in-dire-need-of-engineers-and-technicians-experts-suggest-a-shortage-of-up-to-157-000-semiconductor-workers-by-2030) — hanya 3% lulusan teknik AS masuk industri chip
- [IEEE Spectrum — kesenjangan tenaga kerja power engineering](https://spectrum.ieee.org/power-engineering-workforce-gap-2674141268) — 450.000–1.500.000 insinyur listrik tambahan dibutuhkan pada 2030
- [IEEE Spectrum — data center AI kekurangan pekerja terampil](https://spectrum.ieee.org/ai-data-centers-engineers-jobs)
- [HeroHunt — recruiting robotics engineers for physical AI (2026)](https://www.herohunt.ai/blog/recruiting-robotics-engineers-for-physical-ai-2026/) — $47,4 miliar pendanaan robotika/physical-AI di paruh pertama 2026
- [Zippia — robotics engineer job outlook](https://www.zippia.com/robotics-engineer-jobs/trends/)
- [KORE1 — reshoring engineering jobs 2026](https://www.kore1.com/reshoring-engineering-jobs-2026/) — insinyur kendali, manufaktur, mekanikal, elektrikal paling sulit diisi
- [Articuler — computer science unemployment rate 2026](https://www.articuler.ai/resources/learn/computer-science-unemployment-rate/) — pengangguran lulusan CS 6,1%, computer engineering 7,5%
- [CSIS — Indonesia's battery industrial strategy](https://www.csis.org/analysis/indonesias-battery-industrial-strategy) — target 140 GWh produksi baterai pada 2030
- [Widya — jurusan teknik dengan gaji tertinggi di Indonesia (2026)](https://widya.ai/jurusan-teknik-dengan-gaji-tertinggi/) — tambatan gaji awal Indonesia
- [BLS OOH — bioengineers and biomedical engineers](https://www.bls.gov/ooh/architecture-and-engineering/biomedical-engineers.htm)
