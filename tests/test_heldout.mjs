// 2026-11-08 보강 뒤에 새로 쓴 10문항. 결과를 보고 검색 규칙을 고치지 않는다(튜닝에 쓰지 않은 확인용).
import { readFileSync } from "node:fs";
import { buildIndex, search } from "../site/search.js";
const faq = JSON.parse(readFileSync(new URL("../site/data/faq.json", import.meta.url)));
const aliases = JSON.parse(readFileSync(new URL("../site/data/aliases.json", import.meta.url))).items;
const idx = buildIndex(faq.items, aliases);
const cases = [
  ["공원 안에서 자전거 타도 되나요?", /자전거/],
  ["아이들 단체로 소풍 가려는데 미리 신청해야 하나요", /소풍/],
  ["공원에서 영상 찍으려면 허락 받아야 해요?", /촬영/],
  ["공연장 여자 화장실 너무 부족해요", /여자화장실/],
  ["밤에 공원 들어갈 수 있어요?", /이용시간/],
  ["미사경정공원에서 고기 구워 먹어도 돼요?", /취사/],
  ["공연 끝나고 주차장 빠져나가는 데 얼마나 걸려요?", /주차 예상 소요 시간/],
  ["주차하고 공연장까지 멀어요?", /주차 후 공연장까지/],
  ["장미광장 쉬는 날 있어요?", /휴장일/],
  ["쓰레기 버릴 데가 없어요", /쓰레기통/],
];
let p1 = 0, p3 = 0;
for (const [q, re] of cases) {
  const top = search(idx, q, 3);
  const ok = top.length && re.test(top[0].item.q); p1 += !!ok; p3 += top.some((h) => re.test(h.item.q));
  console.log(ok ? "PASS" : "FAIL", q, "→", top.map((h) => h.item.q).join(" / ") || "(답 없음)");
}
console.log(`새 10문항: 1위 ${p1}/10, 3위 안 ${p3}/10`);
