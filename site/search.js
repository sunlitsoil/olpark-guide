// 올팍 길잡이 — 검색·예보 로직 (브라우저와 Node 테스트가 함께 쓴다)

export const CAPACITY = 2800; // FAQ 「올림픽공원 내 주차시설은 어떻게 되나요」: 2800여대
export const FEE_PER_10MIN = 600; // FAQ 「주차장 이용 및 요금은 어떻게 되나요」: 일반승용차 10분당 600원
export const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

const SYNONYMS = [
  [/강아지|애완견|애완동물|댕댕이|펫/g, " 반려견 애완동물 "],
  [/자차|자가용|차 ?가져|차를 가져|운전|차량|차 ?끌고/g, " 주차 "],
  [/지하철|버스|전철|대중교통/g, " 대중교통 지하철 버스 "],
  [/몇 ?시(?! ?까지)|언제 ?열|여는 ?시간|개방/g, " 이용시간 개방 "],
  [/잃어버|분실|두고 ?왔/g, " 분실 소지품 "],
  [/요금|얼마|비용/g, " 요금 "],
  [/펴|피었|피나|피는|개화|만개/g, " 만개 개화 "],
  [/열어|열려|여나요|문 ?열/g, " 이용시간 "],
  // 2026-11-08 추가 문항 첫 실행에서 놓친 말
  [/물 ?마실|마실 ?물|식수|목말/g, " 음수대 "],
  [/주차비|주차료/g, " 주차요금 요금 "],
  [/깎|할인|싸게/g, " 요금 차이 "],
  [/어디 ?있|어디에 ?있|어디야|어딨/g, " 위치 어디 "],
  [/몇 ?시 ?까지|언제까지|마감/g, " 운영시간 "],
  [/돈 ?내|돈 ?들|입장료|공짜|무료/g, " 입장료 "],
];

const PARKING_INTENT = /주차|만차|자차|자가용|차 ?가져|차를 가져|운전|차량|차 ?끌고/;

export function normalize(text) {
  let t = (text || "").toLowerCase();
  for (const [re, rep] of SYNONYMS) t = t.replace(re, (m) => m + rep);
  return t.replace(/[^0-9a-z가-힣\s]/g, " ");
}

// 질문 끝말·조사처럼 어느 FAQ에나 붙는 두 글자는 점수에서 뺀다
const STOP = new Set(["가는", "방법", "어떻", "떻게", "게되", "되나", "나요", "있나", "어요", "해요", "인가", "까요", "될까", "싶습", "습니", "니다", "에서", "하는", "려고", "는데"]);

export function tokens(text) {
  const out = [];
  for (const word of normalize(text).split(/\s+/)) {
    if (word.length < 2) continue;
    for (let i = 0; i < word.length - 1; i++) {
      const bg = word.slice(i, i + 2);
      if (!STOP.has(bg)) out.push(bg);
    }
  }
  return out;
}

// aliases: { FAQ 일련번호: [방문객 말투 별칭, ...] } — 검색에만 쓰고 화면에는 FAQ 원문만 보인다
export function buildIndex(items, aliases = {}) {
  const docs = items.map((it) => {
    const tf = new Map();
    // 질문 제목은 세 번, 별칭은 두 번 넣어 가중치를 준다
    const al = (aliases[it.id] || []).join(" ");
    for (const tk of [...tokens(it.q), ...tokens(it.q), ...tokens(it.q), ...tokens(al), ...tokens(al), ...tokens(it.a)]) tf.set(tk, (tf.get(tk) || 0) + 1);
    let len = 0;
    for (const v of tf.values()) len += v;
    return { it, tf, len };
  });
  const df = new Map();
  for (const d of docs) for (const tk of d.tf.keys()) df.set(tk, (df.get(tk) || 0) + 1);
  const avgLen = docs.reduce((s, d) => s + d.len, 0) / Math.max(docs.length, 1);
  return { docs, df, avgLen, n: docs.length };
}

