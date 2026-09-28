# Masuk Teknik Robotika di Indonesia: Prospek Kerja yang Realistis

Simulasi Monte Carlo 5 profil lulusan × 120.000 orang × 10 tahun × 14 segmen
pemberi kerja, plus 9 skenario uji tekan asumsi. Angka mentah di
[`out/robotika/`](out/robotika/), kode di
[`robotics_career_mc/`](robotics_career_mc/).

Ini pertanyaan yang **berbeda** dari [`LAPORAN_JURUSAN.md`](LAPORAN_JURUSAN.md).
Yang itu membandingkan 25 jurusan. Yang ini: *sudah pasti masuk robotika di
Indonesia — lalu apa yang realistis terjadi?*

Semua rupiah adalah **juta per bulan, riil, harga 2026**.

---

## Jawaban singkat, dan tidak nyaman

Simulasinya menghasilkan satu temuan yang menelan semua temuan lain: **yang
menentukan hasil Anda bukan jurusannya, melainkan apa yang Anda lakukan selama
menjalaninya.**

Kelima profil di bawah mengambil jurusan yang sama persis, di negara yang sama,
pada tahun yang sama.

| Profil lulusan | Gaji thn-1 | Gaji thn-5 | Gaji thn-10 | Total 10 thn | Masih di robotika | Keluar bidang |
|---|---|---|---|---|---|---|
| Pasif: IPK aman, tanpa portofolio, Inggris lemah | 5,3 | 7,1 | **9,1** | 875 | 43% | 46% |
| Median: kuliah wajar, proyek secukupnya | 6,8 | 9,7 | **13,8** | 1.302 | 65% | 23% |
| Serius: portofolio nyata, Inggris kerja, mau ditempatkan | 9,5 | 15,0 | **24,7** | 2.427 | 88% | 6% |
| Agresif: portofolio kuat + Inggris fasih + siap ke luar negeri | 11,5 | 21,6 | **36,7** | 3.568 | 94% | 2% |

Selisih antara profil pasif dan agresif adalah **4 kali** pada gaji tahun ke-10,
dan **4 kali** pada total penghasilan sepuluh tahun (Rp 875 juta lawan
Rp 3,57 miliar).

Bandingkan dengan ini: dari sembilan skenario uji tekan — adopsi robot Indonesia
stagnan, hilirisasi gagal, funding winter permanen, pintu luar negeri menyempit,
upah riil nasional stagnan — **tidak ada satu pun yang menggeser gaji median
lebih dari Rp 1,6 juta**, alias sekitar 12%.

Jadi: makro nyaris tidak penting dibanding pilihan pribadi. Empat kali lawan
dua belas persen.

---

## Angka realistisnya untuk populasi acak

Kalau Anda tidak tahu Anda akan jadi tipe mahasiswa yang mana, ini sebarannya:

| | P10 | P25 | P50 | P75 | P90 | P99 |
|---|---|---|---|---|---|---|
| Gaji tahun ke-1 | 3,8 | — | **6,9** | — | 11,4 | — |
| Gaji tahun ke-5 | 5,2 | — | **9,8** | — | 19,0 | — |
| Gaji tahun ke-10 | 7,2 | 9,7 | **13,6** | 19,6 | 29,5 | 72,8 |

Tambahan yang jarang disebut brosur kampus:

- **Menunggu kerja pertama: rata-rata 4,7 bulan.** 2% masih belum dapat setelah
  setahun.
- **38% mengalami setidaknya satu masa menganggur** dalam sepuluh tahun. Kerja
  otomasi di Indonesia banyak yang berbasis proyek.
- **Dari 10 tahun karier, rata-rata hanya 6,7 tahun benar-benar di bidang
  robotika/otomasi.**
- 25% sudah keluar dari teknik sama sekali pada tahun ke-10.

Lintasannya melebar, bukan naik rapi:

```
 2027   3,8 ├────●───────┤ 11,4
 2031   5,2 ├───────●───────────────┤ 19,0
 2036   7,2 ├──────────●──────────────────────────┤ 29,5
```

