"""Monte Carlo engine for ten-year graduate-demand outcomes.

The model is a small labour-market simulator, run many times:

  1. Draw a world.  A regime (AI accelerates / baseline / correction), a global
     capex factor, and one shock per sector.  Every major in the same sector
     shares that shock, so the outputs are correlated the way real careers are.
  2. Grow demand.  Each major gets a demand CAGR from its prior plus the
     regime, capex and sector draws.
  3. Subtract what the machines take.  An annual automation hazard scaled by
     the major's task exposure, its physical moat and its licensing moat;
     part of what is automated returns as expanded demand (the Jevons share).
  4. Grow supply with a four-year lag.  Enrolment chases the wage premium it
     saw when those students picked a major, which is what produces the classic
     boom-then-glut cobweb rather than a smooth curve.
  5. Price the result.  Tightness = demand / supply drives real wage growth and
     the probability of actually landing a job.

What comes out is not a forecast. It is a distribution of futures under stated
assumptions, and its job is to show which majors are robust across many worlds
rather than which one wins in the single world the modeller happened to guess.
"""

from __future__ import annotations

import math
import random
from array import array

from . import params as P


# ---------------------------------------------------------------- utilities

def _clamp(x, lo, hi):
    return lo if x < lo else (hi if x > hi else x)


def _pct(sorted_vals, q):
    """Linear-interpolated percentile of an already-sorted sequence."""
    n = len(sorted_vals)
    if n == 0:
        return float("nan")
    if n == 1:
        return sorted_vals[0]
    pos = q * (n - 1)
    lo = int(pos)
    hi = min(lo + 1, n - 1)
    frac = pos - lo
    return sorted_vals[lo] * (1.0 - frac) + sorted_vals[hi] * frac


class _Moments:
    """Running sums, so correlations cost no memory."""

    __slots__ = ("n", "sx", "sy", "sxx", "syy", "sxy")

    def __init__(self):
        self.n = 0
        self.sx = self.sy = self.sxx = self.syy = self.sxy = 0.0

    def add(self, x, y):
        self.n += 1
        self.sx += x
        self.sy += y
        self.sxx += x * x
        self.syy += y * y
        self.sxy += x * y

    def r(self):
        n = self.n
        if n < 2:
            return 0.0
        cov = self.sxy - self.sx * self.sy / n
        vx = self.sxx - self.sx * self.sx / n
        vy = self.syy - self.sy * self.sy / n
        if vx <= 0.0 or vy <= 0.0:
            return 0.0
        return cov / math.sqrt(vx * vy)


# ----------------------------------------------------------- employment link

def _p_employed(tightness):
    """Tightness -> probability of holding a job in the field.

    Logistic, floored at 0.55 and capped at 0.98: even a glutted field employs
    most of its graduates somewhere, and even a desperate field never reaches
    certainty.
    """
    return 0.55 + 0.43 / (1.0 + math.exp(-3.0 * (tightness - 1.0)))


# -------------------------------------------------------------------- engine

class Results:
    """Everything the report layer needs, already reduced."""

    def __init__(self, keys, n_trials, seed, horizon, checkpoint):
        self.keys = keys
        self.n_trials = n_trials
        self.seed = seed
        self.horizon = horizon
        self.checkpoint = checkpoint
        self.oi10 = {k: array("d") for k in keys}
        self.oi5 = {k: array("d") for k in keys}
        self.t10 = {k: array("d") for k in keys}
        self.wage10 = {k: array("d") for k in keys}
        self.sum_pemp10 = dict.fromkeys(keys, 0.0)
        self.sum_pentry = dict.fromkeys(keys, 0.0)
        self.sum_disp = dict.fromkeys(keys, 0.0)
        self.sum_t5 = dict.fromkeys(keys, 0.0)
        self.n_shortage10 = dict.fromkeys(keys, 0)
        self.n_glut10 = dict.fromkeys(keys, 0)
        self.n_top5 = dict.fromkeys(keys, 0)
        self.n_top3 = dict.fromkeys(keys, 0)
        self.regime_names = [r["name"] for r in P.REGIMES]
        self.regime_count = dict.fromkeys(self.regime_names, 0)
        self.regime_oi = {r: dict.fromkeys(keys, 0.0) for r in self.regime_names}
        self.sens = {k: {} for k in keys}          # driver -> _Moments
        self.pairs = {}                            # (a, b) -> _Moments


