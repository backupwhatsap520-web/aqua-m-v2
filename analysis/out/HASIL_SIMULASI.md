# Keluaran Simulasi Monte Carlo — Permintaan Lulusan 2026–2036

> Berkas ini dibuat otomatis oleh `major_demand_mc`. Jangan disunting tangan — jalankan ulang simulasinya.
> Pembacaan dan kesimpulannya ada di [`../LAPORAN_JURUSAN.md`](../LAPORAN_JURUSAN.md).

- Dijalankan: `2026-09-20T14:48:05+00:00`
- Lintasan: **60,000** × 25 jurusan × 10 tahun (seed `20260920`, waktu 28.0 s)
- Galat baku Monte Carlo terbesar: ±0.013 indeks (0.12% relatif)
- Pangsa rezim: AI Akselerasi 35.4%, Baseline 44.9%, Koreksi / AI Winter 19.6%

## 1. PERINGKAT UTAMA — nilai harapan 10 tahun

IPK* = indeks peluang karier: gaji riil bulanan 2036 (juta Rp, harga 2026)
dikali peluang benar-benar bekerja di bidang itu. Ketat = permintaan/pasokan.
P(lgk) = peluang bidang ini langka; P(bjr) = peluang banjir lulusan.

```
 #  Jurusan                                        IPK*    P10    P90  Gaji50  Ketat  P(lgk)  P(bjr)   Top5
-----------------------------------------------------------------------------------------------------------
 1  Mikroelektronika & Semikonduktor              12.87   8.29  16.34    15.0   1.50     81%     11%    79%
 2  Teknik Elektro — Sistem Tenaga                11.11   7.81  13.80    12.8   1.47     85%      7%    62%
 3  Teknik Pertambangan                           10.97   6.84  15.40    13.2   1.17     61%     25%    53%
 4  Teknik Metalurgi & Material                   10.71   7.27  13.70    12.4   1.40     80%     10%    54%
 5  Teknik Dirgantara & UAV                       10.11   6.09  13.35    11.9   1.41     74%     16%    46%
 6  Teknik Kendali & Otomasi Industri              9.82   6.38  12.94    11.5   1.33     74%     15%    36%
 7  Teknik Komputer / Sistem Tertanam              9.63   6.18  13.21    11.5   1.20     64%     22%    33%
 8  Keamanan Siber                                 9.45   5.93  13.78    11.7   1.02     47%     36%    31%
 9  Kedokteran                                     9.39   7.52  11.37    11.1   1.25     83%      4%    24%
10  Teknik Robotika & Mekatronika                  9.29   5.65  12.90    11.1   1.23     65%     23%    29%
11  Ilmu Komputer — AI / Machine Learning          8.25   5.46  12.72    10.7   0.71     20%     69%    18%
12  Teknik Energi Terbarukan & Lingkungan          8.20   5.07  11.40     9.8   1.21     64%     23%    13%
13  Teknik Kimia                                   7.72   5.42  10.37     9.6   1.05     50%     29%     5%
14  Teknik Biomedis                                7.70   5.18  10.61     9.4   1.12     58%     25%     9%
15  Teknik Mesin                                   6.86   4.92   9.10     8.5   1.06     52%     27%     1%
16  Bioteknologi                                   6.50   4.00   9.50     8.0   1.06     51%     34%     3%
17  Teknologi Pertanian & Pangan (Agritech)        6.34   4.27   8.39     7.5   1.27     72%     15%     0%
18  Sains Data & Statistika                        6.02   4.33   8.69     8.1   0.66     12%     78%     3%
19  Ilmu Komputer — Rekayasa Perangkat Lunak (g…   5.34   3.99   7.63     7.2   0.60      9%     83%     1%
20  Keperawatan                                    5.25   4.07   6.57     6.4   1.12     63%     14%     0%
21  Farmasi                                        5.16   3.96   6.54     6.8   0.91     26%     47%     0%
22  Teknik Sipil                                   5.12   3.67   6.83     6.8   0.89     28%     51%     0%
23  Teknik Industri                                5.11   3.83   6.68     7.1   0.76     11%     74%     0%
24  Akuntansi & Keuangan                           3.95   3.16   4.99     5.7   0.66      3%     89%     0%
25  Desain Komunikasi Visual                       2.93   2.46   3.70     4.3   0.51      2%     95%     0%

Sebaran hasil 10 tahun (P10 ├── P50 ● ── P90 ┤), skala bersama:
  Mikroelektronika & Semikonduktor                      ├─────────●─────┤    8.3 … 16.3 
  Teknik Elektro — Sistem Tenaga                       ├───────●───┤         7.8 … 13.8 
  Teknik Pertambangan                                 ├──────●────────┤      6.8 … 15.4 
  Teknik Metalurgi & Material                         ├───────●────┤         7.3 … 13.7 
  Teknik Dirgantara & UAV                           ├────────●────┤          6.1 … 13.4 
  Teknik Kendali & Otomasi Industri                  ├──────●────┤           6.4 … 12.9 
  Teknik Komputer / Sistem Tertanam                 ├──────●──────┤          6.2 … 13.2 
  Keamanan Siber                                    ├─────●────────┤         5.9 … 13.8 
  Kedokteran                                           ├──●───┤              7.5 … 11.4 
  Teknik Robotika & Mekatronika                    ├──────●──────┤           5.7 … 12.9 
  Ilmu Komputer — AI / Machine Learning            ├──●──────────┤           5.5 … 12.7 
  Teknik Energi Terbarukan & Lingkungan           ├─────●─────┤              5.1 … 11.4 
  Teknik Kimia                                     ├───●────┤                5.4 … 10.4 
  Teknik Biomedis                                 ├────●─────┤               5.2 … 10.6 
  Teknik Mesin                                    ├──●────┤                  4.9 … 9.1  
  Bioteknologi                                  ├───●──────┤                 4.0 … 9.5  
  Teknologi Pertanian & Pangan (Agritech)        ├───●───┤                   4.3 … 8.4  
  Sains Data & Statistika                        ├─●─────┤                   4.3 … 8.7  
  Ilmu Komputer — Rekayasa Perangkat Lunak …    ├●─────┤                     4.0 … 7.6  
  Keperawatan                                   ├─●──┤                       4.1 … 6.6  
  Farmasi                                       ├─●──┤                       4.0 … 6.5  
  Teknik Sipil                                 ├──●───┤                      3.7 … 6.8  
  Teknik Industri                               ├─●──┤                       3.8 … 6.7  
  Akuntansi & Keuangan                        ├─●─┤                          3.2 … 5.0  
  Desain Komunikasi Visual                   ├●┤                             2.5 … 3.7  
```