Median tumbuh dua kali dalam sepuluh tahun. Jarak P10–P90 tumbuh **tiga kali**.
Itulah bentuk sebenarnya dari "prospek kerja robotika": bukan satu angka, tapi
mulut yang terus melebar.

---

## Ke mana lulusan robotika Indonesia sebenarnya bekerja

Ini daftar pekerjaan yang benar-benar ada, bukan daftar cita-cita. Angkanya
adalah porsi lulusan yang berada di segmen itu pada tahun ke-10, dengan gaji
median segmen tersebut.

| Segmen | Porsi thn-10 | Gaji median | Catatan |
|---|---|---|---|
| **Keluar dari teknik sama sekali** | **19,2%** | 9,1 | sales, MT, ASN, bisnis keluarga, guru |
| Pabrik multinasional — controls/maintenance | 17,4% | 17,2 | otomotif, FMCG, elektronik, farmasi |
| Manufaktur lokal / konglomerasi | 8,9% | 8,9 | semen, baja, kertas, tekstil |
| System integrator / kontraktor otomasi | 7,1% | 13,8 | PLC, SCADA, panel, commissioning |
| BUMN & pertahanan (Defend ID, BRIN) | 6,7% | 12,2 | Pindad, LEN, PT DI, PAL; drone & anti-drone |
| Pindah ke software / data / IT | 6,3% | 14,9 | keluar robotika, masih teknis |
| Tambang & smelter — instrumentasi | 6,2% | 19,9 | nikel, batu bara; roster site |
| Oil & gas / pembangkit — I&C | 5,5% | 18,9 | DCS, safety instrumented system |
| Dosen / instruktur vokasi | 5,4% | 8,5 | stabil, plafon rendah |
| Startup hardware / robotika / agritech | 4,5% | 19,3 | risiko PHK 13%/tahun |
| Vendor / distributor merek otomasi | 4,4% | 14,4 | FANUC, ABB, Omron, Mitsubishi |
| **Remote untuk perusahaan luar negeri** | 3,0% | **45,9** | firmware/robotics SW |
| **Pindah kerja ke luar negeri** | 3,0% | **58,5** | Jepang, Singapura, Jerman |
| Usaha sendiri (jasa otomasi) | 2,4% | 15,0 | P90-nya 34,5 — ekor kanan terpanjang |

Tiga hal yang perlu diserap dari tabel ini:

**Pertama, segmen terbesar adalah "keluar dari teknik".** Bukan pabrik, bukan
startup robotika — keluar. Ini bukan kegagalan model; ini cermin data nasional:
sekitar **33,5% lulusan pendidikan tinggi Indonesia bekerja di bidang yang
tidak relevan dengan jurusannya**. Model saya menghasilkan 25% keluar total ditambah
~10% bersinggungan, yang pas dengan angka itu.

**Kedua, "kerja robotika" di Indonesia hampir selalu berarti otomasi industri,
bukan desain robot.** PLC, SCADA, instrumentasi, commissioning, maintenance.
Kepadatan robot Indonesia masih rendah dan adopsinya sebagian besar *first-time*
di pabrik baru, bukan siklus penggantian — artinya pekerjaannya adalah
**membuat pabrik orang lain jadi otomatis**, bukan merancang humanoid. Kalau
ekspektasi Anda yang kedua, siapkan diri untuk kecewa atau untuk pindah negara.

**Ketiga, dua segmen dengan gaji 3–4 kali lipat sisanya hanya menyerap 6%
gabungan.** Remote luar negeri (Rp 45,9 juta) dan pindah ke luar negeri
(Rp 58,5 juta) adalah satu-satunya lompatan kelas yang tersedia — dan hanya
dimasuki 3% + 3%. Itu bukan jalur default; itu jalur yang harus diincar dengan
sengaja.

---

## Empat temuan

### 1. Kemampuan nyata dan bahasa Inggris menjelaskan 89% perbedaan hasil

