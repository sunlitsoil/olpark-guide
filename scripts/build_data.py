"""FAQ·영문 공연정보 원자료를 길잡이 화면용 JSON으로 바꾼다."""
import csv, json, html, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
U = ROOT / "data" / "utf8"
OUT = ROOT / "site" / "data"
OUT.mkdir(parents=True, exist_ok=True)

def clean(s):
    return re.sub(r"\s+", " ", html.unescape(s or "")).strip()

faq = []
for r in csv.DictReader(open(U / "15089962.csv", encoding="utf-8")):
    faq.append({
        "id": clean(r["일련번호"]),
        "category": clean(r["카테고리"]),
        "q": clean(r["제목"]),
        "a": clean(r["내용"]),
        "date": clean(r["등록일"]),
    })

events = []
for r in csv.DictReader(open(U / "15149169.csv", encoding="utf-8")):
    events.append({
        "id": clean(r["일련번호"]),
        "title": clean(r["공연제목"]),
        "date": clean(r["공연일자"]),
        "link": clean(r["상세주소"]),
    })
events.sort(key=lambda e: e["date"], reverse=True)

meta = {
    "faq_source": "한국체육산업개발주식회사_자주 묻는 질문정보_20260819 (data.go.kr/data/15089962)",
    "event_source": "한국체육산업개발주식회사_영문 공연정보_20260901 (data.go.kr/data/15149169)",
    "event_date_note": "원자료 '공연일자' 열을 그대로 표시한다. 여러 공연이 같은 날짜로 묶인 경우가 있어 실제 공연일인지 등록일인지 기관 확인이 필요하다.",
}
json.dump({"meta": meta, "items": faq}, open(OUT / "faq.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump({"meta": meta, "items": events}, open(OUT / "events.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("faq", len(faq), "events", len(events), "latest", events[0]["date"], events[0]["title"])