## 2. HASIL PER REZIM DUNIA

Skor yang sama, dihitung ulang di tiap dunia. Kolom Δ = selisih terbaik-terburuk;
makin besar Δ makin besar taruhan Anda pada satu skenario terjadi.

```
Jurusan                                            AI Akselerasi            Baseline Koreksi / AI Winter       Δ
----------------------------------------------------------------------------------------------------------------
Mikroelektronika & Semikonduktor                           14.39               12.77               10.34    4.04
Teknik Elektro — Sistem Tenaga                             12.35               10.95                9.27    3.08
Teknik Pertambangan                                        11.99               10.93                9.24    2.74
Teknik Metalurgi & Material                                11.48               10.73                9.27    2.21
Teknik Dirgantara & UAV                                    11.39               10.03                7.97    3.42
Teknik Kendali & Otomasi Industri                          11.20                9.71                7.56    3.63
Teknik Komputer / Sistem Tertanam                          11.00                9.50                7.44    3.56
Keamanan Siber                                             10.14                9.54                8.00    2.14
Kedokteran                                                  9.73                9.28                9.03    0.70
Teknik Robotika & Mekatronika                              10.65                9.17                7.11    3.54
Ilmu Komputer — AI / Machine Learning                       8.81                8.31                7.12    1.69
Teknik Energi Terbarukan & Lingkungan                       9.20                8.03                6.79    2.41
Teknik Kimia                                                8.35                7.70                6.63    1.71
Teknik Biomedis                                             8.03                7.64                7.26    0.78
```

