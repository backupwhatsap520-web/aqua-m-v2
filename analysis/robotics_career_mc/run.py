"""CLI: what a robotics degree in Indonesia realistically pays, over ten years.

    python3 -m robotics_career_mc.run                  # 120k orang + uji tekan
    python3 -m robotics_career_mc.run --trials 400000  # run lebih berat
    python3 -m robotics_career_mc.run --quick          # 15k, tanpa uji tekan
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import os
import time
from contextlib import contextmanager

from . import career, report as R, segments as G


@contextmanager
def _perturbed(mutate):
    saved_segs = copy.deepcopy(G.SEGMENTS)
    saved = {k: getattr(G, k) for k in
             ("CYCLE_SD", "COMMODITY_SD", "FUNDING_SD", "MISMATCH_CYCLE_PULL",
              "REENTRY_PENALTY", "EXPERIENCE_GATE")}
    try:
        mutate(G)
        yield
    finally:
        G.SEGMENTS[:] = saved_segs
        for k, v in saved.items():
            setattr(G, k, v)
        G.SEG_BY_KEY = {s["key"]: s for s in G.SEGMENTS}


def _scale(keys, field, factor):
    def f(mod):
        for s in mod.SEGMENTS:
            if keys is None or s["key"] in keys:
                s[field] = s[field] * factor
    return f


def _shift(keys, field, delta):
    def f(mod):
        for s in mod.SEGMENTS:
            if keys is None or s["key"] in keys:
                s[field] = s[field] + delta
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


LOCAL = tuple(s["key"] for s in G.SEGMENTS
              if s["key"] not in ("remote_luar", "pindah_luar"))

STRESS = [
    ("Adopsi robot/otomasi RI stagnan",
     _combine(_scale(("si_otomasi", "manufaktur_mnc", "manufaktur_lokal",
                      "vendor_distributor"), "base", 0.70),
              _shift(("si_otomasi", "manufaktur_mnc", "manufaktur_lokal",
                      "vendor_distributor"), "growth", -0.020))),
    ("Hilirisasi & komoditas meleset",
     _combine(_scale(("tambang_smelter",), "base", 0.45),
              _shift(("tambang_smelter", "manufaktur_lokal"), "growth", -0.025))),
    ("Funding winter permanen untuk startup",
     _combine(_scale(("startup_hw",), "base", 0.35),
              _scale(("startup_hw",), "layoff", 1.7))),
    ("Pintu remote & luar negeri menyempit",
     _combine(_scale(("remote_luar", "pindah_luar"), "base", 0.30),
              _scalar("EXPERIENCE_GATE",
                      {**G.EXPERIENCE_GATE, "remote_luar": 0.08,
                       "pindah_luar": 0.07}))),
    ("Mismatch separah klaim ekstrem (80%)",
     _scale(("switch_nonteknis",), "base", 2.2)),
    ("Plafon gaji lokal 25% lebih rendah",
     _scale(LOCAL, "ceiling", 0.75)),
    ("Upah riil nasional stagnan",
     _shift(None, "growth", -0.025)),
    ("Sekali keluar bidang, sulit kembali (2x)",
     _scalar("REENTRY_PENALTY", 0.40)),
    ("Dekade jauh lebih bergejolak",
     _combine(_scalar("CYCLE_SD", 0.090), _scalar("COMMODITY_SD", 0.120),
              _scalar("FUNDING_SD", 0.140))),
]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--trials", type=int, default=120000)
    ap.add_argument("--seed", type=int, default=20260928)
    ap.add_argument("--stress-trials", type=int, default=25000)
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--no-stress", action="store_true")
    ap.add_argument("--out", default=None)
    args = ap.parse_args(argv)

    trials = 15000 if args.quick else args.trials
    do_stress = not (args.quick or args.no_stress)
    out_dir = args.out or os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "out", "robotika")
    os.makedirs(out_dir, exist_ok=True)

    print(f"Karier lulusan robotika di Indonesia, {G.BASE_YEAR}"
          f"–{G.BASE_YEAR + G.HORIZON}")
    print(f"  {len(G.PERSONAS)} profil × {trials:,} orang × {G.HORIZON} tahun "
          f"× {len(G.SEGMENTS)} segmen kerja (seed {args.seed})")

    t0 = time.time()
    rows = []
    base = None
    for i, (label, persona) in enumerate(G.PERSONAS):
        s = career.summarise(career.simulate(
            n_trials=trials, seed=args.seed + 17 * i, persona=persona,
            label=label))
        rows.append(s)
        if persona is None:
            base = s
        print(f"  ✓ {label}")
    elapsed = time.time() - t0
    print(f"  selesai dalam {elapsed:.1f} s\n")

    print(f"Galat baku total penghasilan (populasi acak): "
          f"±{base['cum_se']:,.1f} juta "
          f"({base['cum_se'] / base['cum_mean']:.2%} dari nilai tengahnya)\n")

    blocks = []

    def emit(title, body, note=None):
        print("=" * 104)
        print(title)
        if note:
            print(note)
        print("=" * 104)
        print(body)
        print()
        blocks.append((title, note, body))

    emit("1. JAWABANNYA TERGANTUNG SIAPA ANDA — bukan tergantung jurusannya",
         R.table_personas(rows),
         "Gaji bulanan, juta rupiah, harga 2026. Semua profil mengambil jurusan\n"
         "yang sama persis. Yang berbeda hanya apa yang mereka lakukan selama "
         "kuliah.")

    emit("2. PROFIL YANG SAMA, DILIHAT DARI SISI LAIN",
         R.table_persona_detail(rows))

    emit("3. LINTASAN GAJI POPULASI ACAK, TAHUN DEMI TAHUN",
         R.table_fan(base["fan"]),
         "Sebaran gaji bulanan lulusan robotika di setiap tahun kariernya.\n"
         "Perhatikan mulutnya yang melebar: perbedaan antarorang tumbuh jauh\n"
         "lebih cepat daripada nilai tengahnya.")

    emit("4. KE MANA MEREKA SEBENARNYA BEKERJA",
         R.table_segments(base["seg_y1"], base["seg_y10"], base["seg_w10"]),
         "Populasi acak. Ini daftar pekerjaan yang benar-benar ada di Indonesia\n"
         "untuk lulusan robotika — bukan daftar cita-cita.")

    emit("5. APA ISI TIAP SEGMEN", R.table_segment_notes())

    emit("6. FAKTOR PRIBADI MANA YANG PALING MENENTUKAN",
         R.table_sensitivity(base["sens"]),
         "Dihitung pada populasi acak, tempat kelima faktor ini berbeda-beda\n"
         "antarorang.")

    stressed = []
    if do_stress:
        print(f"Menjalankan uji tekan asumsi ({len(STRESS)} skenario × "
              f"{args.stress_trials:,} orang)...")
        for i, (name, mutate) in enumerate(STRESS, 1):
            with _perturbed(mutate):
                s = career.summarise(career.simulate(
                    n_trials=args.stress_trials, seed=args.seed + 5000 + i,
                    persona=None, label=name))
            stressed.append((name, s))
            print(f"  [{i}/{len(STRESS)}] {name}")
        print()
        sbase = career.summarise(career.simulate(
            n_trials=args.stress_trials, seed=args.seed + 4999, persona=None,
            label="dasar"))
        emit("7. UJI TEKAN ASUMSI — kalau dunia tidak seramah model saya",
             R.table_stress(sbase, stressed),
             "Tiap baris mematahkan satu asumsi lalu simulasi diulang pada "
             "populasi acak.\n"
             "Yang perlu Anda perhatikan bukan besarnya penurunan gaji, "
             "melainkan mana yang\n"
             "mengubah peluang Anda tetap bekerja di robotika.")

    # ----------------------------------------------------------- artefacts
    meta = {
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "base_year": G.BASE_YEAR, "horizon": G.HORIZON,
        "trials_per_persona": trials, "seed": args.seed,
        "personas": [label for label, _ in G.PERSONAS],
        "segments": len(G.SEGMENTS),
        "runtime_seconds": round(elapsed, 1),
        "cum_standard_error": round(base["cum_se"], 3),
        "stress_scenarios": [n for n, _ in STRESS] if do_stress else [],
        "currency": "IDR juta per bulan, riil, harga 2026",
    }
    csv_p = os.path.join(out_dir, "profil_karier.csv")
    seg_p = os.path.join(out_dir, "segmen_kerja.csv")
    json_p = os.path.join(out_dir, "hasil_karier.json")
    md_p = os.path.join(out_dir, "HASIL_KARIER_ROBOTIKA.md")
    R.write_csv(csv_p, rows)
    R.write_segment_csv(seg_p, base)
    R.write_json(json_p, meta, rows, base, stressed)

    with open(md_p, "w", encoding="utf-8") as fh:
        fh.write("# Keluaran Simulasi — Karier Lulusan Robotika di Indonesia, "
                 f"{G.BASE_YEAR}–{G.BASE_YEAR + G.HORIZON}\n\n")
        fh.write("> Dibuat otomatis oleh `robotics_career_mc`. Jangan disunting "
                 "tangan — jalankan ulang.\n"
                 "> Pembacaannya ada di "
                 "[`../../LAPORAN_KARIER_ROBOTIKA.md`](../../LAPORAN_KARIER_ROBOTIKA.md).\n\n")
        fh.write(f"- Dijalankan: `{meta['generated']}`\n")
        fh.write(f"- {len(G.PERSONAS)} profil × **{trials:,}** orang × "
                 f"{G.HORIZON} tahun × {len(G.SEGMENTS)} segmen "
                 f"(seed `{args.seed}`, {elapsed:.1f} s)\n")
        fh.write(f"- Galat baku total penghasilan: ±{base['cum_se']:,.1f} juta "
                 f"({base['cum_se'] / base['cum_mean']:.2%} relatif)\n")
        fh.write("- Semua rupiah: juta per bulan, **riil, harga 2026**\n\n")
        for title, note, body in blocks:
            fh.write(f"## {title}\n\n")
            if note:
                fh.write("".join(f"{ln}\n" for ln in note.splitlines()) + "\n")
            fh.write("```\n" + body + "\n```\n\n")
        fh.write("## Sumber yang mengkalibrasi parameter\n\n")
        for t, u in G.SOURCES:
            fh.write(f"- [{t}]({u})\n")

    print(f"Ditulis:\n  {csv_p}\n  {seg_p}\n  {json_p}\n  {md_p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