| Faktor pribadi | Porsi ragam yang dijelaskan |
|---|---|
| Kemampuan nyata (portofolio, hasil bangun) | **59,7%** |
| Bahasa Inggris kerja | **29,1%** |
| Toleransi risiko (startup, usaha sendiri) | 5,0% |
| Jaringan & tier kampus | 4,5% |
| Kesiapan pindah lokasi | 1,7% |

Dua faktor pertama menjelaskan hampir sembilan persepuluh keragaman total
penghasilan sepuluh tahun. **Jaringan dan tier kampus hanya 4,5%** — jauh lebih
kecil daripada yang biasa dipercaya orang. Dan itu masuk akal secara mekanis:
jaringan membuka pintu masuk, tapi yang menentukan Anda berakhir di segmen mana
setelah sepuluh tahun adalah apakah Anda benar-benar bisa mengerjakannya.

Bahasa Inggris keluar setinggi itu bukan karena nilai TOEFL. Ia adalah **gerbang
tunggal ke dua segmen bergaji tertinggi**. Tanpa Inggris kerja, dua baris
teratas tabel segmen tadi tertutup, dan plafon Anda jatuh ke plafon domestik.

### 2. Makro hampir tidak penting dibanding pilihan pribadi

| Uji tekan asumsi | Gaji thn-10 | Δ | Masih di robotika |
|---|---|---|---|
| (dasar) | 13,7 | — | 64% |
| Plafon gaji lokal 25% lebih rendah | 12,1 | −1,6 | 65% |
| Upah riil nasional stagnan | 12,5 | −1,2 | 64% |
| Pintu remote & luar negeri menyempit | 13,3 | −0,4 | 63% |
| Mismatch separah klaim ekstrem (80%) | 13,2 | −0,4 | **56%** |
| Hilirisasi & komoditas meleset | 13,3 | −0,3 | 64% |
| Funding winter permanen | 13,4 | −0,3 | 64% |
| Adopsi robot/otomasi RI stagnan | 13,5 | −0,2 | 62% |

Perhatikan baris "adopsi robot/otomasi RI stagnan": −0,2 juta. Skenario yang
paling ditakuti calon mahasiswa robotika — "bagaimana kalau Indonesia tidak
jadi otomatis?" — adalah skenario yang **paling tidak penting** di seluruh
tabel.

Alasannya: kalau otomasi lokal mandek, lulusan yang kompeten tidak menganggur;
mereka pindah segmen. Ke MNC, ke tambang, ke software, ke remote luar negeri.
Yang menjadi korban adopsi stagnan adalah lulusan yang tidak punya pilihan
segmen — dan itu balik lagi ke temuan nomor 1.

Yang paling merusak justru dua hal yang jarang dibahas: **plafon gaji lokal**
dan **stagnasi upah riil**. Keduanya bukan soal robotika; itu soal ekonomi
Indonesia secara umum. Dan keduanya adalah argumen paling kuat untuk
mengamankan opsi luar negeri, bukan sebagai rencana pindah, tapi sebagai
pembanding daya tawar.

### 3. Keluar bidang bersifat satu arah

Model ini memberi hukuman pada setiap tahun di luar bidang: makin lama di luar,
makin sulit kembali. Ketika saya menggandakan hukuman itu, porsi yang masih di
robotika turun dari 64% ke 60% — tapi gaji medianya hampir tidak bergerak.

Artinya: keluar dari robotika bukan bencana finansial. Yang hilang bukan uang,
tapi **pilihan**. Detour tiga tahun ke sales atau back-office secara realistis
menutup pintu kembali, dan pintu yang tertutup itu termasuk dua segmen bergaji
tertinggi.

Kalau Anda harus mengambil pekerjaan di luar bidang karena keadaan — dan 19%
lulusan robotika berakhir di situ — perlakukan itu sebagai jembatan bertenggat,
bukan sebagai karier.

### 4. Menganggur sesekali adalah normal, bukan tanda gagal