## 3. PERINGKAT TAHAN BANTING — diurut dari skenario TERBURUK

Komitmen 10 tahun diputuskan oleh seberapa buruk kasus buruknya, bukan rata-rata.
CVaR10 = rata-rata hasil di 10% lintasan terburuk. Stabilitas = rerata/simpangan.

```
 #  Jurusan                                       Skenario terburuk   CVaR10  Stabilitas
----------------------------------------------------------------------------------------
 1  Mikroelektronika & Semikonduktor                          10.34     7.07        4.22
 2  Teknik Metalurgi & Material                                9.27     6.35        4.45
 3  Teknik Elektro — Sistem Tenaga                             9.27     6.85        4.93
 4  Teknik Pertambangan                                        9.24     6.07        3.53
 5  Kedokteran                                                 9.03     6.96        6.50
 6  Keamanan Siber                                             8.00     5.40        3.35
 7  Teknik Dirgantara & UAV                                    7.97     5.22        3.71
 8  Teknik Kendali & Otomasi Industri                          7.56     5.56        4.03
 9  Teknik Komputer / Sistem Tertanam                          7.44     5.46        3.75
10  Teknik Biomedis                                            7.26     4.65        3.90
11  Ilmu Komputer — AI / Machine Learning                      7.12     5.29        2.77
12  Teknik Robotika & Mekatronika                              7.11     4.96        3.51
13  Teknik Energi Terbarukan & Lingkungan                      6.79     4.46        3.54
14  Teknik Kimia                                               6.63     4.91        4.18
```

## 4. PERINGKAT SETELAH DISESUAIKAN DENGAN BEKAL ROBOTIKA ANDA

Fit = irisan dengan bekal robotika/embedded yang sudah Anda punya (0–1).
Otomasi = porsi tugas inti yang diperkirakan terotomasi pada 2036.

```
 #  Jurusan                                       Skor+fit   P10+fit   Fit  Otomasi
-----------------------------------------------------------------------------------
 1  Mikroelektronika & Semikonduktor                 11.40      7.35  0.70       8%
 2  Teknik Kendali & Otomasi Industri                 9.52      6.18  0.92       6%
 3  Teknik Dirgantara & UAV                           9.34      5.63  0.80       4%
 4  Teknik Robotika & Mekatronika                     9.29      5.65  1.00       6%
 5  Teknik Komputer / Sistem Tertanam                 9.26      5.95  0.90      13%
 6  Teknik Elektro — Sistem Tenaga                    9.21      6.48  0.55       4%
 7  Teknik Metalurgi & Material                       8.07      5.47  0.35       5%
 8  Teknik Pertambangan                               7.84      4.89  0.25       4%
 9  Keamanan Siber                                    7.30      4.58  0.40      19%
10  Ilmu Komputer — AI / Machine Learning             7.15      4.73  0.65      32%
11  Teknik Biomedis                                   6.53      4.40  0.60       6%
12  Teknik Energi Terbarukan & Lingkungan             6.48      4.01  0.45       7%
13  Teknik Mesin                                      6.21      4.45  0.75       5%
14  Kedokteran                                        6.18      4.95  0.10       2%
```

## 5. APA YANG SEBENARNYA MENGGERAKKAN HASIL (analisis sensitivitas)

Korelasi antara setiap penggerak acak dan skor akhir, di seluruh lintasan.
Batang terpanjang = asumsi yang paling menentukan. Itu yang harus Anda pantau.