def simulate(n_trials=40000, seed=20260920, horizon=None, checkpoint=None,
             progress=None):
    horizon = horizon or P.HORIZON
    checkpoint = checkpoint or P.CHECKPOINT

    rng = random.Random(seed)
    gauss = rng.gauss
    randrand = rng.random

    majors = P.MAJORS
    keys = [m["key"] for m in majors]
    nm = len(majors)
    res = Results(keys, n_trials, seed, horizon, checkpoint)

    # Pre-unpack the parameter table into flat lists: attribute lookups inside
    # a 12-million-iteration loop are not free.
    d_mu = [m["d_mu"] for m in majors]
    d_sd = [m["d_sd"] for m in majors]
    s_mu = [m["s_mu"] for m in majors]
    s_sd = [m["s_sd"] for m in majors]
    elast = [m["elast"] for m in majors]
    jevons = [m["jevons"] for m in majors]
    beta = [m["beta"] for m in majors]
    wage0 = [m["wage0"] for m in majors]
    sect = [m["sector"] for m in majors]
    # Automation hazard is a fixed function of the major's structural moats.
    haz_base = [
        m["ai_exp"] * ((1.0 - m["phys"]) ** 0.8) * (1.0 - 0.6 * m["reg"])
        for m in majors
    ]
    entry_exposure = [m["ai_exp"] * (1.0 - m["phys"]) for m in majors]

    regimes = P.REGIMES
    reg_cum = []
    acc = 0.0
    for r in regimes:
        acc += r["p"]
        reg_cum.append(acc)

    # Six mutually independent primitive draws. Because they are
    # orthogonal by construction, r**2 reads as a variance share.
    sensors = ("regime_ai", "capex", "sector_shock", "demand_idio",
               "automation_idio", "supply_idio")
    for k in keys:
        res.sens[k] = {s: _Moments() for s in sensors}
    for i in range(nm):
        for j in range(i + 1, nm):
            res.pairs[(keys[i], keys[j])] = _Moments()

    oi10_a = [res.oi10[k] for k in keys]
    oi5_a = [res.oi5[k] for k in keys]
    t10_a = [res.t10[k] for k in keys]
    w10_a = [res.wage10[k] for k in keys]

    lag = P.EDU_LAG
    kappa = P.WAGE_KAPPA
    drift = P.WAGE_DRIFT
    wg_min = P.WAGE_GROWTH_MIN
    wg_max = P.WAGE_GROWTH_MAX
    feedback = P.SUPPLY_FEEDBACK
    macro_to_cagr = P.MACRO_TO_CAGR
    sector_sd = P.SECTOR_SD
    log = math.log

    # scratch, reused every trial
    demand = [1.0] * nm
    supply = [1.0] * nm
    wage = [1.0] * nm
    wage_hist = [[1.0] * (horizon + 1) for _ in range(nm)]
    g_draw = [0.0] * nm
    h_draw = [0.0] * nm
    sg_draw = [0.0] * nm
    d_idio = [0.0] * nm
    h_idio = [0.0] * nm
    trial_oi = [0.0] * nm

    for trial in range(n_trials):
        if progress is not None and trial % progress == 0 and trial:
            print(f"    ... {trial:,}/{n_trials:,} trials", flush=True)

        # --- draw the world -------------------------------------------------
        u = randrand()
        ri = 0
        while u > reg_cum[ri] and ri < len(reg_cum) - 1:
            ri += 1
        regime = regimes[ri]
        ai_intensity = regime["ai_intensity"]
        adders = regime["adders"]
        macro = gauss(regime["capex_mu"], P.MACRO_SD)
        shock = {s: gauss(0.0, sector_sd) for s in P.SECTORS}

        res.regime_count[regime["name"]] += 1

        # --- draw each major's path parameters ------------------------------
        for i in range(nm):
            s = sect[i]
            eps = gauss(0.0, d_sd[i])
            d_idio[i] = eps
            g = (d_mu[i] + adders[s] + beta[i] * macro * macro_to_cagr
                 + shock[s] + eps)
            g_draw[i] = _clamp(g, -0.060, 0.220)

            # Automation bites at a rate the modeller is genuinely unsure of.
            hmult = _clamp(gauss(1.0, 0.25), 0.40, 1.80)
            h_idio[i] = hmult
            h_draw[i] = _clamp(haz_base[i] * ai_intensity * hmult * 0.09,
                               0.0, 0.25)

            sg_draw[i] = gauss(0.0, s_sd[i])   # persistent enrolment surprise

            demand[i] = 1.0
            supply[i] = 1.0
            wage[i] = 1.0
            wage_hist[i][0] = 1.0

        # --- walk the decade ------------------------------------------------
        for t in range(1, horizon + 1):
            # enrolment reacts to the premium students saw when they enrolled
            if t > lag:
                src = t - lag
                avg_prev = 0.0
                for i in range(nm):
                    avg_prev += wage_hist[i][src]
                avg_prev /= nm
            else:
                avg_prev = None

            for i in range(nm):
                demand[i] *= (1.0 + g_draw[i])
                disp = 1.0 - (1.0 - h_draw[i]) ** t
                d_eff = demand[i] * (1.0 - disp * (1.0 - jevons[i]))

                if avg_prev is None:
                    signal = 1.0
                else:
                    signal = wage_hist[i][t - lag] / avg_prev
                sg = s_mu[i] + elast[i] * feedback * (signal - 1.0) + sg_draw[i]
                supply[i] *= (1.0 + _clamp(sg, -0.020, 0.250))

                tight = d_eff / supply[i] if supply[i] > 1e-9 else 0.0
                if tight < 1e-6:
                    tight = 1e-6
                wg = _clamp(drift + kappa * log(tight), wg_min, wg_max)
                wage[i] *= (1.0 + wg)
                wage_hist[i][t] = wage[i]

                if t == checkpoint:
                    pe5 = _p_employed(tight)
                    oi5_a[i].append(wage0[i] * wage[i] * pe5)
                    res.sum_t5[keys[i]] += tight
                    squeeze = _clamp(entry_exposure[i] * ai_intensity * 0.50,
                                     0.0, 0.60)
                    res.sum_pentry[keys[i]] += pe5 * (1.0 - squeeze)
                if t == horizon:
                    pe = _p_employed(tight)
                    oi = wage0[i] * wage[i] * pe
                    trial_oi[i] = oi
                    k = keys[i]
                    oi10_a[i].append(oi)
                    t10_a[i].append(tight)
                    w10_a[i].append(wage0[i] * wage[i])
                    res.sum_pemp10[k] += pe
                    res.sum_disp[k] += disp
                    if tight > 1.05:
                        res.n_shortage10[k] += 1
                    if tight < 0.90:
                        res.n_glut10[k] += 1
                    res.regime_oi[regime["name"]][k] += oi

        # --- per-trial bookkeeping -------------------------------------------
        order = sorted(range(nm), key=lambda i: trial_oi[i], reverse=True)
        for rank, i in enumerate(order):
            if rank < 5:
                res.n_top5[keys[i]] += 1
                if rank < 3:
                    res.n_top3[keys[i]] += 1
            else:
                break

        for i in range(nm):
            k = keys[i]
            oi = trial_oi[i]
            sm = res.sens[k]
            sm["regime_ai"].add(ai_intensity, oi)
            sm["capex"].add(macro, oi)
            sm["sector_shock"].add(shock[sect[i]], oi)
            sm["demand_idio"].add(d_idio[i], oi)
            sm["automation_idio"].add(h_idio[i], oi)
            sm["supply_idio"].add(sg_draw[i], oi)

        pairs = res.pairs
        for i in range(nm):
            oi_i = trial_oi[i]
            ki = keys[i]
            for j in range(i + 1, nm):
                pairs[(ki, keys[j])].add(oi_i, trial_oi[j])

    return res