38% mengalami setidaknya satu masa menganggur dalam sepuluh tahun, dan angka itu
**hampir sama di semua profil** — bahkan profil agresif mengalaminya 40%.
Penyebabnya bukan kualitas orangnya; segmen bergaji tinggi justru punya risiko
putus kontrak lebih besar (startup 13%/tahun, remote 9,5%/tahun, tambang
6,5%/tahun).

Jadi jangan membaca satu masa menganggur sebagai vonis. Bacalah sebagai biaya
operasi dari segmen yang Anda pilih, dan siapkan bantalannya.

---

## Apa artinya secara praktis

Model ini, kalau dipaksa memberi nasihat, mengatakan lima hal.

**1. Portofolio yang bisa dijalankan mengalahkan segalanya.** 59,7% ragam.
Bukan IPK, bukan nama kampus. Yang dihitung adalah sistem yang benar-benar
jalan dan bisa Anda pertanggungjawabkan barisnya.

Repo ini sudah satu: robot rel dua ESP32, UART antar-board, line following,
probe tanah, dan — bagian yang paling bernilai — **fallback kendali yang tetap
menyirami tanaman ketika jaringan mati**. Sistem yang tetap berfungsi saat
koneksinya putus jauh lebih sulit dibuat daripada notebook yang memanggil API,
dan pewawancara embedded tahu bedanya. Perbaiki tiga resistor pull di
`README.md`, rapikan `RECOMMENDATIONS.md`, dan ini jadi bukti kerja yang bisa
dipakai melamar ke segmen mana pun di tabel tadi.

**2. Bahasa Inggris adalah keputusan finansial, bukan keputusan akademik.**
29,1% ragam, dan ia satu-satunya gerbang ke dua segmen bergaji 3–4 kali lipat.
Targetnya bukan sertifikat: bisa membaca datasheet dan errata tanpa terjemahan,
menulis isu teknis yang dimengerti orang asing, dan ikut panggilan teknis satu
jam tanpa tersesat.

**3. Incar lompatan kelas dengan sengaja, dan tahu jadwalnya.** Akses ke remote
dan luar negeri di model ini tumbuh dengan pengalaman di bidang — bukan dengan
kelulusan. Jalur realistisnya: **3–5 tahun kerja lokal yang benar dulu, lalu
lamar ke luar.** Itu bukan kompromi, itu urutan yang sebenarnya bekerja.

**4. Pilih segmen pertama dengan sadar.** MNC (Rp 17,2 juta di tahun ke-10,
risiko PHK 3%/tahun) adalah jalur paling jelas dan paling aman. System
integrator membayar lebih rendah tapi mengajari Anda lima kali lebih banyak
per tahun karena Anda menyentuh banyak pabrik. Tambang membayar paling tinggi
di antara jalur domestik tapi menuntut Anda tinggal di site. Ketiganya sah;
yang tidak sah adalah mendarat di salah satunya tanpa memilih.

**5. Jangan bertaruh pada Indonesia jadi otomatis.** Skenario itu hanya bernilai
−0,2 juta bagi Anda. Bertaruhlah pada kemampuan Anda sendiri untuk berpindah
segmen, karena itulah yang membuat skenario buruk jadi tidak relevan.

---

## Bagaimana model ini bekerja

Tiap lintasan adalah **satu orang**, bukan satu rata-rata:

1. **Undi siapa dia.** Lima atribut sebagai z-score: kemampuan nyata, bahasa
   Inggris, jaringan, kesiapan pindah, toleransi risiko. Kemampuan dan Inggris
   dibuat berkorelasi (0,45), karena keduanya melacak usaha dan akses sumber
   belajar yang sama.
2. **Undi dekade tempat dia lulus.** Siklus capex industri, siklus komoditas
   (nikel/hilirisasi), dan iklim pendanaan startup.
3. **Tempatkan dia.** Bobot 14 segmen dihitung dari atributnya, lalu diundi.
   Tahun buruk menaikkan bobot "keluar dari teknik" — tahun masuk yang lemah
   mendorong lulusan ke pekerjaan apa pun yang ada.
