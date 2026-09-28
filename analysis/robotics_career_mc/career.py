"""Simulate one Indonesian robotics graduate's decade, many times over.

Each trial is a person, not an average. We draw who they are, draw the decade
they graduate into, place them in an employer segment, then step ten years:
wages grow, people change jobs, projects end, companies run out of funding, and
some leave engineering entirely. Nothing here is a forecast of any individual —
the output is the shape of the distribution a robotics graduate is drawing from.
"""

from __future__ import annotations

import math
import random
from array import array

from . import segments as G


def _clamp(x, lo, hi):
    return lo if x < lo else (hi if x > hi else x)


def _pct(sorted_vals, q):
    n = len(sorted_vals)
    if n == 0:
        return float("nan")
    if n == 1:
        return sorted_vals[0]
    pos = q * (n - 1)
    lo = int(pos)
    hi = min(lo + 1, n - 1)
    f = pos - lo
    return sorted_vals[lo] * (1.0 - f) + sorted_vals[hi] * f


class _Mom:
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
        if vx <= 0 or vy <= 0:
            return 0.0
        return cov / math.sqrt(vx * vy)


class Outcome:
    """Reduced results for one population (random draw or a fixed persona)."""

    def __init__(self, label, n, horizon=G.HORIZON):
        self.label = label
        self.n = n
        self.horizon = horizon
        # wage at the end of every year, for the fan chart
        self.wy = [array("d") for _ in range(horizon + 1)]
        # year-10 wage split by the segment the person ended up in
        self.seg_w10 = {s["key"]: array("d") for s in G.SEGMENTS}
        self.w1 = array("d")
        self.w5 = array("d")
        self.w10 = array("d")
        self.cum = array("d")       # total earnings over 10 years, IDR million
        self.peak = array("d")
        self.seg_y1 = {}
        self.seg_y10 = {}
        self.years_infield_sum = 0.0
        self.n_infield_y10 = 0
        self.n_adjacent_y10 = 0
        self.n_left_y10 = 0
        self.n_ever_unemployed = 0
        self.n_abroad_ever = 0
        self.unemployed_months_sum = 0.0
        self.search_sum = 0.0
        self.n_search_over_year = 0
        self.sens = {a: _Mom() for a in G.ATTRS}


def _draw_attrs(rng, persona):
    if persona is not None:
        return dict(persona)
    z = {a: rng.gauss(0.0, 1.0) for a in G.ATTRS}
    out = {}
    for a in G.ATTRS:
        row = G.ATTR_CHOL[a]
        out[a] = sum(coef * z[src] for src, coef in row.items())
    return out


def _weights(segs, attrs, years_infield, years_outfield, cyc, com, fun,
             scratch):
    """Placement weights: who you are, what you have done, and the decade."""
    total = 0.0
    for i, s in enumerate(segs):
        pull = s["pull"]
        score = 0.0
        for a, load in pull.items():
            score += load * attrs[a]
        w = s["base"] * math.exp(0.30 * score)

        gate = G.EXPERIENCE_GATE.get(s["key"])
        if gate:
            w *= (1.0 + gate * years_infield)

        w *= math.exp(6.0 * (cyc * s["cycle"] + com * s["commodity"]
                             + fun * s["funding"]))
        if s["in_field"] == 0.0:
            # a weak intake year pushes graduates into whatever job exists
            w *= math.exp(-G.MISMATCH_CYCLE_PULL * cyc)
        elif years_outfield > 0.0:
            # every year away from the field makes the way back narrower
            w *= math.exp(-G.REENTRY_PENALTY * years_outfield * s["in_field"])

        if w < 0.02:
            w = 0.02
        scratch[i] = w
        total += w
    return total


def _place(rng, segs, attrs, years_infield, years_outfield, cyc, com, fun,
           scratch):
    total = _weights(segs, attrs, years_infield, years_outfield, cyc, com,
                     fun, scratch)
    u = rng.random() * total
    acc = 0.0
    for i in range(len(segs)):
        acc += scratch[i]
        if u <= acc:
            return i
    return len(segs) - 1


def _entry_wage(rng, seg, attrs, years_exp):
    base = seg["w0_mu"] * (1.0 + G.SKILL_WAGE_GAIN * attrs["skill"])
    base *= (1.0 + 0.09 * years_exp)      # experience is portable
    w = base + rng.gauss(0.0, seg["w0_sd"])
    return max(2.2, w)