# ------------------------------------------------------------------ reducing

def summarise(res):
    """Reduce raw trial arrays into the per-major table the report prints."""
    n = res.n_trials
    rows = []
    for m in P.MAJORS:
        k = m["key"]
        oi10 = sorted(res.oi10[k])
        oi5 = sorted(res.oi5[k])
        t10 = sorted(res.t10[k])
        w10 = sorted(res.wage10[k])

        mean_oi = sum(oi10) / n
        var = sum((x - mean_oi) ** 2 for x in oi10) / (n - 1)
        sd = math.sqrt(var)
        p10 = _pct(oi10, 0.10)
        # Expected shortfall: the average of the worst decile, not just its edge.
        tail = oi10[: max(1, n // 10)]
        cvar10 = sum(tail) / len(tail)

        rows.append({
            "key": k,
            "name": m["name"],
            "short": m["short"],
            "sector": m["sector"],
            "fit": m["fit"],
            "wage0": m["wage0"],
            "oi_mean": mean_oi,
            "oi_sd": sd,
            "oi_se": sd / math.sqrt(n),
            "oi_p10": p10,
            "oi_p25": _pct(oi10, 0.25),
            "oi_p50": _pct(oi10, 0.50),
            "oi_p75": _pct(oi10, 0.75),
            "oi_p90": _pct(oi10, 0.90),
            "oi_cvar10": cvar10,
            "oi5_p50": _pct(oi5, 0.50),
            "wage_p10": _pct(w10, 0.10),
            "wage_p50": _pct(w10, 0.50),
            "wage_p90": _pct(w10, 0.90),
            "tight_p10": _pct(t10, 0.10),
            "tight_p50": _pct(t10, 0.50),
            "tight_p90": _pct(t10, 0.90),
            "tight5_mean": res.sum_t5[k] / n,
            "p_shortage": res.n_shortage10[k] / n,
            "p_glut": res.n_glut10[k] / n,
            "p_emp": res.sum_pemp10[k] / n,
            "p_entry": res.sum_pentry[k] / n,
            "displaced": res.sum_disp[k] / n,
            "p_top5": res.n_top5[k] / n,
            "p_top3": res.n_top3[k] / n,
            "regime_oi": {
                r: (res.regime_oi[r][k] / res.regime_count[r]
                    if res.regime_count[r] else float("nan"))
                for r in res.regime_names
            },
            "sens": {s: mo.r() for s, mo in res.sens[k].items()},
        })

    # Risk-adjusted views.
    for r in rows:
        # Sharpe-like: how much expected value per unit of outcome spread.
        r["stability"] = r["oi_mean"] / r["oi_sd"] if r["oi_sd"] > 0 else 0.0
        # Worst regime the major lands in — the number that should decide a
        # ten-year commitment, not the average.
        r["oi_worst_regime"] = min(r["regime_oi"].values())
        # Value to someone who already owns a robotics/embedded skill base:
        # existing skill shortens the ramp and raises the odds of the good tail.
        r["oi_fit"] = r["oi_mean"] * (0.62 + 0.38 * r["fit"])
        r["oi_fit_p10"] = r["oi_p10"] * (0.62 + 0.38 * r["fit"])
    return rows


def hedge_pairs(res, rows, top_n=12):
    """Lowest-correlation pairs among the strongest majors.

    Two fields that fail in different worlds are a real hedge; two that fail
    together are one bet wearing two hats.
    """
    by_key = {r["key"]: r for r in rows}
    strong = [r["key"] for r in sorted(rows, key=lambda r: -r["oi_mean"])[:top_n]]
    out = []
    for i, a in enumerate(strong):
        for b in strong[i + 1:]:
            mo = res.pairs.get((a, b)) or res.pairs.get((b, a))
            if mo is None:
                continue
            out.append({
                "a": by_key[a]["name"], "b": by_key[b]["name"],
                "a_key": a, "b_key": b, "r": mo.r(),
                "combined": 0.5 * (by_key[a]["oi_mean"] + by_key[b]["oi_mean"]),
            })
    out.sort(key=lambda d: d["r"])
    return out