```

Teknik Robotika & Mekatronika
   kejutan permintaan bidang      + ██████████████                     r=+0.676  ragam 41.1%
   siklus capex global (bersama)  + ███████                            r=+0.473  ragam 20.1%
   rezim AI (bersama)             + ███████                            r=+0.472  ragam 20.0%
   kejutan pasokan lulusan        − █████                              r=-0.392  ragam 13.8%
   kejutan sektor (bersama)       + ██                                 r=+0.237  ragam  5.0%
   kecepatan otomasi bidang       − ·                                  r=-0.012  ragam  0.0%

Teknik Kendali & Otomasi Industri
   kejutan permintaan bidang      + ████████████                       r=+0.630  ragam 34.7%
   rezim AI (bersama)             + ████████                           r=+0.525  ragam 24.1%
   siklus capex global (bersama)  + ████████                           r=+0.506  ragam 22.3%
   kejutan pasokan lulusan        − ████                               r=-0.376  ragam 12.3%
   kejutan sektor (bersama)       + ██                                 r=+0.277  ragam  6.7%
   kecepatan otomasi bidang       − ·                                  r=-0.012  ragam  0.0%

Teknik Komputer / Sistem Tertanam
   kejutan permintaan bidang      + ████████████                       r=+0.638  ragam 35.9%
   rezim AI (bersama)             + ███████                            r=+0.490  ragam 21.2%
   siklus capex global (bersama)  + ███████                            r=+0.480  ragam 20.4%
   kejutan pasokan lulusan        − █████                              r=-0.419  ragam 15.5%
   kejutan sektor (bersama)       + ██                                 r=+0.278  ragam  6.8%
   kecepatan otomasi bidang       − ·                                  r=-0.031  ragam  0.1%

Mikroelektronika & Semikonduktor
   kejutan permintaan bidang      + ███████████████                    r=+0.697  ragam 44.8%
   siklus capex global (bersama)  + ███████                            r=+0.479  ragam 21.2%
   rezim AI (bersama)             + ███████                            r=+0.465  ragam 20.0%
   kejutan pasokan lulusan        − ███                                r=-0.306  ragam  8.7%
   kejutan sektor (bersama)       + ██                                 r=+0.240  ragam  5.3%
   kecepatan otomasi bidang       − ·                                  r=-0.019  ragam  0.0%

Teknik Elektro — Sistem Tenaga
   kejutan permintaan bidang      + █████████████                      r=+0.663  ragam 39.2%
   siklus capex global (bersama)  + ███████                            r=+0.487  ragam 21.1%
   rezim AI (bersama)             + ███████                            r=+0.487  ragam 21.1%
   kejutan pasokan lulusan        − ███                                r=-0.330  ragam  9.7%
   kejutan sektor (bersama)       + ███                                r=+0.315  ragam  8.8%
   kecepatan otomasi bidang       − ·                                  r=-0.016  ragam  0.0%

Ilmu Komputer — AI / Machine Learning
   kejutan permintaan bidang      + █████████████████                  r=+0.667  ragam 50.1%
   kejutan pasokan lulusan        − ███████████                        r=-0.543  ragam 33.2%
   siklus capex global (bersama)  + ███                                r=+0.287  ragam  9.3%
   rezim AI (bersama)             + █                                  r=+0.192  ragam  4.2%
   kejutan sektor (bersama)       + █                                  r=+0.165  ragam  3.1%
   kecepatan otomasi bidang       − ·                                  r=-0.034  ragam  0.1%

Ilmu Komputer — Rekayasa Perangkat Lunak (generalis)
   kejutan permintaan bidang      + ██████████████████                 r=+0.649  ragam 52.5%
   kejutan pasokan lulusan        − ███████████                        r=-0.509  ragam 32.3%
   siklus capex global (bersama)  + ███                                r=+0.254  ragam  8.0%
   kejutan sektor (bersama)       + █                                  r=+0.175  ragam  3.8%
   rezim AI (bersama)             + █                                  r=+0.150  ragam  2.8%
   kecepatan otomasi bidang       − ·                                  r=-0.069  ragam  0.6%
```

