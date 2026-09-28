"""Where an Indonesian robotics/mechatronics graduate actually ends up.

The previous simulation (``major_demand_mc``) ranked 25 majors against each
other. This one answers a different question: *given* that you take robotics in
Indonesia, what does the next ten years realistically look like?

That question is not answered by an average salary. It is answered by a
distribution over **employer segments**, because the gap between a system
integrator in Cikarang and a remote contract for a foreign robotics company is
far wider than the gap between any two majors. So this model simulates one
person at a time: it draws who you are, places you in a segment, then lets you
move, get promoted, get laid off, or leave the field entirely for ten years.

The single most important number here is the honest one: roughly a third of
Indonesian higher-education graduates work in a field unrelated to their major.
A career model for Indonesia that does not include "left the field" as a
first-class outcome is lying.

Wages are IDR million per month, real, 2026 prices.
"""

BASE_YEAR = 2026
HORIZON = 10

# --------------------------------------------------------------------------
# Personal attributes, drawn once per simulated person. These matter more than
# the major does, which is the uncomfortable finding this model keeps producing.
#
#   skill     demonstrable competence: portfolio, real builds, competitions
#   english   working English — the gate on every foreign-paying segment
#   network   campus tier, alumni, family, internships that led somewhere
#   mobility  willingness to live on a mine site or move abroad
#   risk      tolerance for startups and for running your own shop
#
# All are z-scores: 0 is the median robotics graduate, +1 is roughly top 16%.
# --------------------------------------------------------------------------
ATTRS = ("skill", "english", "network", "mobility", "risk")

# skill and english correlate (both track effort and access to resources), and
# skill correlates mildly with network. Cholesky factor of that correlation.
ATTR_CHOL = {
    "skill":    {"skill": 1.00},
    "english":  {"skill": 0.45, "english": 0.893},
    "network":  {"skill": 0.25, "english": 0.15, "network": 0.956},
    "mobility": {"mobility": 1.00},
    "risk":     {"skill": 0.15, "risk": 0.989},
}

# --------------------------------------------------------------------------
# Segments.
#
#   w0_mu/w0_sd   entry wage in that segment, IDR million/month
#   growth        real wage CAGR while you stay in it
#   growth_sd     dispersion of that growth across people
#   ceiling       realistic Indonesian ceiling for an individual contributor /
#                 first-line manager on a ten-year horizon
#   in_field      1.0 = robotics/automation work, 0.5 = adjacent, 0.0 = left
#   churn         annual probability you change segment voluntarily
#   layoff        annual probability of an involuntary spell out of work
#   cycle         exposure to the shared economic cycle (1.0 = average)
#   commodity     extra exposure to the commodity/hilirisasi cycle
#   funding       extra exposure to the startup funding cycle
#   base          baseline placement weight before attributes
#   pull          attribute loadings on placement weight
# --------------------------------------------------------------------------
S = dict