def simulate(n_trials=120000, seed=20260928, persona=None, label="acak",
             horizon=None):
    horizon = horizon or G.HORIZON
    rng = random.Random(seed)
    gauss = rng.gauss
    segs = G.SEGMENTS
    ns = len(segs)
    out = Outcome(label, n_trials, horizon)
    scratch = [0.0] * ns
    keys = [s["key"] for s in segs]
    for k in keys:
        out.seg_y1[k] = 0
        out.seg_y10[k] = 0

    for _ in range(n_trials):
        attrs = _draw_attrs(rng, persona)

        # the decade you happen to graduate into
        cyc = gauss(0.0, G.CYCLE_SD)
        com = gauss(0.0, G.COMMODITY_SD)
        fun = gauss(0.0, G.FUNDING_SD)

        years_infield = 0.0
        years_outfield = 0.0
        years_exp = 0.0
        si = _place(rng, segs, attrs, 0.0, 0.0, cyc, com, fun, scratch)
        seg = segs[si]
        wage = _entry_wage(rng, seg, attrs, 0.0)
        out.seg_y1[keys[si]] += 1

        growth = (seg["growth"] + G.SKILL_GROWTH_GAIN * attrs["skill"]
                  + gauss(0.0, seg["growth_sd"])
                  + 0.50 * cyc * seg["cycle"] + 0.35 * com * seg["commodity"]
                  + 0.30 * fun * seg["funding"])
        growth = _clamp(growth, -0.050, 0.220)

        ceiling_mult = _clamp(0.60 + 0.25 * attrs["skill"], 0.45, 1.30)
        # months spent hunting for the first job, before any salary at all
        search = _clamp(gauss(G.SEARCH_MONTHS_MU
                              - G.SEARCH_SKILL_GAIN * attrs["skill"]
                              - G.SEARCH_NETWORK_GAIN * attrs["network"],
                              G.SEARCH_MONTHS_SD), 0.0, 15.0)
        out.search_sum += search
        if search >= 12.0:
            out.n_search_over_year += 1
        cum = 0.0
        peak = wage
        unemployed_months = 0.0
        ever_unemployed = False
        abroad = 1.0 if seg["key"] in ("remote_luar", "pindah_luar") else 0.0
        forced_move = False

        for t in range(1, horizon + 1):
            # --- involuntary break -----------------------------------------
            lay = _clamp(seg["layoff"] * (1.0 - 6.0 * cyc * seg["cycle"]
                                          - 4.0 * fun * seg["funding"]),
                         0.004, 0.55)
            months_out = 0.0
            if rng.random() < lay:
                months_out = 2.0 + rng.random() * 6.0
                ever_unemployed = True
                unemployed_months += months_out
                forced_move = True

            worked = 12.0 - months_out
            if t == 1:
                worked -= min(search, 12.0)
            elif t == 2 and search > 12.0:
                worked -= (search - 12.0)
            if worked < 0.0:
                worked = 0.0
            cum += wage * worked
            years_infield += seg["in_field"] * (worked / 12.0)
            years_outfield += (1.0 - seg["in_field"]) * (worked / 12.0)
            years_exp += worked / 12.0

            out.wy[t].append(wage)
            if t == 1:
                out.w1.append(wage)
            if t == 5:
                out.w5.append(wage)
            if t == horizon:
                out.w10.append(wage)
                out.seg_y10[seg["key"]] += 1
                out.seg_w10[seg["key"]].append(wage)
                break

            # --- move, or stay and grow -------------------------------------
            if forced_move or rng.random() < seg["churn"]:
                forced_move = False
                ni = _place(rng, segs, attrs, years_infield, years_outfield,
                            cyc, com, fun, scratch)
                if ni != si:
                    si = ni
                    seg = segs[si]
                    target = _entry_wage(rng, seg, attrs, years_exp)
                    # you rarely accept a deep cut, and a move up is a raise
                    wage = max(0.85 * wage, target * gauss(1.0, 0.13))
                    growth = (seg["growth"] + G.SKILL_GROWTH_GAIN * attrs["skill"]
                              + gauss(0.0, seg["growth_sd"])
                              + 0.50 * cyc * seg["cycle"]
                              + 0.35 * com * seg["commodity"]
                              + 0.30 * fun * seg["funding"])
                    growth = _clamp(growth, -0.050, 0.220)
                    if seg["key"] in ("remote_luar", "pindah_luar"):
                        abroad = 1.0
                else:
                    wage *= (1.0 + growth)
            else:
                wage *= (1.0 + growth)

            cap = seg["ceiling"] * ceiling_mult
            if wage > cap:
                wage = cap + (wage - cap) * 0.25      # soft ceiling, not a wall
            if wage < 2.0:
                wage = 2.0
            if wage > peak:
                peak = wage

        out.cum.append(cum)
        out.peak.append(peak)
        out.years_infield_sum += years_infield
        out.unemployed_months_sum += unemployed_months
        if ever_unemployed:
            out.n_ever_unemployed += 1
        if abroad:
            out.n_abroad_ever += 1
        if seg["in_field"] == 1.0:
            out.n_infield_y10 += 1
        elif seg["in_field"] == 0.5:
            out.n_adjacent_y10 += 1
        else:
            out.n_left_y10 += 1
        for a in G.ATTRS:
            out.sens[a].add(attrs[a], cum)

    return out