## 6. PASANGAN BIDANG YANG SALING MELINDUNGI

Korelasi terendah antar 12 bidang terkuat. Dua bidang yang gagal di dunia yang
berbeda adalah lindung nilai sejati; yang gagal bersamaan hanyalah satu taruhan.

```
Pasangan bidang                                                             korelasi  rata2 skor
------------------------------------------------------------------------------------------------
Kedokteran + Ilmu Komputer — AI / Machine Learn…                               +0.08        8.82
Keamanan Siber + Kedokteran                                                    +0.09        9.42
Teknik Pertambangan + Kedokteran                                               +0.12       10.18
Kedokteran + Teknik Energi Terbarukan & Lingkun…                               +0.12        8.79
Teknik Metalurgi & Material + Kedokteran                                       +0.12       10.05
Teknik Dirgantara & UAV + Kedokteran                                           +0.13        9.75
Kedokteran + Teknik Robotika & Mekatronika                                     +0.13        9.34
Teknik Metalurgi & Material + Ilmu Komputer — AI / Machine Learn…              +0.13        9.48
Ilmu Komputer — AI / Machine Learn… + Teknik Energi Terbarukan & Lingkun…      +0.14        8.22
Teknik Pertambangan + Ilmu Komputer — AI / Machine Learn…                      +0.14        9.61
```

## 7. GERBANG MASUK — peluang lulusan baru tembus pekerjaan pertama (2031)

Kolom kiri sudah dipotong oleh 'entry-level squeeze': tugas junior adalah yang
paling dulu diserap AI, jadi peluang kerja pertama selalu lebih kecil dari
peluang kerja bidang itu secara keseluruhan.

```
Jurusan                                         P(kerja entry-level)   P(kerja mapan)
-------------------------------------------------------------------------------------
Teknik Elektro — Sistem Tenaga                                  82%             88%
Teknik Dirgantara & UAV                                         81%             86%
Teknik Metalurgi & Material                                     81%             86%
Mikroelektronika & Semikonduktor                                80%             87%
Teknik Kendali & Otomasi Industri                               80%             85%
Kedokteran                                                      79%             84%
Teknik Robotika & Mekatronika                                   79%             83%
Keperawatan                                                     78%             81%
Teknik Pertambangan                                             78%             82%
Teknologi Pertanian & Pangan (Agritech)                         78%             84%
Teknik Energi Terbarukan & Lingkungan                           77%             82%
Teknik Mesin                                                    76%             79%
Teknik Biomedis                                                 76%             80%
Teknik Komputer / Sistem Tertanam                               75%             82%
Teknik Kimia                                                    74%             79%
Bioteknologi                                                    73%             79%
Teknik Sipil                                                    71%             74%
Keamanan Siber                                                  66%             78%
Farmasi                                                         66%             74%
Teknik Industri                                                 59%             70%
Ilmu Komputer — AI / Machine Learning                           55%             70%
Sains Data & Statistika                                         51%             69%
Akuntansi & Keuangan                                            47%             67%
Ilmu Komputer — Rekayasa Perangkat Lunak (gene                  43%             67%
Desain Komunikasi Visual                                        43%             64%
```

## 8. UJI TEKAN ASUMSI — apakah peringkat bertahan kalau model saya salah?

Tiap baris mematahkan satu asumsi yang menopang model, lalu simulasi diulang.
Jurusan yang peringkatnya nyaris tak bergerak adalah kesimpulan yang kuat;
yang berayun jauh hanya benar kalau asumsi spesifik itu kebetulan benar.

