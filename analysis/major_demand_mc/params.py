"""Parameter deck for the major-demand Monte Carlo.

Every number below is a PRIOR, not a measurement. They are expert-judgment
anchors calibrated against the sources listed in ``SOURCES`` and in
``analysis/LAPORAN_JURUSAN.md``. Published statistics (BLS, WEF, Deloitte,
Kearney/IEEE) pin the central tendency; the spread encodes how much the
published numbers disagree with each other and how badly ten-year labour
forecasts have missed before.

Read the report before quoting any output. A simulation is only as honest as
the priors you feed it, and these priors are arguable.
"""

BASE_YEAR = 2026
HORIZON = 10          # simulate to 2036
CHECKPOINT = 5        # and report an interim view at 2031
EDU_LAG = 4           # years from "this major looks hot" to graduates arriving

# --------------------------------------------------------------------------
# Sectors. Majors that load on the same sector rise and fall together; this is
# what stops the simulation from pretending 25 independent coin flips.
# --------------------------------------------------------------------------
SECTORS = (
    "physical_ai",   # robotics, humanoids, embodied AI, factory automation
    "semis",         # semiconductor design, fabrication, packaging
    "energy",        # grid, renewables, nuclear, data-centre power
    "digital",       # software, cloud, data, security
    "health",        # clinical care, devices, biotech
    "commodity",     # mining, smelting, metals, chemicals (hilirisasi RI)
    "infra",         # civil works, construction, transport
    "services",      # back-office, business, creative
)

# --------------------------------------------------------------------------
# Regimes. Drawn once per trial. They are the reason the output is a fan and
# not a line: the same major can be a great or a terrible bet depending on
# which world you land in.
# --------------------------------------------------------------------------
REGIMES = (
    {
        "name": "AI Akselerasi",
        "p": 0.35,
        "ai_intensity": 1.55,     # multiplier on task-automation hazard
        "capex_mu": 0.40,         # mean of the global capex factor
        "adders": {               # added to each sector's demand CAGR
            "physical_ai": 0.020, "semis": 0.020, "energy": 0.018,
            "digital": 0.005, "health": 0.004, "commodity": 0.006,
            "infra": 0.003, "services": -0.006,
        },
    },
    {
        "name": "Baseline",
        "p": 0.45,
        "ai_intensity": 1.00,
        "capex_mu": 0.00,
        "adders": {s: 0.0 for s in SECTORS},
    },
    {
        "name": "Koreksi / AI Winter",
        "p": 0.20,
        "ai_intensity": 0.50,
        "capex_mu": -0.60,
        "adders": {
            "physical_ai": -0.025, "semis": -0.022, "energy": -0.015,
            "digital": -0.020, "health": 0.000, "commodity": -0.010,
            "infra": -0.008, "services": 0.002,
        },
    },
)

MACRO_SD = 0.55        # dispersion of the global capex factor
MACRO_TO_CAGR = 0.018  # one unit of capex factor -> 1.8 pp of demand CAGR
SECTOR_SD = 0.012      # sector-specific surprise, in CAGR points
WAGE_KAPPA = 0.09      # how hard wages respond to labour-market tightness
WAGE_DRIFT = 0.010     # real productivity drift per year
SUPPLY_FEEDBACK = 0.70 # how hard enrolment chases the wage premium
WAGE_GROWTH_MIN = -0.035   # real wage growth is sticky downwards
WAGE_GROWTH_MAX = 0.050    # and no field compounds a premium forever

# --------------------------------------------------------------------------
# The majors.
#
#   d_mu/d_sd   demand CAGR for the skill, mean and sd
#   s_mu/s_sd   graduate-supply CAGR before the enrolment feedback loop
#   elast       how strongly enrolment chases a wage premium (cobweb gain)
#   ai_exp      share of the job's core tasks a 2026-2036 model can do
#   phys        physical/embodied moat: work that needs hands and a site
#   reg         regulatory moat: licence, board exam, certification
#   jevons      share of automated tasks that comes back as expanded demand
#   beta        sensitivity to the global capex cycle
#   wage0       Indonesian fresh-graduate wage, IDR million/month, 2026 money
#   fit         overlap with an existing robotics/embedded skill base (0-1)
# --------------------------------------------------------------------------
M = dict  # alias to keep the table narrow

