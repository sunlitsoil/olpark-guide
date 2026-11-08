import { readFileSync } from "node:fs";
import { buildIndex, search, isParkingQuestion, forecast, fee } from "../site/search.js";
const faq = JSON.parse(readFileSync(new URL("../site/data/faq.json", import.meta.url)));
const parking = JSON.parse(readFileSync(new URL("../site/data/parking.json", import.meta.url)));
const aliases = JSON.parse(readFileSync(new URL("../site/data/aliases.json", import.meta.url))).items;
const idx = buildIndex(faq.items, aliases);
const cases = [
  ["강아지 데리고 들어가도 되나요?", /반려견|애완동물/],
  ["공연 보고 지갑을 잃어버렸어요", /분실/],
  ["지하철로 가는 방법", /올림픽공원 이용시 대중교통/],
  ["미사경정공원 지하철로 가는 법", /미사경정공원에 찾아가는/],
  ["주차요금 얼마예요", /요금/],
  ["공원 몇 시에 열어요?", /올림픽공원 이용시간/],
  ["드론 날려도 돼요?", /드론/],
  ["토요일 저녁 공연 보러 차 가져가도 될까요?", /주차/],
  ["화장실 어디 있어요", /화장실/],
  ["장미 언제 펴요", /장미꽃은 언제 만개/],
  // 2026-11-08 추가: FAQ 제목과 다른 평소 말투 10문항
  ["공원에서 담배 피워도 돼요?", /금연/],
  ["물 마실 곳 있어요?", /음수대/],
  ["분수 언제 틀어요?", /분수/],
  ["휠체어 탄 사람은 어디에 주차해요?", /휠체어/],
  ["주차장이 어디 있어요?", /주차장의 위치/],
  ["반창고 살 수 있는 곳 있나요?", /구급약품/],
  ["매점 몇 시까지 해요?", /매점 운영시간/],
  ["미사경정공원 들어가는데 돈 내요?", /입장료/],
  ["공연 보면 주차비 깎아 주나요?", /공연 관람 시와 비관람 시/],
  ["자전거 빌려주는 데 있어요?", /자전거/],
];
let pass = 0, in3 = 0;
for (const [q, re] of cases) {
  const top = search(idx, q, 3);
  const ok = top.length > 0 && re.test(top[0].item.q);
  pass += ok;
  in3 += top.some((h) => re.test(h.item.q));
  console.log(ok ? "PASS" : "FAIL", q, "→", top.map((h) => h.item.q).join(" / "));
}
console.log(`검색 1위 적중 ${pass}/${cases.length}, 3위 안 포함 ${in3}/${cases.length}`);
const checks = [
  isParkingQuestion("토요일 저녁 공연 보러 차 가져가도 될까요?") === true,
  isParkingQuestion("강아지 데리고 가도 되나요") === false,
  fee(180) === 10800, fee(185) === 11400, fee(180, 0.5) === 5400,
];
console.log("의도·요금", checks.every(Boolean) ? "PASS" : "FAIL", checks);
for (const [wd, h, ev] of [["토", 17, false], ["토", 17, true], ["화", 11, false], ["일", 9, false]]) {
  const f = forecast(parking, wd, h, ev);
  console.log("예보", wd, h, ev ? "행사" : "평소", f.level, f.cars, Math.round(f.ratio * 100) + "%", "정점", f.peakHour, f.zonesOften.map((z) => z.z).join(","));
}
// 월 보정: 7월은 보정 없음, 10월은 계수만큼 커지고, 행사 주말은 급증일 평균보다 작아지지 않는다
const m7 = forecast(parking, "토", 17, false, 7), m10 = forecast(parking, "토", 17, false, 10), e10 = forecast(parking, "토", 17, true, 10), e7 = forecast(parking, "토", 17, true, 7);
const monthOk = m7.cars === forecast(parking, "토", 17, false).cars
  && Math.abs(m10.cars - m7.cars * parking.month_factor["10"]) <= 1
  && e10.cars >= e7.cars && e10.cars >= m10.cars;
console.log("월 보정", monthOk ? "PASS" : "FAIL", "토17 7월", m7.cars, "10월", m10.cars, m10.level, "10월 행사", e10.cars, e10.level, e10.over ? "면수 초과" : "");
checks.push(monthOk);
// 통과 기준: 전부 3위 안, 1위 적중 80% 이상
process.exit(in3 === cases.length && pass >= Math.ceil(cases.length * 0.8) && checks.every(Boolean) ? 0 : 1);