SEGMENTS = [
    S(key="si_otomasi", name="System integrator / kontraktor otomasi",
      note="PLC, SCADA, panel, commissioning di pabrik orang lain",
      w0_mu=6.5, w0_sd=1.4, growth=0.090, growth_sd=0.030, ceiling=26,
      in_field=1.0, churn=0.20, layoff=0.055, cycle=1.20, commodity=0.25,
      funding=0.0, base=14.0,
      pull=S(skill=2.0, english=0.4, network=0.8, mobility=0.8, risk=0.3)),

    S(key="manufaktur_mnc", name="Pabrik multinasional — controls/maintenance",
      note="otomotif, FMCG, elektronik, farmasi; jalur karier paling jelas",
      w0_mu=7.6, w0_sd=1.7, growth=0.082, growth_sd=0.026, ceiling=32,
      in_field=1.0, churn=0.13, layoff=0.030, cycle=1.00, commodity=0.10,
      funding=0.0, base=13.0,
      pull=S(skill=3.0, english=1.6, network=3.0, mobility=0.6, risk=-0.3)),

    S(key="manufaktur_lokal", name="Manufaktur lokal / konglomerasi domestik",
      note="semen, baja, kertas, tekstil, makanan; scope luas, bayaran tipis",
      w0_mu=5.5, w0_sd=1.2, growth=0.066, growth_sd=0.024, ceiling=19,
      in_field=1.0, churn=0.18, layoff=0.040, cycle=1.05, commodity=0.30,
      funding=0.0, base=12.0,
      pull=S(skill=-0.6, english=-0.8, network=0.6, mobility=0.4, risk=0.0)),

    S(key="tambang_smelter", name="Tambang & smelter — instrumentasi/otomasi",
      note="nikel, batu bara, emas; roster site, insentif lokasi terpencil",
      w0_mu=9.6, w0_sd=2.3, growth=0.094, growth_sd=0.034, ceiling=42,
      in_field=1.0, churn=0.16, layoff=0.065, cycle=1.15, commodity=1.60,
      funding=0.0, base=6.0,
      pull=S(skill=1.5, english=0.8, network=1.0, mobility=4.2, risk=0.6)),

    S(key="oil_gas_energi", name="Oil & gas / pembangkit — instrument & control",
      note="DCS, safety instrumented system; barrier masuk tinggi, stabil",
      w0_mu=9.0, w0_sd=2.3, growth=0.084, growth_sd=0.028, ceiling=40,
      in_field=1.0, churn=0.12, layoff=0.040, cycle=0.90, commodity=0.80,
      funding=0.0, base=4.0,
      pull=S(skill=2.2, english=1.6, network=2.2, mobility=2.0, risk=0.0)),

    S(key="bumn_pertahanan", name="BUMN & pertahanan (Defend ID, BRIN, LAPAN-alih)",
      note="Pindad, LEN, PT DI, PAL; drone & anti-drone, riset; aman tapi lambat",
      w0_mu=7.0, w0_sd=1.4, growth=0.060, growth_sd=0.020, ceiling=23,
      in_field=1.0, churn=0.07, layoff=0.012, cycle=0.55, commodity=0.0,
      funding=0.0, base=5.0,
      pull=S(skill=1.2, english=0.6, network=3.2, mobility=0.4, risk=-0.8)),

    S(key="startup_hw", name="Startup hardware / robotika / agritech",
      note="scope besar, gaji menengah, risiko pendanaan nyata",
      w0_mu=8.0, w0_sd=2.4, growth=0.108, growth_sd=0.050, ceiling=36,
      in_field=1.0, churn=0.26, layoff=0.130, cycle=1.10, commodity=0.0,
      funding=1.80, base=5.0,
      pull=S(skill=2.2, english=1.4, network=1.0, mobility=0.6, risk=3.0)),

    S(key="vendor_distributor", name="Vendor / distributor merek otomasi",
      note="application & sales engineer FANUC/ABB/Omron/Mitsubishi; komisi",
      w0_mu=7.0, w0_sd=1.7, growth=0.092, growth_sd=0.038, ceiling=31,
      in_field=0.5, churn=0.18, layoff=0.045, cycle=1.10, commodity=0.20,
      funding=0.0, base=7.0,
      pull=S(skill=0.8, english=1.8, network=1.4, mobility=0.8, risk=0.8)),

    S(key="akademik_vokasi", name="Dosen / instruktur vokasi / lab",
      note="stabil, jam panjang, plafon rendah kecuali ambil jalur riset+proyek",
      w0_mu=5.0, w0_sd=1.1, growth=0.056, growth_sd=0.018, ceiling=16,
      in_field=0.5, churn=0.08, layoff=0.010, cycle=0.40, commodity=0.0,
      funding=0.0, base=4.0,
      pull=S(skill=1.0, english=0.8, network=1.2, mobility=-0.4, risk=-1.0)),

    S(key="remote_luar", name="Remote untuk perusahaan luar negeri",
      note="firmware/robotics SW kontrak atau full-time remote; gaji lompat kelas",
      w0_mu=21.0, w0_sd=7.5, growth=0.098, growth_sd=0.045, ceiling=85,
      in_field=1.0, churn=0.20, layoff=0.095, cycle=1.00, commodity=0.0,
      funding=0.70, base=1.6,
      pull=S(skill=3.6, english=4.0, network=1.0, mobility=0.2, risk=1.4)),

    S(key="pindah_luar", name="Pindah kerja ke luar negeri",
      note="Jepang, Singapura, Jerman, Timur Tengah; angka bruto, bukan daya beli",
      w0_mu=29.0, w0_sd=9.0, growth=0.078, growth_sd=0.032, ceiling=105,
      in_field=1.0, churn=0.12, layoff=0.045, cycle=0.95, commodity=0.0,
      funding=0.20, base=1.2,
      pull=S(skill=3.0, english=3.6, network=1.2, mobility=2.6, risk=1.6)),

    S(key="switch_software", name="Pindah ke software / data / IT",
      note="keluar dari robotika tapi masih teknis; sangat umum",
      w0_mu=8.0, w0_sd=2.0, growth=0.080, growth_sd=0.034, ceiling=32,
      in_field=0.0, churn=0.20, layoff=0.070, cycle=1.15, commodity=0.0,
      funding=0.60, base=9.0,
      pull=S(skill=1.2, english=1.6, network=0.6, mobility=0.2, risk=0.8)),

    S(key="switch_nonteknis", name="Keluar dari teknik sama sekali",
      note="sales, management trainee, ASN, bisnis keluarga, guru",
      w0_mu=5.6, w0_sd=1.5, growth=0.072, growth_sd=0.036, ceiling=26,
      in_field=0.0, churn=0.15, layoff=0.055, cycle=1.00, commodity=0.0,
      funding=0.0, base=12.0,
      pull=S(skill=-3.0, english=0.2, network=1.0, mobility=0.0, risk=0.4)),

    S(key="wirausaha", name="Usaha sendiri (jasa otomasi, bengkel, produk)",
      note="ekor kanan paling panjang di daftar ini, dan ekor kiri paling pahit",
      w0_mu=4.2, w0_sd=2.8, growth=0.135, growth_sd=0.085, ceiling=95,
      in_field=1.0, churn=0.14, layoff=0.150, cycle=1.25, commodity=0.20,
      funding=0.30, base=2.0,
      pull=S(skill=1.6, english=0.6, network=1.8, mobility=0.2, risk=3.2)),
]

