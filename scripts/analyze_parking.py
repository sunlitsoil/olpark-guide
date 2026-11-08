"""입출차(2024-07)·주차 혼잡도(2025-02~2026-08) 원자료에서 길잡이용 통계를 만든다."""
import csv, json, sys, collections, datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
U = ROOT / "data" / "utf8"
OUT = ROOT / "site" / "data"
OUT.mkdir(parents=True, exist_ok=True)
WD = "월화수목금토일"

def parse(s):
    return dt.datetime.strptime(s.strip(), "%Y-%m-%d %H:%M")

rows = list(csv.DictReader(open(U / "15138735.csv", encoding="utf-8")))
bad = 0
cars = []
for r in rows:
    try:
        a, b = parse(r["입차일시"]), parse(r["출차일시"])
    except Exception:
        bad += 1
        continue
    if b < a:
        bad += 1
        continue
    cars.append((a, b))

days = sorted({a.date() for a, _ in cars})
# 하루 매시 정각의 주차 중 차량 수(입차<=t<출차)
occ = {d: [0] * 24 for d in days}
arr = {d: [0] * 24 for d in days}
for a, b in cars:
    if a.date() in arr:
        arr[a.date()][a.hour] += 1
    for d in {a.date(), b.date()}:
        if d not in occ:
            continue
        for h in range(24):
            t = dt.datetime.combine(d, dt.time(h))
            if a <= t < b:
                occ[d][h] += 1

def avg(ds, table):
    return [round(sum(table[d][h] for d in ds) / len(ds), 1) for h in range(24)]


daily = sorted(((d.isoformat(), WD[d.weekday()], max(occ[d]), sum(arr[d])) for d in days), key=lambda x: -x[2])

# 주차 혼잡도 기록
cg = list(csv.DictReader(open(U / "15164156.csv", encoding="utf-8")))
zone = collections.defaultdict(lambda: collections.Counter())
zone_wd_hour = collections.defaultdict(lambda: collections.Counter())
for r in cg:
    try:
        d = dt.date.fromisoformat(r["등록일"])
        h = int(r["등록시간"][:2])
    except Exception:
        continue
    z = r["주차구역"].strip()
    zone[z][r["혼잡도"].strip()] += 1
    if r["혼잡도"].strip() == "만차":
        zone_wd_hour[z][(WD[d.weekday()], h)] += 1
zones = {z: {"counts": dict(c), "full_top": [f"{k[0]} {k[1]}시" for k, _ in zone_wd_hour[z].most_common(3)]} for z, c in sorted(zone.items())}

def median(xs):
    xs = sorted(xs); n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2

wk_days = [d for d in days if d.weekday() >= 5]
wk_med = median([max(occ[x]) for x in wk_days])
spike = [d for d in wk_days if max(occ[d]) >= 1.5 * wk_med]
# 민감도: 기준 배수를 바꿔도 급증 주말이 같은지
sens = {str(k): [d.isoformat() for d in wk_days if max(occ[d]) >= k * wk_med] for k in (1.3, 1.5, 1.7)}

# 요일별 평소 값. 토·일은 급증 주말을 뺀다(급증 주말은 profiles.spike_days로 따로 둔다)
by_wd = {}
for i, name in enumerate(WD):
    ds = [d for d in days if d.weekday() == i and d not in spike]
    by_wd[name] = {"days": len(ds), "occupancy": avg(ds, occ), "arrivals": avg(ds, arr)}
peak_all = max(max(v["occupancy"]) for v in by_wd.values())

profiles = {
    "spike_rule": "주말 하루 최대 주차 대수가 주말 중앙값의 1.5배 이상",
    "spike_sensitivity": sens,
    "weekend_median_peak": wk_med,
    "weekday_median_peak": median([max(occ[d]) for d in days if d.weekday() < 5]),
    "spike_days": {d.isoformat(): {"weekday": WD[d.weekday()], "occupancy": occ[d], "arrivals": arr[d]} for d in spike},
    "weekend_normal": avg([d for d in wk_days if d not in spike], occ),
}

# 월별주차현황(2023~2025, 올림픽공원)으로 방문 월 보정 계수를 만든다.
# 입출차 시각 분포는 2024-07 한 달뿐이므로, 같은 하루 모양에 월별 수요 크기만 곱한다.
mon = collections.defaultdict(list)
base = None
for r in csv.DictReader(open(U / "15131671.csv", encoding="utf-8")):
    if r["주차장소"].strip() != "올림픽공원":
        continue
    m = int(r["월"].strip().rstrip("월"))
    v = int(r["주차대수"])
    mon[m].append(v)
    if r["연도"].strip() == "2024" and m == 7:
        base = v
month_factor = {str(m): round(sum(v) / len(v) / base, 2) for m, v in sorted(mon.items())}

out = {
    "profiles": profiles,
    "month_factor": month_factor,
    "month_base": {"year": 2024, "month": 7, "cars": base, "years": sorted({int(r["연도"]) for r in csv.DictReader(open(U / "15131671.csv", encoding="utf-8"))})},
    "source": {
        "inout": "한국체육산업개발주식회사_올림픽공원 입출차 정보_20240731 (data.go.kr/data/15138735)",
        "congestion": "한국체육산업개발주식회사_주차장 혼잡도 정보_20260812 (data.go.kr/data/15164156)",
        "period_inout": [days[0].isoformat(), days[-1].isoformat()],
        "rows_inout": len(rows), "rows_used": len(cars), "rows_dropped": bad,
        "rows_congestion": len(cg),
    },
    "peak_occupancy": peak_all,
    "by_weekday": by_wd,
    "busiest_days": daily[:5],
    "quietest_days": daily[-3:],
    "zones": zones,
}
json.dump(out, open(OUT / "parking.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps({k: out[k] for k in ["source", "peak_occupancy", "busiest_days", "quietest_days"]}, ensure_ascii=False, indent=1))
print("주말 최대 중앙값", profiles["weekend_median_peak"], "평일", profiles["weekday_median_peak"], "급증일", list(profiles["spike_days"]))
for d, v in profiles["spike_days"].items():
    print(d, "시간대별", v["occupancy"][12:23])
print("평소 주말", profiles["weekend_normal"][12:23])
for k, v in by_wd.items():
    print(k, v["days"], "최대", max(v["occupancy"]), "시각", v["occupancy"].index(max(v["occupancy"])), "일평균입차", round(sum(v["arrivals"])))
for z, v in zones.items():
    print(z, v)
print("월 보정 계수(2024-07 기준)", month_factor)
