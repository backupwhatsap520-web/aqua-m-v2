"""Tables for the Indonesian robotics-career simulation."""

from __future__ import annotations

import csv
import json

from . import segments as G


def _cut(text, width):
    return text if len(text) <= width else text[: width - 1] + "…"


def table_personas(rows):
    head = (f"{'Profil lulusan':<46} {'Thn-1':>13} {'Thn-5':>13} {'Thn-10':>13} "
            f"{'>20jt':>6} {'<8jt':>6} {'Robot':>6}")
    out = [head, "-" * len(head)]
    for r in rows:
        out.append(
            f"{_cut(r['label'], 46):<46} "
            f"{r['w1_p50']:>5.1f}({r['w1_p10']:>4.1f})" .rjust(13) + " " +
            f"{r['w5_p50']:>5.1f}({r['w5_p10']:>4.1f})".rjust(13) + " " +
            f"{r['w10_p50']:>5.1f}({r['w10_p10']:>4.1f})".rjust(13) + " " +
            f"{r['p_w10_over20']:>6.0%} {r['p_w10_under8']:>6.0%} "
            f"{r['p_infield_y10']:>6.0%}")
    out.append("")
    out.append("Angka utama = median (P50); dalam tanda kurung = P10 (kasus buruk).")
    out.append("Robot = peluang masih bekerja di robotika/otomasi pada tahun ke-10.")
    return "\n".join(out)


def table_persona_detail(rows):
    head = (f"{'Profil lulusan':<46} {'P90 thn-10':>11} {'Total 10thn':>12} "
            f"{'Tunggu kerja':>13} {'Pernah LN':>10} {'Keluar bidang':>14}")
    out = [head, "-" * len(head)]
    for r in rows:
        out.append(
            f"{_cut(r['label'], 46):<46} {r['w10_p90']:>11.1f} "
            f"{r['cum_mean']:>12,.0f} {r['search_months']:>10.1f} bln "
            f"{r['p_abroad_ever']:>10.0%} {r['p_left_y10']:>14.0%}")
    out.append("")
    out.append("Total 10thn = akumulasi penghasilan sepuluh tahun, juta rupiah "
               "harga 2026.")
    out.append("Tunggu kerja = rata-rata bulan menganggur sebelum pekerjaan "
               "pertama.")
    return "\n".join(out)


def table_fan(fan, width=52):
    pts = [(t, f) for t, f in enumerate(fan) if f]
    hi = max(f["p90"] for _, f in pts)
    lo = 0.0
    out = [f"{'Tahun':>5} {'P10':>6} {'P50':>6} {'P90':>6}  "
           f"{'sebaran gaji bulanan (juta Rp, harga 2026)':<{width}}"]
    out.append("-" * (27 + width))
    for t, f in pts:
        def pos(v):
            return max(0, min(width - 1, int(round((v - lo) / (hi - lo) * (width - 1)))))
        a, m, b = pos(f["p10"]), pos(f["p50"]), pos(f["p90"])
        cells = [" "] * width
        for i in range(a, b + 1):
            cells[i] = "─"
        cells[a] = "├"
        cells[b] = "┤"
        cells[m] = "●"
        out.append(f"{G.BASE_YEAR + t:>5} {f['p10']:>6.1f} {f['p50']:>6.1f} "
                   f"{f['p90']:>6.1f}  {''.join(cells)}")
    return "\n".join(out)


def table_segments(seg_y1, seg_y10, seg_w10):
    head = (f"{'Segmen pemberi kerja':<44} {'Thn-1':>7} {'Thn-10':>7} "
            f"{'Δ':>6} {'Gaji thn-10 (P10/P50/P90)':>27}")
    out = [head, "-" * len(head)]
    order = sorted(G.SEGMENTS, key=lambda s: -seg_y10.get(s["key"], 0))
    for s in order:
        k = s["key"]
        a, b = seg_y1.get(k, 0.0), seg_y10.get(k, 0.0)
        w = seg_w10.get(k)
        wage = (f"{w['p10']:>7.1f} /{w['p50']:>6.1f} /{w['p90']:>7.1f}"
                if w else f"{'sampel terlalu kecil':>27}")
        d = b - a
        arrow = "→" if abs(d) < 0.005 else ("▲" if d > 0 else "▼")
        out.append(f"{_cut(s['name'], 44):<44} {a:>7.1%} {b:>7.1%} "
                   f"{arrow}{abs(d):>5.1%} {wage}")
    out.append("")
    out.append("Thn-1 = ke mana lulusan mendarat; Thn-10 = di mana mereka "
               "berakhir sepuluh tahun kemudian.")
    return "\n".join(out)