export function search(index, query, k = 3) {
  const q = [...new Set(tokens(query))];
  const k1 = 1.2, b = 0.75;
  const scored = index.docs.map((d) => {
    let s = 0;
    for (const tk of q) {
      const f = d.tf.get(tk);
      if (!f) continue;
      const n = index.df.get(tk);
      const idf = Math.log(1 + (index.n - n + 0.5) / (n + 0.5));
      s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / index.avgLen));
    }
    // 올림픽공원 안내가 기본이다. 질문에 '미사'가 없으면 미사경정공원 답을 뒤로 보낸다
    if (!/미사/.test(query) && /미사/.test(d.it.q)) s *= 0.5;
    // 장미광장은 공원 안 한 구역이다. 질문에 '장미'가 없으면 공원 전체 답을 앞에 둔다
    if (!/장미/.test(query) && /장미/.test(d.it.q)) s *= 0.6;
    // 주차가 걸린 질문이면 주차 FAQ를 앞에 둔다
    if (PARKING_INTENT.test(query) && /주차/.test(d.it.q)) s *= 2;
    return { item: d.it, score: s };
  });
  return scored.filter((x) => x.score > 0).sort((a, b2) => b2.score - a.score).slice(0, k);
}

export function isParkingQuestion(query) {
  return PARKING_INTENT.test(query || "");
}

export function level(ratio) {
  // 2024-07 평일 최대 약 35%, 평소 주말 최대 약 44%, 급증 주말 최대 약 78% 사이를 가르는 값
  if (ratio >= 0.6) return "혼잡";
  if (ratio >= 0.4) return "보통";
  return "여유";
}

// parking: analyze_parking.py가 만든 parking.json
// month: 방문 월(1~12). 없으면 보정하지 않는다(2024년 7월 그대로).
export function monthFactor(parking, month) {
  if (!month || !parking.month_factor) return 1;
  // 계수는 월별주차현황 3년 평균 ÷ 2024년 7월. 7월이면 2024년 7월 기록 그대로 쓴다.
  return Number(month) === 7 ? 1 : parking.month_factor[String(month)] || 1;
}

function hourly(parking, weekday, eventDay, f) {
  const base = parking.by_weekday[weekday].occupancy.map((v) => v * f);
  if (!(eventDay && (weekday === "토" || weekday === "일"))) return base;
  const spikes = Object.values(parking.profiles.spike_days);
  // 행사 주말은 2024년 7월 급증일 평균과 월 보정한 평소 값 중 큰 쪽을 쓴다
  return base.map((v, h) => Math.max(v, spikes.reduce((s, d) => s + d.occupancy[h], 0) / spikes.length));
}

export function forecast(parking, weekday, hour, eventDay = false, month = null) {
  const wd = parking.by_weekday[weekday];
  if (!wd) return null;
  const f = monthFactor(parking, month);
  const ev = eventDay && (weekday === "토" || weekday === "일");
  const s = hourly(parking, weekday, eventDay, f);
  const cars = s[hour];
  let basis = ev
    ? `2024년 7월 차가 몰린 주말(하루 최대가 주말 중앙값의 1.5배 이상) ${Object.keys(parking.profiles.spike_days).length}일 평균`
    : `2024년 7월 ${weekday}요일 ${wd.days}일 평균`;
  const fx = `${month}월 보정 ×${f.toFixed(2)}(월별주차현황 2023∼2025년 ${month}월 평균 ÷ 2024년 7월)`;
  if (f !== 1) basis = ev
    ? `${basis}과, 평소 ${weekday}요일 값에 ${fx}을 곱한 값 중 큰 쪽`
    : `${basis}에 ${fx}`;
  const ratio = cars / CAPACITY;
  // 이 시각 이후 3시간 안에 가장 붐비는 시각
  let peakHour = hour, peakCars = cars;
  for (let h = hour; h <= Math.min(23, hour + 3); h++) if (s[h] > peakCars) { peakCars = s[h]; peakHour = h; }
  const zonesOften = Object.entries(parking.zones)
    .map(([z, v]) => ({ z, full: v.counts["만차"] || 0, total: Object.values(v.counts).reduce((a, x) => a + x, 0), top: v.full_top }))
    .filter((x) => x.top.some((t) => t.startsWith(weekday)))
    .sort((a, b2) => b2.full / b2.total - a.full / a.total)
    .slice(0, 3);
  return {
    cars: Math.round(cars),
    ratio,
    level: level(ratio),
    over: ratio >= 1,
    factor: f,
    basis,
    peakHour,
    peakCars: Math.round(peakCars),
    series: s,
    zonesOften,
  };
}

export function fee(minutes, discount = 0) {
  const units = Math.ceil(Math.max(0, minutes) / 10);
  return Math.round(units * FEE_PER_10MIN * (1 - discount));
}
