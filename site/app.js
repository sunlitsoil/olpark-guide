import { WEEKDAYS, CAPACITY, buildIndex, search, isParkingQuestion, forecast, fee } from "./search.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const [faq, parking, events, aliases] = await Promise.all(
  ["data/faq.json", "data/parking.json", "data/events.json", "data/aliases.json"].map((u) => fetch(u).then((r) => r.json()))
);
const index = buildIndex(faq.items, aliases.items);

// 질문에 요일·시각이 있으면 예보 칸에 반영한다
function readWhen(q) {
  const wd = WEEKDAYS.find((d) => q.includes(d + "요일")) || (/주말/.test(q) ? "토" : null);
  let hr = null;
  const m = q.match(/(\d{1,2})\s*시/);
  if (m) hr = Number(m[1]);
  if (hr !== null && /오후|저녁|밤/.test(q) && hr < 12) hr += 12;
  if (hr === null && /저녁/.test(q)) hr = 18;
  if (hr === null && /오후/.test(q)) hr = 14;
  if (hr === null && /아침|오전/.test(q)) hr = 10;
  const mm = q.match(/(1[0-2]|[1-9])\s*월/);
  return { wd, hr, mo: mm ? Number(mm[1]) : null };
}

function renderAnswer(q) {
  const hits = search(index, q, 3);
  const out = [];
  if (isParkingQuestion(q)) {
    const w = readWhen(q);
    if (w.wd) $("#wd").value = w.wd;
    if (w.mo) $("#mo").value = String(w.mo);
    if (w.hr !== null) $("#hr").value = String(Math.min(23, Math.max(0, w.hr)));
    if (/공연|콘서트|행사|페스티벌/.test(q) && ["토", "일"].includes($("#wd").value)) $("#ev").checked = true;
    updateForecast();
    out.push(`<p class="hint">주차가 걸린 질문이라 아래 <a href="#park-h">주차 예보</a>를 질문에 맞춰 바꿔 두었습니다.</p>`);
  }
  if (!hits.length) {
    out.push(`<p class="empty">FAQ 49건에서 맞는 답을 찾지 못했습니다. 단어를 바꿔 다시 물어보거나 올림픽공원 고객안내(평화의 광장 02-2180-3564∼5)에 문의하세요.</p>`);
  } else {
    out.push(`<ol class="hits">` + hits.map((h, i) => `
      <li>
        <p class="q">${esc(h.item.q)}</p>
        <p class="a">${esc(h.item.a)}</p>
        <p class="src">근거: 자주 묻는 질문정보 일련번호 ${esc(h.item.id)} · ${esc(h.item.category)} · 등록 ${esc(h.item.date)}${i === 0 ? "" : " · 함께 볼 답"}</p>
      </li>`).join("") + `</ol>`);
  }
  $("#answer").innerHTML = out.join("");
}

function updateForecast() {
  const wd = $("#wd").value, hr = Number($("#hr").value), ev = $("#ev").checked, mo = Number($("#mo").value);
  const f = forecast(parking, wd, hr, ev, mo);
  const pct = Math.round(f.ratio * 100);
  const zones = f.zonesOften.length
    ? `혼잡도 기록에서 ${wd}요일에 만차가 잦았던 구역: ${f.zonesOften.map((z) => `${esc(z.z)}(만차 ${z.full}/${z.total}회)`).join(", ")}.`
    : "";
  const advice = f.level === "혼잡"
    ? "공연장 가까운 구역부터 먼저 찹니다. 대중교통(5·9호선 올림픽공원역, 8호선 몽촌토성역)을 권합니다."
    : f.level === "보통"
      ? "자리는 있지만 공연 직전에는 붐빕니다. FAQ 안내대로 1시간가량 여유를 두세요."
      : "비교적 여유로운 시간대입니다.";
  $("#forecast").innerHTML = `
    <p class="level level-${f.level}"><strong>${f.level}</strong> — ${mo}월 ${wd}요일 ${hr}시 주차 중 약 ${f.cars.toLocaleString()}대 (전체 약 ${CAPACITY.toLocaleString()}대의 ${pct}%)</p>
    ${f.over ? `<p class="warn-full">추정치가 전체 면수를 넘습니다. 이 시간대에는 주차장에 들어가지 못할 수 있습니다.</p>` : ""}
    <p>${advice} ${f.peakHour !== hr ? `이후 3시간 안에는 ${f.peakHour}시가 가장 붐빕니다(약 ${f.peakCars.toLocaleString()}대).` : ""}</p>
    <p class="note">${esc(f.basis)} 기준 추정. ${zones}</p>`;
  drawChart(f.series, hr);
}