MAJORS = [
    M(key="robotika", name="Teknik Robotika & Mekatronika",
      sector="physical_ai", d_mu=0.080, d_sd=0.035, s_mu=0.055, s_sd=0.020,
      elast=0.45, ai_exp=0.30, phys=0.85, reg=0.15, jevons=0.55, beta=1.25,
      wage0=9.0, fit=1.00),

    M(key="kendali", name="Teknik Kendali & Otomasi Industri",
      sector="physical_ai", d_mu=0.072, d_sd=0.028, s_mu=0.038, s_sd=0.016,
      elast=0.35, ai_exp=0.28, phys=0.82, reg=0.20, jevons=0.50, beta=1.10,
      wage0=9.0, fit=0.92),

    M(key="komputer_embedded", name="Teknik Komputer / Sistem Tertanam",
      sector="physical_ai", d_mu=0.070, d_sd=0.028, s_mu=0.045, s_sd=0.018,
      elast=0.40, ai_exp=0.35, phys=0.65, reg=0.10, jevons=0.55, beta=1.05,
      wage0=9.5, fit=0.90),

    M(key="dirgantara_uav", name="Teknik Dirgantara & UAV",
      sector="physical_ai", d_mu=0.070, d_sd=0.040, s_mu=0.030, s_sd=0.018,
      elast=0.30, ai_exp=0.25, phys=0.82, reg=0.45, jevons=0.45, beta=1.20,
      wage0=9.0, fit=0.80),

    M(key="semikonduktor", name="Mikroelektronika & Semikonduktor",
      sector="semis", d_mu=0.078, d_sd=0.035, s_mu=0.030, s_sd=0.015,
      elast=0.30, ai_exp=0.25, phys=0.70, reg=0.25, jevons=0.50, beta=1.30,
      wage0=11.0, fit=0.70),

    M(key="elektro_tenaga", name="Teknik Elektro — Sistem Tenaga",
      sector="energy", d_mu=0.068, d_sd=0.025, s_mu=0.025, s_sd=0.012,
      elast=0.25, ai_exp=0.20, phys=0.80, reg=0.45, jevons=0.40, beta=0.95,
      wage0=9.5, fit=0.55),

    M(key="energi_terbarukan", name="Teknik Energi Terbarukan & Lingkungan",
      sector="energy", d_mu=0.072, d_sd=0.035, s_mu=0.048, s_sd=0.022,
      elast=0.45, ai_exp=0.25, phys=0.72, reg=0.35, jevons=0.45, beta=1.10,
      wage0=8.0, fit=0.45),

    M(key="ai_ml", name="Ilmu Komputer — AI / Machine Learning",
      sector="digital", d_mu=0.100, d_sd=0.050, s_mu=0.140, s_sd=0.040,
      elast=0.90, ai_exp=0.45, phys=0.10, reg=0.05, jevons=0.70, beta=1.40,
      wage0=12.0, fit=0.65),

    M(key="sw_generalis", name="Ilmu Komputer — Rekayasa Perangkat Lunak (generalis)",
      sector="digital", d_mu=0.030, d_sd=0.045, s_mu=0.085, s_sd=0.035,
      elast=0.95, ai_exp=0.72, phys=0.08, reg=0.03, jevons=0.60, beta=1.20,
      wage0=9.0, fit=0.45),

    M(key="sains_data", name="Sains Data & Statistika",
      sector="digital", d_mu=0.065, d_sd=0.040, s_mu=0.105, s_sd=0.035,
      elast=0.85, ai_exp=0.55, phys=0.10, reg=0.08, jevons=0.55, beta=1.15,
      wage0=9.5, fit=0.45),

    M(key="siber", name="Keamanan Siber",
      sector="digital", d_mu=0.082, d_sd=0.032, s_mu=0.070, s_sd=0.028,
      elast=0.60, ai_exp=0.35, phys=0.25, reg=0.40, jevons=0.65, beta=0.90,
      wage0=10.5, fit=0.40),

    M(key="mesin", name="Teknik Mesin",
      sector="infra", d_mu=0.030, d_sd=0.020, s_mu=0.020, s_sd=0.012,
      elast=0.25, ai_exp=0.30, phys=0.85, reg=0.25, jevons=0.45, beta=0.95,
      wage0=7.5, fit=0.75),

    M(key="industri", name="Teknik Industri",
      sector="services", d_mu=0.028, d_sd=0.020, s_mu=0.045, s_sd=0.018,
      elast=0.40, ai_exp=0.50, phys=0.35, reg=0.15, jevons=0.50, beta=0.85,
      wage0=7.5, fit=0.40),

    M(key="metalurgi", name="Teknik Metalurgi & Material",
      sector="commodity", d_mu=0.058, d_sd=0.030, s_mu=0.018, s_sd=0.012,
      elast=0.25, ai_exp=0.22, phys=0.80, reg=0.25, jevons=0.40, beta=1.15,
      wage0=9.5, fit=0.35),

    M(key="kimia", name="Teknik Kimia",
      sector="commodity", d_mu=0.032, d_sd=0.022, s_mu=0.022, s_sd=0.012,
      elast=0.28, ai_exp=0.30, phys=0.70, reg=0.30, jevons=0.45, beta=1.00,
      wage0=8.5, fit=0.25),

    M(key="tambang", name="Teknik Pertambangan",
      sector="commodity", d_mu=0.040, d_sd=0.035, s_mu=0.020, s_sd=0.014,
      elast=0.30, ai_exp=0.25, phys=0.85, reg=0.35, jevons=0.35, beta=1.35,
      wage0=11.0, fit=0.25),

    M(key="sipil", name="Teknik Sipil",
      sector="infra", d_mu=0.022, d_sd=0.020, s_mu=0.030, s_sd=0.015,
      elast=0.30, ai_exp=0.35, phys=0.75, reg=0.45, jevons=0.40, beta=1.00,
      wage0=6.5, fit=0.20),

    M(key="biomedis", name="Teknik Biomedis",
      sector="health", d_mu=0.055, d_sd=0.028, s_mu=0.040, s_sd=0.020,
      elast=0.40, ai_exp=0.25, phys=0.70, reg=0.55, jevons=0.50, beta=0.70,
      wage0=8.0, fit=0.60),

    M(key="bioteknologi", name="Bioteknologi",
      sector="health", d_mu=0.060, d_sd=0.038, s_mu=0.050, s_sd=0.025,
      elast=0.50, ai_exp=0.30, phys=0.60, reg=0.50, jevons=0.55, beta=0.80,
      wage0=7.0, fit=0.25),

    M(key="kedokteran", name="Kedokteran",
      sector="health", d_mu=0.035, d_sd=0.012, s_mu=0.012, s_sd=0.008,
      elast=0.10, ai_exp=0.18, phys=0.85, reg=0.95, jevons=0.50, beta=0.35,
      wage0=9.0, fit=0.10),

    M(key="keperawatan", name="Keperawatan",
      sector="health", d_mu=0.042, d_sd=0.014, s_mu=0.030, s_sd=0.012,
      elast=0.20, ai_exp=0.12, phys=0.92, reg=0.85, jevons=0.45, beta=0.30,
      wage0=5.5, fit=0.10),

    M(key="farmasi", name="Farmasi",
      sector="health", d_mu=0.030, d_sd=0.015, s_mu=0.035, s_sd=0.015,
      elast=0.35, ai_exp=0.40, phys=0.45, reg=0.75, jevons=0.45, beta=0.40,
      wage0=6.5, fit=0.10),

    M(key="agritech", name="Teknologi Pertanian & Pangan (Agritech)",
      sector="commodity", d_mu=0.045, d_sd=0.030, s_mu=0.015, s_sd=0.012,
      elast=0.20, ai_exp=0.30, phys=0.75, reg=0.25, jevons=0.50, beta=0.80,
      wage0=6.0, fit=0.70),

    M(key="akuntansi", name="Akuntansi & Keuangan",
      sector="services", d_mu=0.010, d_sd=0.018, s_mu=0.030, s_sd=0.015,
      elast=0.35, ai_exp=0.68, phys=0.10, reg=0.45, jevons=0.35, beta=0.70,
      wage0=6.5, fit=0.10),

    M(key="dkv", name="Desain Komunikasi Visual",
      sector="services", d_mu=-0.005, d_sd=0.030, s_mu=0.040, s_sd=0.020,
      elast=0.45, ai_exp=0.78, phys=0.15, reg=0.05, jevons=0.40, beta=0.60,
      wage0=5.5, fit=0.15),
]