4. **Jalani sepuluh tahun.** Setiap tahun: risiko PHK (dipengaruhi siklus),
   kemungkinan pindah segmen, pertumbuhan upah riil, dan plafon lunak yang
   dipersonalisasi menurut kemampuan. Pengalaman di bidang membuka segmen yang
   tidak bisa dijangkau lulusan baru — itu jalur luar negeri yang realistis.
   Tahun di luar bidang memberi hukuman balik: pintu masuk kembali menyempit.
5. **Catat.** Gaji tiap tahun, total penghasilan, segmen akhir, lama menganggur,
   lama menunggu kerja pertama.

Galat baku total penghasilan: ±Rp 2,7 juta atas nilai tengah Rp 1.427 juta —
0,19%. Peringkat antarprofil sudah konvergen. Seluruh run 120.000 orang × 5
profil selesai dalam 39 detik, pustaka standar Python saja.

---

## Yang model ini tidak tahu

### Satu artefak yang saya temukan dan tidak saya sembunyikan

Skenario "dekade jauh lebih bergejolak" menaikkan gaji median (+0,2). Itu
**bukan temuan, itu artefak**. Bobot penempatan segmen berbentuk eksponensial
terhadap guncangan siklus, jadi memperbesar simpangan guncangan menaikkan
bobot harapan segmen bergaji tinggi lebih cepat daripada menurunkan yang
rendah — ketidaksetaraan Jensen, bukan ekonomi. Saya cek langsung: P10 turun
(7,26 → 7,08) sementara P50, rerata, dan P90 naik. Jadi bacalah baris itu
sebagai "gejolak melebarkan sebaran", bukan "gejolak menguntungkan".

### Enam hal lain

1. **Semua parameter adalah penilaian terkalibrasi, bukan pengukuran.** Tidak
   ada lembaga yang menerbitkan "distribusi segmen kerja lulusan robotika
   Indonesia". Saya menambatkan gaji ke rentang yang dilaporkan sumber di bawah,
   lalu menyusun struktur segmennya sendiri. Bisa diperdebatkan, dan seharusnya.
2. **Gaji luar negeri adalah angka bruto, bukan daya beli.** Rp 58 juta di
   Tokyo atau Singapura bukan Rp 58 juta di Bandung. Model ini tidak melakukan
   koreksi PPP, tidak menghitung pajak, sewa, visa, atau biaya pindah keluarga.
   Jangan pakai baris itu untuk membandingkan kualitas hidup.
3. **Data gaji Indonesia berkualitas rendah.** Sumbernya sebagian besar situs
   karier dan agregator lowongan, bukan survei berbobot. Rentang fresh graduate
   robotika yang saya temukan sendiri membentang Rp 3,5–14 juta — itu
   ketidakpastian pada input, bukan pada model.
4. **Tidak ada perbedaan geografis.** Jabodetabek, Cikarang, Batam, Morowali,
   dan Surabaya diperlakukan sama. Padahal di praktiknya lokasi menentukan
   segmen mana yang bahkan tersedia untuk Anda.
5. **Tidak ada jalur S2/S3, dan tidak ada guncangan diskret.** Beasiswa ke luar
   negeri, LPDP, perang, pandemi, atau perubahan aturan ekspor mineral tidak
   ada di sini.
6. **Kelima atribut diasumsikan tetap selama sepuluh tahun.** Di dunia nyata
   orang memperbaiki bahasa Inggrisnya di tahun ketiga dan berubah lintasan.
   Model ini tidak mengizinkan itu, yang berarti ia **melebih-lebihkan
   determinisme** — kenyataannya lebih bisa diubah daripada yang ditunjukkan
   tabel profil.

Poin terakhir itu penting dan arahnya menguntungkan Anda: kalau Anda sekarang
ada di baris "median", Anda tidak terjebak di situ. Model ini hanya tidak bisa
memodelkan perpindahannya.

Tidak setuju dengan sebuah angka? Ubah di
[`robotics_career_mc/segments.py`](robotics_career_mc/segments.py) dan jalankan
ulang.

---

## Menjalankan ulang

