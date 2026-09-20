"""Turn simulation output into tables a human can argue with."""

from __future__ import annotations

import csv
import json
import math

from . import params as P


def _cut(text, width):
    return text if len(text) <= width else text[: width - 1] + "…"


def _fan(p10, p50, p90, lo, hi, width=28):
    """One-line P10-P50-P90 fan, drawn on a shared scale."""
    span = hi - lo if hi > lo else 1.0
    def pos(v):
        return max(0, min(width - 1, int(round((v - lo) / span * (width - 1)))))
    a, m, b = pos(p10), pos(p50), pos(p90)
    cells = [" "] * width
    for i in range(a, b + 1):
        cells[i] = "─"
    cells[a] = "├"
    cells[b] = "┤"
    cells[m] = "●"
    return "".join(cells)


def table_main(rows, limit=None):
    rows = sorted(rows, key=lambda r: -r["oi_mean"])
    if limit:
        rows = rows[:limit]
    lo = min(r["oi_p10"] for r in rows)
    hi = max(r["oi_p90"] for r in rows)
    out = []
    head = (f"{'#':>2}  {'Jurusan':<44} {'IPK*':>6} {'P10':>6} {'P90':>6} "
            f"{'Gaji50':>7} {'Ketat':>6} {'P(lgk)':>7} {'P(bjr)':>7} {'Top5':>6}")
    out.append(head)
    out.append("-" * len(head))
    for i, r in enumerate(rows, 1):
        out.append(
            f"{i:>2}  {_cut(r['name'], 44):<44} {r['oi_mean']:>6.2f} {r['oi_p10']:>6.2f} "
            f"{r['oi_p90']:>6.2f} {r['wage_p50']:>7.1f} {r['tight_p50']:>6.2f} "
            f"{r['p_shortage']:>7.0%} {r['p_glut']:>7.0%} {r['p_top5']:>6.0%}"
        )
    out.append("")
    out.append("Sebaran hasil 10 tahun (P10 ├── P50 ● ── P90 ┤), skala bersama:")
    for r in rows:
        out.append(f"  {_cut(r['name'], 42):<42} {_fan(r['oi_p10'], r['oi_p50'], r['oi_p90'], lo, hi)}"
                   f"  {r['oi_p10']:>5.1f} … {r['oi_p90']:<5.1f}")
    return "\n".join(out)


def table_regimes(rows, regime_names, limit=14):
    rows = sorted(rows, key=lambda r: -r["oi_mean"])[:limit]
    w = max(len(n) for n in regime_names)
    head = f"{'Jurusan':<44} " + " ".join(f"{n[:w]:>{max(w,7)}}" for n in regime_names) + f" {'Δ':>7}"
    out = [head, "-" * len(head)]
    for r in rows:
        vals = [r["regime_oi"][n] for n in regime_names]
        spread = max(vals) - min(vals)
        out.append(f"{_cut(r['name'], 44):<44} " +
                   " ".join(f"{v:>{max(w,7)}.2f}" for v in vals) +
                   f" {spread:>7.2f}")
    return "\n".join(out)


def table_robustness(rows, limit=14):
    """Rank by the worst regime, not the average. A ten-year commitment is
    decided by how bad the bad case is."""
    rows = sorted(rows, key=lambda r: -r["oi_worst_regime"])[:limit]
    head = (f"{'#':>2}  {'Jurusan':<44} {'Skenario terburuk':>18} {'CVaR10':>8} "
            f"{'Stabilitas':>11}")
    out = [head, "-" * len(head)]
    for i, r in enumerate(rows, 1):
        out.append(f"{i:>2}  {_cut(r['name'], 44):<44} {r['oi_worst_regime']:>18.2f} "
                   f"{r['oi_cvar10']:>8.2f} {r['stability']:>11.2f}")
    return "\n".join(out)


def table_fit(rows, limit=14):
    rows = sorted(rows, key=lambda r: -r["oi_fit"])[:limit]
    head = (f"{'#':>2}  {'Jurusan':<44} {'Skor+fit':>9} {'P10+fit':>9} "
            f"{'Fit':>5} {'Otomasi':>8}")
    out = [head, "-" * len(head)]
    for i, r in enumerate(rows, 1):
        out.append(f"{i:>2}  {_cut(r['name'], 44):<44} {r['oi_fit']:>9.2f} "
                   f"{r['oi_fit_p10']:>9.2f} {r['fit']:>5.2f} {r['displaced']:>8.0%}")
    return "\n".join(out)