MAJOR_BY_KEY = {m["key"]: m for m in MAJORS}

SOURCES = [
    ("BLS Employment Projections 2024-2034",
     "https://www.bls.gov/news.release/ecopro.nr0.htm"),
    ("BLS Occupational Outlook Handbook — fastest growing occupations",
     "https://www.bls.gov/ooh/fastest-growing.htm"),
    ("WEF Future of Jobs Report 2025",
     "https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/2-jobs-outlook/"),
    ("Deloitte — global semiconductor talent shortage",
     "https://www.deloitte.com/us/en/industries/tmt/articles/global-semiconductor-talent-shortage.html"),
    ("McKinsey / SEMI via Tom's Hardware — 157k US chip worker shortfall by 2030",
     "https://www.tomshardware.com/tech-industry/semiconductors/us-chip-manufacturers-are-in-dire-need-of-engineers-and-technicians-experts-suggest-a-shortage-of-up-to-157-000-semiconductor-workers-by-2030"),
    ("Kearney / IEEE via IEEE Spectrum — 450k-1.5M power engineers needed by 2030",
     "https://spectrum.ieee.org/power-engineering-workforce-gap-2674141268"),
    ("IEEE Spectrum — AI data centres face a skilled-worker shortage",
     "https://spectrum.ieee.org/ai-data-centers-engineers-jobs"),
    ("Zippia — robotics engineer job outlook and growth",
     "https://www.zippia.com/robotics-engineer-jobs/trends/"),
    ("HeroHunt — recruiting robotics engineers for physical AI (2026)",
     "https://www.herohunt.ai/blog/recruiting-robotics-engineers-for-physical-ai-2026/"),
    ("KORE1 — reshoring engineering jobs 2026",
     "https://www.kore1.com/reshoring-engineering-jobs-2026/"),
    ("Articuler — computer science unemployment rate 2026",
     "https://www.articuler.ai/resources/learn/computer-science-unemployment-rate/"),
    ("CSIS — Indonesia's battery industrial strategy",
     "https://www.csis.org/analysis/indonesias-battery-industrial-strategy"),
    ("Widya — jurusan teknik dengan gaji tertinggi di Indonesia (2026)",
     "https://widya.ai/jurusan-teknik-dengan-gaji-tertinggi/"),
    ("BLS OOH — bioengineers and biomedical engineers",
     "https://www.bls.gov/ooh/architecture-and-engineering/biomedical-engineers.htm"),
]


# Short labels for narrow table headers. Two majors whose full names both start
# with "Ilmu Komputer" are indistinguishable once a column truncates them.
SHORT = {
    "robotika": "Robotika", "kendali": "Kendali/Otomasi",
    "komputer_embedded": "Embedded", "dirgantara_uav": "Dirgantara/UAV",
    "semikonduktor": "Semikonduktor", "elektro_tenaga": "Elektro Tenaga",
    "energi_terbarukan": "Energi Terbarukan", "ai_ml": "AI/ML",
    "sw_generalis": "SW generalis", "sains_data": "Sains Data",
    "siber": "Keamanan Siber", "mesin": "T. Mesin", "industri": "T. Industri",
    "metalurgi": "Metalurgi", "kimia": "T. Kimia", "tambang": "Pertambangan",
    "sipil": "T. Sipil", "biomedis": "Biomedis", "bioteknologi": "Bioteknologi",
    "kedokteran": "Kedokteran", "keperawatan": "Keperawatan",
    "farmasi": "Farmasi", "agritech": "Agritech",
    "akuntansi": "Akuntansi", "dkv": "DKV",
}
for _m in MAJORS:
    _m["short"] = SHORT[_m["key"]]
assert set(SHORT) == {m["key"] for m in MAJORS}
