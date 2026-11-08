"""기획서용 도표 2장(PNG)."""
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker
from matplotlib import font_manager as fm
ROOT = Path(__file__).resolve().parent.parent
p = json.load(open(ROOT / "site/data/parking.json", encoding="utf-8"))
OUT = ROOT / "docs/figs"
fm.fontManager.addfont("/System/Library/Fonts/AppleSDGothicNeo.ttc")
plt.rcParams.update({"font.family": "Apple SD Gothic Neo", "font.size": 10, "axes.edgecolor": "#c9c8c2", "axes.labelcolor": "#56605a",
                     "xtick.color": "#56605a", "ytick.color": "#56605a", "axes.spines.top": False, "axes.spines.right": False})
INK, INK2, GRID, SURF = "#1d2320", "#56605a", "#e6e5e0", "#ffffff"
C = ["#2a78d6", "#eb6834", "#1baf7a"]
H = list(range(24))
wd = [p["by_weekday"][d] for d in "월화수목금"]
weekday = [sum(w["occupancy"][h] * w["days"] for w in wd) / sum(w["days"] for w in wd) for h in H]
normal = p["profiles"]["weekend_normal"]
sp = list(p["profiles"]["spike_days"].values())
spike = [sum(d["occupancy"][h] for d in sp) / len(sp) for h in H]

fig, ax = plt.subplots(figsize=(7.2, 3.4), dpi=200, facecolor=SURF)
ax.grid(axis="y", color=GRID, lw=0.8); ax.set_axisbelow(True)
ax.axhline(2800 * 0.6, color=INK2, lw=1, ls=(0, (4, 3)))
ax.text(0.3, 2800 * 0.6 + 40, "혼잡 기준(전체 2,800면의 60%)", color=INK2, fontsize=8.5)
for s, c, lab in [(weekday, C[0], "평일 평균(23일)"), (normal, C[1], "평소 주말(6일)"), (spike, C[2], "급증 주말(7/20·21)")]:
    ax.plot(H, s, color=c, lw=2, label=lab)
    pk = max(H, key=lambda h: s[h])
    ax.plot([pk], [s[pk]], "o", ms=5, color=c, mec=SURF, mew=1.5)
    ax.annotate(f"{lab.split('(')[0]} {pk}시 {round(s[pk]):,}대", (pk, s[pk]), xytext=(-20 if c == C[0] else 6, 10 if c == C[0] else 4), textcoords="offset points", fontsize=8.5, color=INK)
ax.set_xticks([0, 6, 9, 12, 15, 18, 21, 23]); ax.set_xticklabels([f"{h}시" for h in [0, 6, 9, 12, 15, 18, 21, 23]])
ax.set_ylim(0, 2400); ax.set_ylabel("주차 중 차량(대)")
ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{int(v):,}"))
ax.legend(frameon=False, fontsize=8.5, loc="upper left", ncol=3, bbox_to_anchor=(0, 1.12))
ax.set_title("2024년 7월 시각별 주차 중 차량 수 (입출차 215,528건)", loc="left", fontsize=10.5, color=INK, pad=24)
fig.tight_layout(); fig.savefig(OUT / "fig-hourly.png", facecolor=SURF); plt.close(fig)

mf = p["month_factor"]
fig, ax = plt.subplots(figsize=(7.2, 2.8), dpi=200, facecolor=SURF)
ax.grid(axis="y", color=GRID, lw=0.8); ax.set_axisbelow(True)
xs = list(range(1, 13)); ys = [1.0 if m == 7 else mf[str(m)] for m in xs]  # 앱과 같이 7월은 보정 없음
ax.bar(xs, ys, width=0.62, color=C[0], edgecolor=SURF, linewidth=1)
ax.axhline(1, color=INK2, lw=1, ls=(0, (4, 3)))
ax.text(7, 1.05, "기준", ha="center", fontsize=8.5, color=INK)
for m in (5, 10):
    ax.text(m, mf[str(m)] + 0.03, f"{mf[str(m)]:.2f}", ha="center", fontsize=8.5, color=INK)
ax.text(1, 0.86, f"{mf['1']:.2f}", ha="center", fontsize=8.5, color=SURF)
ax.set_xticks(xs); ax.set_xticklabels([f"{m}월" for m in xs]); ax.set_ylim(0, 1.9); ax.set_ylabel("보정 계수")
ax.set_title("방문 월 보정 계수 (월별주차현황 2023∼2025년 같은 달 평균 ÷ 2024년 7월 59,808대, 점선 = 1)", loc="left", fontsize=10.5, color=INK)
fig.tight_layout(); fig.savefig(OUT / "fig-month.png", facecolor=SURF); plt.close(fig)
print("ok", [round(max(weekday)), round(max(normal)), round(max(spike))])