function drawChart(s, hr) {
  const c = $("#chart"), g = c.getContext("2d");
  const W = c.width, H = c.height, pad = { l: 44, r: 12, t: 12, b: 26 };
  g.clearRect(0, 0, W, H);
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue("--ink-2").trim(), line = css.getPropertyValue("--line").trim(), acc = css.getPropertyValue("--accent").trim();
  const max = Math.max(2400, Math.ceil(Math.max(...s) / 800) * 800), x = (h) => pad.l + ((W - pad.l - pad.r) * h) / 23, y = (v) => H - pad.b - ((H - pad.t - pad.b) * v) / max;
  g.font = "12px system-ui, sans-serif"; g.fillStyle = ink; g.strokeStyle = line; g.lineWidth = 1;
  for (let v = 0; v <= max; v += 800) { g.beginPath(); g.moveTo(pad.l, y(v)); g.lineTo(W - pad.r, y(v)); g.stroke(); g.fillText(v.toLocaleString(), 4, y(v) + 4); }
  for (const h of [0, 6, 12, 18, 23]) g.fillText(h + "시", Math.min(x(h) - 8, W - pad.r - 26), H - 8);
  // 전체 면수 기준선
  g.setLineDash([4, 4]); g.beginPath(); g.moveTo(pad.l, y(CAPACITY * 0.6)); g.lineTo(W - pad.r, y(CAPACITY * 0.6)); g.stroke(); g.setLineDash([]);
  g.fillText("혼잡 기준(60%)", W - pad.r - 92, y(CAPACITY * 0.6) - 6);
  g.strokeStyle = acc; g.lineWidth = 2.5; g.beginPath();
  s.forEach((v, h) => (h ? g.lineTo(x(h), y(v)) : g.moveTo(x(h), y(v)))); g.stroke();
  g.fillStyle = acc; g.beginPath(); g.arc(x(hr), y(s[hr]), 5, 0, Math.PI * 2); g.fill();
}

function updateFee() {
  const won = fee(Number($("#stay").value), Number($("#disc").value));
  $("#fee-out").textContent = `예상 요금 약 ${won.toLocaleString()}원`;
}

// 초기화
WEEKDAYS.forEach((d) => $("#wd").insertAdjacentHTML("beforeend", `<option>${d}</option>`));
for (let h = 6; h <= 23; h++) $("#hr").insertAdjacentHTML("beforeend", `<option value="${h}">${h}시</option>`);
const now = new Date();
$("#wd").value = WEEKDAYS[(now.getDay() + 6) % 7];
for (let m = 1; m <= 12; m++) $("#mo").insertAdjacentHTML("beforeend", `<option value="${m}">${m}월</option>`);
$("#mo").value = String(now.getMonth() + 1);
$("#hr").value = String(Math.min(23, Math.max(6, now.getHours())));
["#mo", "#wd", "#hr", "#ev"].forEach((s) => $(s).addEventListener("change", updateForecast));
["#stay", "#disc"].forEach((s) => $(s).addEventListener("change", updateFee));
$("#ask-form").addEventListener("submit", (e) => { e.preventDefault(); renderAnswer($("#q").value); });
document.querySelectorAll(".examples button").forEach((b) => b.addEventListener("click", () => { $("#q").value = b.dataset.q; renderAnswer(b.dataset.q); }));
updateForecast(); updateFee();

$("#ev-note").textContent = `영문 공연정보 ${events.items.length}건 중 '공연일자' 열 기준 최근 12건. 같은 날짜에 여러 공연이 묶인 경우가 있어 실제 공연일과 다를 수 있으니 예매 페이지에서 일정을 확인하세요. 이 목록은 주차 예보 계산에 넣지 않았습니다.`;
$("#ev-list").innerHTML = events.items.slice(0, 12).map((e) =>
  `<li><span class="d">${esc(e.date)}</span> <a href="${esc(e.link)}" target="_blank" rel="noopener">${esc(e.title)}</a></li>`).join("");