def summarise(out):
    n = out.n
    w1 = sorted(out.w1)
    w5 = sorted(out.w5)
    w10 = sorted(out.w10)
    cum = sorted(out.cum)
    peak = sorted(out.peak)
    mean_cum = sum(cum) / n
    var = sum((x - mean_cum) ** 2 for x in cum) / (n - 1)
    sd = math.sqrt(var)
    return {
        "label": out.label,
        "n": n,
        "w1_p10": _pct(w1, 0.10), "w1_p50": _pct(w1, 0.50), "w1_p90": _pct(w1, 0.90),
        "w5_p10": _pct(w5, 0.10), "w5_p50": _pct(w5, 0.50), "w5_p90": _pct(w5, 0.90),
        "w10_p10": _pct(w10, 0.10), "w10_p25": _pct(w10, 0.25),
        "w10_p50": _pct(w10, 0.50), "w10_p75": _pct(w10, 0.75),
        "w10_p90": _pct(w10, 0.90), "w10_p99": _pct(w10, 0.99),
        "w10_mean": sum(w10) / n,
        "peak_p50": _pct(peak, 0.50),
        "cum_mean": mean_cum, "cum_se": sd / math.sqrt(n),
        "cum_p10": _pct(cum, 0.10), "cum_p50": _pct(cum, 0.50),
        "cum_p90": _pct(cum, 0.90),
        "p_w10_over20": sum(1 for x in w10 if x > 20.0) / n,
        "p_w10_over35": sum(1 for x in w10 if x > 35.0) / n,
        "p_w10_under8": sum(1 for x in w10 if x < 8.0) / n,
        "p_infield_y10": out.n_infield_y10 / n,
        "p_adjacent_y10": out.n_adjacent_y10 / n,
        "p_left_y10": out.n_left_y10 / n,
        "years_infield": out.years_infield_sum / n,
        "p_ever_unemployed": out.n_ever_unemployed / n,
        "unemployed_months": out.unemployed_months_sum / n,
        "p_abroad_ever": out.n_abroad_ever / n,
        "search_months": out.search_sum / n,
        "p_search_over_year": out.n_search_over_year / n,
        "seg_y1": {k: v / n for k, v in out.seg_y1.items()},
        "seg_y10": {k: v / n for k, v in out.seg_y10.items()},
        "sens": {a: m.r() for a, m in out.sens.items()},
        "fan": [
            None if not out.wy[t] else {
                "p10": _pct(sorted(out.wy[t]), 0.10),
                "p50": _pct(sorted(out.wy[t]), 0.50),
                "p90": _pct(sorted(out.wy[t]), 0.90),
            }
            for t in range(out.horizon + 1)
        ],
        "seg_w10": {
            k: (None if len(v) < 30 else {
                "n": len(v),
                "p10": _pct(sorted(v), 0.10),
                "p50": _pct(sorted(v), 0.50),
                "p90": _pct(sorted(v), 0.90),
            })
            for k, v in out.seg_w10.items()
        },
    }