def table_segment_notes():
    out = []
    for s in G.SEGMENTS:
        field = {1.0: "robotika", 0.5: "bersinggungan", 0.0: "keluar bidang"}[s["in_field"]]
        out.append(f"  {s['name']}")
        out.append(f"      {s['note']}")
        out.append(f"      masuk: Rp {s['w0_mu']:.1f} jt · plafon ~Rp {s['ceiling']} jt · "
                   f"{field} · risiko PHK/tahun {s['layoff']:.1%}")
    return "\n".join(out)


def table_sensitivity(sens):
    label = {"skill": "Kemampuan nyata (portofolio, hasil bangun)",
             "english": "Bahasa Inggris kerja",
             "network": "Jaringan & tier kampus",
             "mobility": "Kesiapan pindah (site/luar negeri)",
             "risk": "Toleransi risiko (startup, usaha sendiri)"}
    pairs = sorted(sens.items(), key=lambda kv: -abs(kv[1]))
    tot = sum(v * v for _, v in pairs) or 1.0
    out = [f"{'Faktor pribadi':<44} {'pengaruh':>40} {'r':>8} {'ragam':>7}",
           "-" * 101]
    for k, v in pairs:
        share = v * v / tot
        n = int(round(share * 40))
        out.append(f"{label[k]:<44} {('█' * n) if n else '·':<40} "
                   f"{v:>+8.3f} {share:>7.1%}")
    out.append("")
    out.append("Korelasi tiap atribut pribadi dengan total penghasilan sepuluh "
               "tahun. Ragam = porsi")
    out.append("keragaman hasil yang dijelaskan faktor itu, di antara kelima "
               "faktor ini.")
    return "\n".join(out)


def table_stress(base, stressed):
    head = (f"{'Uji tekan asumsi':<44} {'Gaji thn-10':>12} {'Δ':>8} "
            f"{'Di robotika':>12} {'P(>20jt)':>9} {'Total 10thn':>12}")
    out = [head, "-" * len(head)]
    out.append(f"{'(dasar)':<44} {base['w10_p50']:>12.1f} {'—':>8} "
               f"{base['p_infield_y10']:>12.0%} {base['p_w10_over20']:>9.0%} "
               f"{base['cum_mean']:>12,.0f}")
    out.append("-" * len(head))
    for name, s in stressed:
        d = s["w10_p50"] - base["w10_p50"]
        out.append(f"{_cut(name, 44):<44} {s['w10_p50']:>12.1f} "
                   f"{d:>+8.1f} {s['p_infield_y10']:>12.0%} "
                   f"{s['p_w10_over20']:>9.0%} {s['cum_mean']:>12,.0f}")
    return "\n".join(out)


# ------------------------------------------------------------------- writers

PERSONA_FIELDS = [
    "label", "n", "w1_p10", "w1_p50", "w1_p90", "w5_p10", "w5_p50", "w5_p90",
    "w10_p10", "w10_p25", "w10_p50", "w10_p75", "w10_p90", "w10_p99",
    "w10_mean", "peak_p50", "cum_mean", "cum_se", "cum_p10", "cum_p50",
    "cum_p90", "p_w10_over20", "p_w10_over35", "p_w10_under8",
    "p_infield_y10", "p_adjacent_y10", "p_left_y10", "years_infield",
    "p_ever_unemployed", "unemployed_months", "p_abroad_ever",
    "search_months", "p_search_over_year",
]


def write_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=PERSONA_FIELDS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r[k] for k in PERSONA_FIELDS})


def write_segment_csv(path, base):
    fields = ["key", "name", "in_field", "w0_mu", "ceiling", "layoff",
              "share_y1", "share_y10", "w10_p10", "w10_p50", "w10_p90"]
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for s in G.SEGMENTS:
            k = s["key"]
            d = base["seg_w10"].get(k) or {}
            w.writerow({
                "key": k, "name": s["name"], "in_field": s["in_field"],
                "w0_mu": s["w0_mu"], "ceiling": s["ceiling"],
                "layoff": s["layoff"],
                "share_y1": base["seg_y1"].get(k, 0.0),
                "share_y10": base["seg_y10"].get(k, 0.0),
                "w10_p10": d.get("p10"), "w10_p50": d.get("p50"),
                "w10_p90": d.get("p90"),
            })


def write_json(path, meta, rows, base, stressed):
    payload = {
        "meta": meta,
        "personas": rows,
        "base_population": base,
        "stress": [{"scenario": n, "result": s} for n, s in stressed],
        "segments": [
            {kk: s[kk] for kk in
             ("key", "name", "note", "in_field", "w0_mu", "w0_sd", "growth",
              "ceiling", "churn", "layoff", "base")}
            for s in G.SEGMENTS
        ],
        "sources": [{"title": t, "url": u} for t, u in G.SOURCES],
    }
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