```bash
cd analysis
python3 -m robotics_career_mc.run                  # 120.000 orang/profil + uji tekan
python3 -m robotics_career_mc.run --trials 400000  # run lebih berat
python3 -m robotics_career_mc.run --quick          # 15.000, tanpa uji tekan
python3 -m robotics_career_mc.run --seed 12345     # seed lain untuk cek konvergensi
```

Python 3.8+, pustaka standar saja.

---

## Sumber

- [IFR World Robotics 2025](https://ifr.org/ifr-press-releases/news/global-robot-demand-in-factories-doubles-over-10-years) — 542.000 robot dipasang pada 2024, dua kali lipat sedekade; Asia 131 unit per 10.000 pekerja
- [IndexBox — pasar robot industri Indonesia](https://www.indexbox.io/store/indonesia-industrial-robots-market-analysis-forecast-size-trends-and-insights/) — basis terpasang masih rendah relatif output manufaktur; adopsi bersifat *first-time*/greenfield, MNC dan konglomerat memimpin, segmen UKM belum tersentuh
- [Cakrawala — teknik otomasi industri kerja apa](https://www.cakrawala.ac.id/blog/teknik-otomasi-industri-kerja-apa) — system integrator Rp 10–15 juta; SCADA engineer Rp 10–14 juta
- [Cakrawala — gaji teknik otomasi industri](https://www.cakrawala.ac.id/blog/gaji-teknik-otomasi-industri) — fresh graduate Rp 4–7 juta; pengalaman 2–5 tahun Rp 8–15 juta
- [Cakrawala — jurusan robotika](https://www.cakrawala.ac.id/blog/jurusan-robotika) — rentang fresh graduate robotika Rp 3,5–14 juta
- [Jobstreet — prospek karier teknik mekatronika](https://id.jobstreet.com/id/career-advice/article/prospek-karier-teknik-mekatronika) — fresh graduate mekatronika Rp 5–7,5 juta
- [Jobstreet — lowongan robotics engineer Indonesia](https://id.jobstreet.com/id/robotics-engineer-jobs)
- [Validnews — mismatch horizontal lulusan PT](https://validnews.id/opini/lulusan-bekerja-tak-sesuai-jurusan-cerminan-pendidikan-tinggi-indonesia) — ~33,5% bekerja di bidang tidak relevan dengan jurusan
- [kumparan — vertical mismatch 35,36%](https://kumparan.com/kumparanbisnis/vertical-mismatch-35-36-pemuda-ri-bekerja-tidak-sesuai-tingkat-pendidikan-26EG46aE7bO) — 22,36% overeducated, 13% undereducated
- [NEXT Indonesia Center](https://nextindonesia.id/Update/2026/05/17/264/Potret-Dunia-Kerja-RI:-Cuma-40-Persen-Bekerja-Sesuai-Pendidikan) — hanya ~40% bekerja sesuai pendidikan
- [RuangTambang — gaji tambang nikel 2026](https://ruangtambang.com/gaji-operator-tambang-nikel-2026-breakdown-lengkap/) — insinyur Rp 8,5–12 juta, total kompensasi Rp 14–18 juta dengan insentif lokasi
- [Dealls — gaji pertambangan per posisi](https://dealls.com/pengembangan-karir/gaji-pertambangan)
- [Defend ID](https://en.wikipedia.org/wiki/Defend_ID) — holding BUMN pertahanan: Pindad, Dahana, PT DI, PAL, dipimpin PT LEN
- [PT Pindad — UAV & anti-drone](https://pindad.com/kembangkan-drone-jammer-dan-interceptor-systems-pt-pindad-jajaki-kerjasama-dengan-evolved-aero) — program drone jammer dan interceptor
- [Arc.dev — gaji remote developer Indonesia 2026](https://arc.dev/remote-developer-salary/indonesia) — rata-rata ~$50.146/tahun untuk remote
- [Y-Axis — negara tujuan ahli robotika](https://www.y-axis.com/overseas-jobs/top-10-countries-for-robotics-experts/) — Jepang (Fanuc, Yaskawa, Kawasaki), Singapura (Jurong Innovation District, ST Engineering)