SEG_BY_KEY = {s["key"]: s for s in SEGMENTS}

# --------------------------------------------------------------------------
# Shared cycles. Drawn per simulated world, not per person, so a bad decade is
# bad for everyone in the exposed segments at once.
# --------------------------------------------------------------------------
CYCLE_SD = 0.055          # general Indonesian industrial capex cycle
COMMODITY_SD = 0.070      # nickel / coal / hilirisasi cycle
FUNDING_SD = 0.090        # startup funding climate

# Placement weight for leaving the field rises when the economy is bad: a weak
# intake year pushes graduates into whatever job exists.
MISMATCH_CYCLE_PULL = 5.0

# Experience opens doors that a fresh graduate cannot reach at all. This is the
# realistic route abroad for most Indonesian engineers: three to five solid
# local years first, then the foreign offer.
EXPERIENCE_GATE = {
    "remote_luar": 0.22,      # weight multiplier per year of in-field experience
    "pindah_luar": 0.20,
    "oil_gas_energi": 0.16,
    "manufaktur_mnc": 0.10,
    "wirausaha": 0.20,
    "startup_hw": 0.06,
}

# Leaving the field is partly one-way. Every year spent outside robotics makes
# coming back harder: the recruiter reads a gap, not a sabbatical. This is the
# hysteresis that turns a temporary detour into a permanent one.
REENTRY_PENALTY = 0.20     # per year spent out of field

# Fresh graduates do not start earning the month they graduate. Months spent
# looking for the first job, before skill and network shorten the search.
SEARCH_MONTHS_MU = 4.6
SEARCH_MONTHS_SD = 3.0
SEARCH_SKILL_GAIN = 1.25   # months saved per z of skill
SEARCH_NETWORK_GAIN = 0.95 # months saved per z of network

# Skill raises pay inside a segment as well as access to better segments.
SKILL_WAGE_GAIN = 0.16     # per z of skill, at entry
SKILL_GROWTH_GAIN = 0.012  # per z of skill, added to annual real growth