def table_sensitivity(rows, keys, drivers=None):
    drivers = drivers or ("regime_ai", "capex", "sector_shock",
                          "demand_idio", "automation_idio", "supply_idio")
    label = {"regime_ai": "rezim AI (bersama)",
             "capex": "siklus capex global (bersama)",
             "sector_shock": "kejutan sektor (bersama)",
             "demand_idio": "kejutan permintaan bidang",
             "automation_idio": "kecepatan otomasi bidang",
             "supply_idio": "kejutan pasokan lulusan"}
    by_key = {r["key"]: r for r in rows}
    out = []
    for k in keys:
        r = by_key[k]
        out.append(f"\n{r['name']}")
        pairs = sorted(((label[d], r["sens"][d]) for d in drivers),
                       key=lambda t: -abs(t[1]))
        tot = sum(v * v for _, v in pairs) or 1.0
        for nm, val in pairs:
            share = val * val / tot
            n = int(round(share * 34))
            bar = ("█" * n) if n else "·"
            side = "+" if val >= 0 else "−"
            out.append(f"   {nm:<30} {side} {bar:<34} "
                       f"r={val:+.3f}  ragam {share:>5.1%}")
    return "\n".join(out)


def table_hedges(pairs, limit=10):
    head = f"{'Pasangan bidang':<74} {'korelasi':>9} {'rata2 skor':>11}"
    out = [head, "-" * len(head)]
    for p in pairs[:limit]:
        combo = f"{_cut(p['a'], 35)} + {_cut(p['b'], 35)}"
        out.append(f"{combo:<74} {p['r']:>+9.2f} {p['combined']:>11.2f}")
    return "\n".join(out)


def table_stress(base_rows, stress_results, focus_keys):
    """How far each headline major moves when a load-bearing assumption breaks."""
    base_rank = {r["key"]: i + 1 for i, r in
                 enumerate(sorted(base_rows, key=lambda r: -r["oi_mean"]))}
    by_key = {r["key"]: r for r in base_rows}
    head = f"{'Uji tekan asumsi':<40} " + " ".join(
        f"{_cut(by_key[k]['short'], 14):>15}" for k in focus_keys)
    out = [head, "-" * len(head)]
    out.append(f"{'(peringkat dasar)':<40} " +
               " ".join(f"{('#%d' % base_rank[k]):>15}" for k in focus_keys))
    out.append("-" * len(head))
    for name, rows in stress_results:
        rank = {r["key"]: i + 1 for i, r in
                enumerate(sorted(rows, key=lambda r: -r["oi_mean"]))}
        cells = []
        for k in focus_keys:
            d = rank[k] - base_rank[k]
            arrow = "=" if d == 0 else (f"▲{-d}" if d < 0 else f"▼{d}")
            cells.append(f"{('#%d %s' % (rank[k], arrow)):>15}")
        out.append(f"{name[:40]:<40} " + " ".join(cells))
    return "\n".join(out)


# ------------------------------------------------------------------- writers

CSV_FIELDS = [
    "key", "name", "short", "sector", "fit", "wage0", "oi_mean", "oi_sd", "oi_se",
    "oi_p10", "oi_p25", "oi_p50", "oi_p75", "oi_p90", "oi_cvar10", "oi5_p50",
    "wage_p10", "wage_p50", "wage_p90", "tight_p10", "tight_p50", "tight_p90",
    "tight5_mean", "p_shortage", "p_glut", "p_emp", "p_entry", "displaced",
    "p_top5", "p_top3", "stability", "oi_worst_regime", "oi_fit", "oi_fit_p10",
]


def write_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=CSV_FIELDS, extrasaction="ignore")
        w.writeheader()
        for r in sorted(rows, key=lambda r: -r["oi_mean"]):
            w.writerow({k: r[k] for k in CSV_FIELDS})


def write_json(path, rows, meta, hedges):
    payload = {
        "meta": meta,
        "majors": sorted(rows, key=lambda r: -r["oi_mean"]),
        "hedges": hedges[:20],
        "sources": [{"title": t, "url": u} for t, u in P.SOURCES],
    }
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2,
                  default=lambda o: None if isinstance(o, float) and math.isnan(o) else o)
