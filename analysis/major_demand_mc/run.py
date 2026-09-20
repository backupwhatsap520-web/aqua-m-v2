"""CLI: run the simulation, print the tables, write the artefacts.

    python3 -m major_demand_mc.run                 # 40k trials, full stress suite
    python3 -m major_demand_mc.run --trials 200000 # heavier run
    python3 -m major_demand_mc.run --quick         # 5k trials, no stress tests
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import os
import time
from contextlib import contextmanager

from . import mc, params as P, report as R


HEADLINE = ["robotika", "kendali", "komputer_embedded", "semikonduktor",
            "elektro_tenaga", "ai_ml", "sw_generalis"]


# ------------------------------------------------------------ stress testing

@contextmanager
def _perturbed(mutate):
    """Temporarily rewrite the parameter deck, run, then put it all back."""
    saved_majors = copy.deepcopy(P.MAJORS)
    saved_regimes = copy.deepcopy(P.REGIMES)
    saved_scalars = {k: getattr(P, k) for k in
                     ("WAGE_KAPPA", "SUPPLY_FEEDBACK", "MACRO_TO_CAGR",
                      "WAGE_GROWTH_MAX")}
    try:
        mutate(P)
        yield
    finally:
        P.MAJORS[:] = saved_majors
        P.REGIMES = saved_regimes
        for k, v in saved_scalars.items():
            setattr(P, k, v)
        P.MAJOR_BY_KEY = {m["key"]: m for m in P.MAJORS}


def _scale(keys, field, factor):
    def f(mod):
        for m in mod.MAJORS:
            if keys is None or m["key"] in keys:
                m[field] = m[field] * factor
    return f


def _shift(keys, field, delta, lo=None, hi=None):
    def f(mod):
        for m in mod.MAJORS:
            if keys is None or m["key"] in keys:
                v = m[field] + delta
                if lo is not None:
                    v = max(lo, v)
                if hi is not None:
                    v = min(hi, v)
                m[field] = v
    return f


def _set_field(keys, field, value):
    def f(mod):
        for m in mod.MAJORS:
            if keys is None or m["key"] in keys:
                m[field] = value
    return f


def _sector_adder(sector, delta):
    def f(mod):
        regimes = copy.deepcopy(mod.REGIMES)
        for r in regimes:
            r["adders"][sector] = r["adders"][sector] + delta
        mod.REGIMES = regimes
    return f


def _reweight(weights):
    def f(mod):
        regimes = copy.deepcopy(mod.REGIMES)
        for r in regimes:
            r["p"] = weights[r["name"]]
        mod.REGIMES = regimes
    return f


def _scalar(name, value):
    def f(mod):
        setattr(mod, name, value)
    return f


def _combine(*fns):
    def f(mod):
        for fn in fns:
            fn(mod)
    return f


DIGITAL = ("ai_ml", "sains_data", "sw_generalis")
COMMODITY = ("metalurgi", "kimia", "tambang", "agritech")

STRESS = [
    ("Pasokan lulusan AI/data hanya separuh", _scale(DIGITAL, "s_mu", 0.5)),
    ("Ledakan lulusan robotika (pasokan 2x)", _scale(("robotika", "kendali"), "s_mu", 2.0)),
    ("Otomasi menembus kerja fisik lebih cepat", _scale(None, "phys", 0.75)),
    ("Capex robotika & otomasi meledak", _sector_adder("physical_ai", 0.020)),
    ("Hilirisasi & komoditas RI meleset", _scale(COMMODITY, "d_mu", 0.5)),
    ("Upah tidak responsif thd kelangkaan", _scalar("WAGE_KAPPA", 0.04)),
    ("Tanpa efek Jevons (otomasi murni negatif)", _set_field(None, "jevons", 0.0)),
    ("Peluang AI Winter digandakan", _reweight({"AI Akselerasi": 0.25,
                                                "Baseline": 0.35,
                                                "Koreksi / AI Winter": 0.40})),
    ("Semua CAGR permintaan dipangkas 2 pp", _shift(None, "d_mu", -0.020)),
    ("Enrolmen bereaksi 2x lebih cepat", _scalar("SUPPLY_FEEDBACK", 1.40)),
]


# -------------------------------------------------------------------- driver

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--trials", type=int, default=40000)
    ap.add_argument("--seed", type=int, default=20260920)
    ap.add_argument("--stress-trials", type=int, default=8000)
    ap.add_argument("--quick", action="store_true",
                    help="5k trials and no stress suite")
    ap.add_argument("--no-stress", action="store_true")
    ap.add_argument("--out", default=None,
                    help="directory for csv/json/markdown (default analysis/out)")
    args = ap.parse_args(argv)

    trials = 5000 if args.quick else args.trials
    do_stress = not (args.quick or args.no_stress)
    out_dir = args.out or os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "out")
    os.makedirs(out_dir, exist_ok=True)

    print(f"Simulasi Monte Carlo permintaan lulusan {P.BASE_YEAR}"
          f"–{P.BASE_YEAR + P.HORIZON}")
    print(f"  {len(P.MAJORS)} jurusan × {trials:,} lintasan × {P.HORIZON} tahun "
          f"(seed {args.seed})")
    t0 = time.time()
    res = mc.simulate(n_trials=trials, seed=args.seed,
                      progress=max(5000, trials // 8))
    rows = mc.summarise(res)
    hedges = mc.hedge_pairs(res, rows)
    elapsed = time.time() - t0
    print(f"  selesai dalam {elapsed:.1f} s\n")

    max_se = max(r["oi_se"] for r in rows)
    worst = max(rows, key=lambda r: r["oi_se"])
    print(f"Galat baku Monte Carlo terbesar: ±{max_se:.3f} "
          f"({worst['name']}) — {max_se / worst['oi_mean']:.2%} dari nilai tengahnya.")
    print("Rezim yang terpakai: " + ", ".join(
        f"{n} {c / trials:.1%}" for n, c in res.regime_count.items()) + "\n")

    blocks = []

    def emit(title, body, note=None):
        print("=" * 100)
        print(title)
        if note:
            print(note)
        print("=" * 100)
        print(body)
        print()
        blocks.append((title, note, body))

    emit("1. PERINGKAT UTAMA — nilai harapan 10 tahun",
         R.table_main(rows),
         "IPK* = indeks peluang karier: gaji riil bulanan 2036 (juta Rp, harga 2026)\n"
         "dikali peluang benar-benar bekerja di bidang itu. Ketat = permintaan/pasokan.\n"
         "P(lgk) = peluang bidang ini langka; P(bjr) = peluang banjir lulusan.")

    emit("2. HASIL PER REZIM DUNIA",
         R.table_regimes(rows, res.regime_names),
         "Skor yang sama, dihitung ulang di tiap dunia. Kolom Δ = selisih terbaik-terburuk;\n"
         "makin besar Δ makin besar taruhan Anda pada satu skenario terjadi.")

    emit("3. PERINGKAT TAHAN BANTING — diurut dari skenario TERBURUK",
         R.table_robustness(rows),
         "Komitmen 10 tahun diputuskan oleh seberapa buruk kasus buruknya, bukan rata-rata.\n"
         "CVaR10 = rata-rata hasil di 10% lintasan terburuk. Stabilitas = rerata/simpangan.")

    emit("4. PERINGKAT SETELAH DISESUAIKAN DENGAN BEKAL ROBOTIKA ANDA",
         R.table_fit(rows),
         "Fit = irisan dengan bekal robotika/embedded yang sudah Anda punya (0–1).\n"
         "Otomasi = porsi tugas inti yang diperkirakan terotomasi pada 2036.")

    emit("5. APA YANG SEBENARNYA MENGGERAKKAN HASIL (analisis sensitivitas)",
         R.table_sensitivity(rows, HEADLINE),
         "Korelasi antara setiap penggerak acak dan skor akhir, di seluruh lintasan.\n"
         "Batang terpanjang = asumsi yang paling menentukan. Itu yang harus Anda pantau.")

    emit("6. PASANGAN BIDANG YANG SALING MELINDUNGI",
         R.table_hedges(hedges),
         "Korelasi terendah antar 12 bidang terkuat. Dua bidang yang gagal di dunia yang\n"
         "berbeda adalah lindung nilai sejati; yang gagal bersamaan hanyalah satu taruhan.")

    entry = sorted(rows, key=lambda r: -r["p_entry"])
    body = (f"{'Jurusan':<46} {'P(kerja entry-level)':>21} {'P(kerja mapan)':>16}\n"
            + "-" * 85 + "\n")
    for r in entry:
        body += (f"{r['name'][:46]:<46} {r['p_entry']:>20.0%} "
                 f"{r['p_emp']:>15.0%}\n")
    emit("7. GERBANG MASUK — peluang lulusan baru tembus pekerjaan pertama (2031)",
         body.rstrip(),
         "Kolom kiri sudah dipotong oleh 'entry-level squeeze': tugas junior adalah yang\n"
         "paling dulu diserap AI, jadi peluang kerja pertama selalu lebih kecil dari\n"
         "peluang kerja bidang itu secara keseluruhan.")

    if do_stress:
        print("Menjalankan uji tekan asumsi "
              f"({len(STRESS)} skenario × {args.stress_trials:,} lintasan)...")
        stress_results = []
        for i, (name, mutate) in enumerate(STRESS, 1):
            with _perturbed(mutate):
                sres = mc.simulate(n_trials=args.stress_trials,
                                   seed=args.seed + 1000 + i)
                stress_results.append((name, mc.summarise(sres)))
            print(f"  [{i}/{len(STRESS)}] {name}")
        print()
        emit("8. UJI TEKAN ASUMSI — apakah peringkat bertahan kalau model saya salah?",
             R.table_stress(rows, stress_results, HEADLINE),
             "Tiap baris mematahkan satu asumsi yang menopang model, lalu simulasi diulang.\n"
             "Jurusan yang peringkatnya nyaris tak bergerak adalah kesimpulan yang kuat;\n"
             "yang berayun jauh hanya benar kalau asumsi spesifik itu kebetulan benar.")

    # ----------------------------------------------------------- artefacts
    meta = {
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "base_year": P.BASE_YEAR, "horizon": P.HORIZON,
        "checkpoint": P.CHECKPOINT, "trials": trials, "seed": args.seed,
        "runtime_seconds": round(elapsed, 1),
        "max_standard_error": round(max_se, 4),
        "regime_share": {n: c / trials for n, c in res.regime_count.items()},
        "stress_scenarios": [n for n, _ in STRESS] if do_stress else [],
    }
    csv_path = os.path.join(out_dir, "hasil_simulasi.csv")
    json_path = os.path.join(out_dir, "hasil_simulasi.json")
    md_path = os.path.join(out_dir, "HASIL_SIMULASI.md")
    R.write_csv(csv_path, rows)
    R.write_json(json_path, rows, meta, hedges)

    with open(md_path, "w", encoding="utf-8") as fh:
        fh.write("# Keluaran Simulasi Monte Carlo — Permintaan Lulusan "
                 f"{P.BASE_YEAR}–{P.BASE_YEAR + P.HORIZON}\n\n")
        fh.write("> Berkas ini dibuat otomatis oleh `major_demand_mc`. "
                 "Jangan disunting tangan — jalankan ulang simulasinya.\n"
                 "> Pembacaan dan kesimpulannya ada di "
                 "[`../LAPORAN_JURUSAN.md`](../LAPORAN_JURUSAN.md).\n\n")
        fh.write(f"- Dijalankan: `{meta['generated']}`\n")
        fh.write(f"- Lintasan: **{trials:,}** × {len(P.MAJORS)} jurusan × "
                 f"{P.HORIZON} tahun (seed `{args.seed}`, waktu {elapsed:.1f} s)\n")
        fh.write(f"- Galat baku Monte Carlo terbesar: ±{max_se:.3f} indeks "
                 f"({max_se / worst['oi_mean']:.2%} relatif)\n")
        fh.write("- Pangsa rezim: " + ", ".join(
            f"{n} {c / trials:.1%}" for n, c in res.regime_count.items()) + "\n\n")
        for title, note, body in blocks:
            fh.write(f"## {title}\n\n")
            if note:
                fh.write("".join(f"{ln}\n" for ln in note.splitlines()) + "\n")
            fh.write("```\n" + body + "\n```\n\n")
        fh.write("## Sumber yang mengkalibrasi prior\n\n")
        for t, u in P.SOURCES:
            fh.write(f"- [{t}]({u})\n")

    print(f"Ditulis:\n  {csv_path}\n  {json_path}\n  {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
