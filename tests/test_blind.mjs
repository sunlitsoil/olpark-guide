// 별칭을 보지 않은 별도 에이전트(Claude Sonnet)가 FAQ만 읽고 쓴 30문항. 2026-11-08 한 번 채점했고 이 결과로 규칙을 고치지 않았다.
import { readFileSync } from "node:fs";
import { buildIndex, search } from "../site/search.js";
const rd = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const faq = rd("../site/data/faq.json"), aliases = rd("../site/data/aliases.json").items, qs = rd("./blind/questions.json");
for (const [name, idx] of [["별칭 없이", buildIndex(faq.items)], ["별칭 포함", buildIndex(faq.items, aliases)]]) {
  let p1 = 0, p3 = 0; const miss = [];
  for (const { q, id } of qs) {
    const top = search(idx, q, 3).map((h) => h.item.id);
    p1 += top[0] === id; p3 += top.includes(id);
    if (top[0] !== id) miss.push(`${q} → 1위 ${top[0] ?? "없음"} (정답 ${id}${top.includes(id) ? ", 3위 안" : ""})`);
  }
  console.log(`${name}: 1위 ${p1}/${qs.length}, 3위 안 ${p3}/${qs.length}`);
  if (name === "별칭 포함") miss.forEach((m) => console.log("  놓침:", m));
}