```
Uji tekan asumsi                                Robotika  Kendali/Otoma…        Embedded   Semikonduktor  Elektro Tenaga           AI/ML    SW generalis
--------------------------------------------------------------------------------------------------------------------------------------------------------
(peringkat dasar)                                    #10              #6              #7              #1              #2             #11             #19
--------------------------------------------------------------------------------------------------------------------------------------------------------
Pasokan lulusan AI/data hanya separuh             #11 ▼1           #7 ▼1           #8 ▼1            #1 =           #3 ▼1           #2 ▲9          #17 ▲2
Ledakan lulusan robotika (pasokan 2x)             #15 ▼5          #13 ▼7           #6 ▲1            #1 =            #2 =           #9 ▲2           #19 =
Otomasi menembus kerja fisik lebih cepat           #10 =            #6 =            #7 =            #1 =            #2 =           #11 =           #19 =
Capex robotika & otomasi meledak                   #8 ▲2           #5 ▲1           #6 ▲1            #1 =            #2 =           #11 =           #19 =
Hilirisasi & komoditas RI meleset                  #9 ▲1           #4 ▲2           #6 ▲1            #1 =            #2 =           #11 =           #19 =
Upah tidak responsif thd kelangkaan                #10 =           #7 ▼1           #8 ▼1            #1 =           #3 ▼1           #11 =           #19 =
Tanpa efek Jevons (otomasi murni negatif           #9 ▲1            #6 =           #8 ▼1            #1 =            #2 =          #14 ▼3          #23 ▼4
Peluang AI Winter digandakan                       #10 =           #7 ▼1           #9 ▼2            #1 =            #2 =           #11 =           #19 =
Semua CAGR permintaan dipangkas 2 pp               #9 ▲1            #6 =            #7 =            #1 =            #2 =           #11 =           #19 =
Enrolmen bereaksi 2x lebih cepat                   #10 =            #6 =            #7 =            #1 =            #2 =           #11 =           #19 =
```

## Sumber yang mengkalibrasi prior

- [BLS Employment Projections 2024-2034](https://www.bls.gov/news.release/ecopro.nr0.htm)
- [BLS Occupational Outlook Handbook — fastest growing occupations](https://www.bls.gov/ooh/fastest-growing.htm)
- [WEF Future of Jobs Report 2025](https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/2-jobs-outlook/)
- [Deloitte — global semiconductor talent shortage](https://www.deloitte.com/us/en/industries/tmt/articles/global-semiconductor-talent-shortage.html)
- [McKinsey / SEMI via Tom's Hardware — 157k US chip worker shortfall by 2030](https://www.tomshardware.com/tech-industry/semiconductors/us-chip-manufacturers-are-in-dire-need-of-engineers-and-technicians-experts-suggest-a-shortage-of-up-to-157-000-semiconductor-workers-by-2030)
- [Kearney / IEEE via IEEE Spectrum — 450k-1.5M power engineers needed by 2030](https://spectrum.ieee.org/power-engineering-workforce-gap-2674141268)
- [IEEE Spectrum — AI data centres face a skilled-worker shortage](https://spectrum.ieee.org/ai-data-centers-engineers-jobs)
- [Zippia — robotics engineer job outlook and growth](https://www.zippia.com/robotics-engineer-jobs/trends/)
- [HeroHunt — recruiting robotics engineers for physical AI (2026)](https://www.herohunt.ai/blog/recruiting-robotics-engineers-for-physical-ai-2026/)
- [KORE1 — reshoring engineering jobs 2026](https://www.kore1.com/reshoring-engineering-jobs-2026/)
- [Articuler — computer science unemployment rate 2026](https://www.articuler.ai/resources/learn/computer-science-unemployment-rate/)
- [CSIS — Indonesia's battery industrial strategy](https://www.csis.org/analysis/indonesias-battery-industrial-strategy)
- [Widya — jurusan teknik dengan gaji tertinggi di Indonesia (2026)](https://widya.ai/jurusan-teknik-dengan-gaji-tertinggi/)
- [BLS OOH — bioengineers and biomedical engineers](https://www.bls.gov/ooh/architecture-and-engineering/biomedical-engineers.htm)