# Personas the report runs alongside the random population. The point of these
# is that the aggregate distribution hides the finding that matters: outcomes
# depend far more on these five numbers than on the choice of major.
PERSONAS = [
    ("Populasi acak (semua tipe mahasiswa)", None),
    ("Pasif: IPK aman, tanpa portofolio, Inggris lemah",
     S(skill=-0.80, english=-0.80, network=-0.40, mobility=-0.50, risk=-0.40)),
    ("Median: kuliah wajar, proyek kampus secukupnya",
     S(skill=0.00, english=0.00, network=0.00, mobility=0.00, risk=0.00)),
    ("Serius: portofolio nyata, Inggris kerja, mau ditempatkan",
     S(skill=1.20, english=1.00, network=0.40, mobility=1.00, risk=0.50)),
    ("Agresif: portofolio kuat + Inggris fasih + siap ke luar negeri",
     S(skill=1.80, english=1.80, network=0.80, mobility=1.60, risk=1.00)),
]

SOURCES = [
    ("IFR World Robotics 2025 — kepadatan robot global",
     "https://ifr.org/ifr-press-releases/news/global-robot-demand-in-factories-doubles-over-10-years"),
    ("IndexBox — pasar robot industri Indonesia (adopsi masih tahap awal)",
     "https://www.indexbox.io/store/indonesia-industrial-robots-market-analysis-forecast-size-trends-and-insights/"),
    ("Cakrawala — teknik otomasi industri kerja apa (gaji system integrator & SCADA)",
     "https://www.cakrawala.ac.id/blog/teknik-otomasi-industri-kerja-apa"),
    ("Cakrawala — gaji teknik otomasi industri per jenjang pengalaman",
     "https://www.cakrawala.ac.id/blog/gaji-teknik-otomasi-industri"),
    ("Cakrawala — jurusan robotika: prospek kerja & gaji",
     "https://www.cakrawala.ac.id/blog/jurusan-robotika"),
    ("Jobstreet — prospek karier teknik mekatronika",
     "https://id.jobstreet.com/id/career-advice/article/prospek-karier-teknik-mekatronika"),
    ("Jobstreet — lowongan robotics engineer Indonesia",
     "https://id.jobstreet.com/id/robotics-engineer-jobs"),
    ("kumparan — vertical mismatch 35,36% pemuda RI",
     "https://kumparan.com/kumparanbisnis/vertical-mismatch-35-36-pemuda-ri-bekerja-tidak-sesuai-tingkat-pendidikan-26EG46aE7bO"),
    ("Validnews — horizontal mismatch ~33,5% lulusan PT",
     "https://validnews.id/opini/lulusan-bekerja-tak-sesuai-jurusan-cerminan-pendidikan-tinggi-indonesia"),
    ("NEXT Indonesia Center — hanya ~40% bekerja sesuai pendidikan",
     "https://nextindonesia.id/Update/2026/05/17/264/Potret-Dunia-Kerja-RI:-Cuma-40-Persen-Bekerja-Sesuai-Pendidikan"),
    ("RuangTambang — gaji sektor tambang & smelter nikel 2026",
     "https://ruangtambang.com/gaji-operator-tambang-nikel-2026-breakdown-lengkap/"),
    ("Dealls — gaji pertambangan per posisi",
     "https://dealls.com/pengembangan-karir/gaji-pertambangan"),
    ("Defend ID — holding BUMN pertahanan (Pindad, LEN, PT DI, PAL)",
     "https://en.wikipedia.org/wiki/Defend_ID"),
    ("PT Pindad — program UAV & anti-drone",
     "https://pindad.com/kembangkan-drone-jammer-dan-interceptor-systems-pt-pindad-jajaki-kerjasama-dengan-evolved-aero"),
    ("Arc.dev — gaji remote developer Indonesia 2026",
     "https://arc.dev/remote-developer-salary/indonesia"),
    ("Y-Axis — negara tujuan kerja untuk ahli robotika (Jepang, Singapura)",
     "https://www.y-axis.com/overseas-jobs/top-10-countries-for-robotics-experts/"),
]
