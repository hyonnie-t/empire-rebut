/* 주제34 「제국주의자에게 반박하기」 — 로직(app.js)
 * 화면 순서: 시작 → 고르기(비판할 대상 9장: 166쪽 주장 6 + 박람회 3) → 뜯어보기(형광펜 + 위·아래·기준 빈칸)
 *          → 근거(166~169쪽 어디서든 자료 하나 + 문장 1~2개) → 쓰기(①②) → 마무리(복사·패들렛·제출)
 * 문구·원문은 data.js. 2026-11-03 효니 피드백으로 «박람회=근거» 구조에서 «박람회도 비판 대상»으로 바꿈. */
const CONFIG = {
  SHEET_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbyXSjCfWY_HiZFqW_OBR-FQDoIfF1z_STqyKWUI31MacHeY3u7hbirFSFDvW-5yuUHaJQ/exec",
  /* 포털 커리큘럼 관리에 이 id 하나로 활동을 등록한다 */
  GAME_NAME: "34차시_제국주의_반박글"
};

const S = {
  sid: "", name: "", grade: 0, ban: 0, preview: false, screen: "s1",
  target: "", marks: [], ev: "", quote: [],
  copied: false, sending: false, submitted: false, padletUrl: ""
};

const SCREEN_STAGE = { s1: "pick", s2: "open", s3: "ev", s4: "write", s5: "wrap" };
const STAGES = ["pick", "open", "ev", "write", "wrap"];
const SAVE_KEYS = ["screen", "target", "marks", "ev", "quote"];
const FRAME_IDS = ["f1", "f2", "f3"];

const $ = id => document.getElementById(id);
const byId = (arr, id) => arr.find(x => x.id === id);
const val = id => $(id).value.trim();
const parts = s => s.split("|");
const plain = s => s.replace(/\|/g, "");
/* 교사 미리보기(?preview=1)에서는 필수 활동을 안 해도 다음으로 넘어간다(효니 2026-10-29). 학생 화면은 그대로. */
const skip = () => S.preview;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function parseSid(sid) {
  if (!/^\d{5}$/.test(sid)) return null;
  return { grade: Number(sid[0]), ban: Number(sid.slice(1, 3)), num: Number(sid.slice(3)) };
}

/* ── 진행 기억: 새로고침해도 이어서. 학번별 키라 공용 태블릿에서 안 섞인다. 글 칸은 draft_guard가 맡는다. ── */
function storeKey() { return "empire_rebut:" + CONFIG.GAME_NAME + ":" + S.sid; }

function save() {
  if (S.preview || !S.sid || S.submitted) return; // 제출 뒤에는 다시 저장하지 않는다(새로고침해 빈 글로 다시 내는 것 방지)
  const v = { ts: Date.now() };
  SAVE_KEYS.forEach(k => { v[k] = S[k]; });
  try { localStorage.setItem(storeKey(), JSON.stringify(v)); } catch (e) { /* 저장소가 막히면 메모리만 */ }
}

function load() {
  if (S.preview) return;
  try {
    const v = JSON.parse(localStorage.getItem(storeKey()) || "null");
    if (!v || Date.now() - (v.ts || 0) > 7 * 864e5) return;
    SAVE_KEYS.forEach(k => { if (v[k] !== undefined) S[k] = v[k]; });
    if (S.target && !byId(TARGETS, S.target)) { S.target = ""; S.marks = []; } // 옛 판(주장 id 체계) 기록은 버린다
  } catch (e) { /* 무시 */ }
}

function clearSave() {
  try { localStorage.removeItem(storeKey()); } catch (e) { /* 무시 */ }
}

/* ── 시트 전송 ── */
async function postToSheet(payload) {
  if (S.preview) return { result: "success", preview: true };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  let json;
  try {
    const res = await fetch(CONFIG.SHEET_WEBAPP_URL, { method: "POST", body: JSON.stringify(payload), signal: ctl.signal });
    json = await res.json();
  } finally {
    clearTimeout(timer);
  }
  if (json.result !== "success") {
    const err = new Error(json.message || "저장 실패");
    err.locked = !!json.locked;
    throw err;
  }
  return json;
}

/* 패들렛 링크는 백엔드 학년정보(포트폴리오)에서 가져온다. 반 정보가 든 링크라 레포에 적지 않는다. */
function ensureUrlScheme(u) {
  u = String(u || "").trim();
  return u && !/^https?:\/\//i.test(u) ? "https://" + u : u;
}

async function loadPadletUrl(grade, ban) {
  try {
    const res = await fetch(CONFIG.SHEET_WEBAPP_URL + "?mode=curriculum");
    const json = await res.json();
    const pf = json && json.grades && json.grades[String(grade)] && json.grades[String(grade)].portfolio;
    if (!pf) return "";
    return ensureUrlScheme(pf.urlByBan ? (pf.urlByBan[ban] || pf.urlByBan[String(ban)] || "") : (pf.url || ""));
  } catch (e) {
    return "";
  }
}

/* ── 공용: 버튼 대신 role=radio/checkbox div — 버튼 안은 glossary.js가 밑줄을 못 긋는다.
 *    밑줄 낱말(.term)을 누르거나 그 위에서 Enter를 치면 풀이만 열고 고르기는 하지 않는다. ── */
function pickable(node, role, checked, onPick) {
  node.setAttribute("role", role);
  node.tabIndex = 0;
  node.setAttribute("aria-checked", checked ? "true" : "false");
  node.addEventListener("click", e => { if (e.target.closest && e.target.closest(".term")) return; onPick(); });
  node.addEventListener("keydown", e => { if (e.target !== node) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } });
  return node;
}

let riseObs = null;
function rise(node) {
  if (!riseObs) return node;
  node.classList.add("rise");
  riseObs.observe(node);
  return node;
}

/* 그림 + 출처 한 줄 */
function figure(img, cls) {
  const f = el("figure", "fig" + (cls ? " " + cls : ""));
  const i = el("img");
  i.src = img.src; i.alt = img.alt; i.loading = "lazy";
  f.appendChild(i);
  f.appendChild(el("figcaption", "credit", img.credit));
  return f;
}

/* 사진 설명 카드(본문 카드와 따로) */
function captionCard(c) {
  const d = el("div", "cap");
  const h = el("span", "cap-head");
  h.appendChild(el("span", "cap-tag", "사진 설명"));
  h.appendChild(document.createTextNode(c.head));
  d.appendChild(h);
  d.appendChild(el("span", "", c.text));
  if (c.img) d.appendChild(figure(c.img));
  return d;
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.tm);
  toast.tm = setTimeout(() => { t.hidden = true; }, 2200);
}

const targetObj = () => byId(TARGETS, S.target);
const frameOf = t => FRAMES[(t && t.frame) || "rank"];
const SOURCES_ALL = () => [REFERENCE].concat(TARGETS); // 근거는 166~169쪽 어디서든(조선 사람의 목소리를 맨 앞에)
const evObj = () => byId(SOURCES_ALL(), S.ev);
/* 근거로 고를 수 있는 문장: 형광펜 조각을 문장 단위로 다시 묶고(마침표로 끝날 때까지, 10자 미만은 다음 문장에 붙임) + 사진 설명.
 * «제국주의 국가는»·«우리 동포여.»처럼 뜻이 안 서는 조각만 골라지는 것을 막는다. */
function sentList(s) {
  const out = [];
  let cur = "";
  parts(s.text).forEach(t => {
    cur += t;
    if (/[.?!]["'」]?\s*$/.test(cur) && cur.trim().length >= 10) { out.push(cur.trim()); cur = ""; }
  });
  if (cur.trim()) out.push(cur.trim());
  return out.concat(s.captions.map(c => c.head + " " + c.text));
}
function quoteText() {
  const s = evObj();
  if (!s) return "";
  const list = sentList(s);
  return S.quote.slice().sort((a, b) => a - b).map(i => list[i]).filter(Boolean).join(" ");
}
/* 빈칸 값 [{label, v}] — 쓰기 화면 고정 띠·시트 글에 같이 쓴다 */
function frameVals() {
  return frameOf(targetObj()).map(f => ({ label: f.label, v: val(f.id) }));
}
const pageLabel = t => "교과서 " + t.page + "쪽";
/* 누르는 카드·조각 안에는 밑줄을 긋지 않는다(낱말 위를 누르면 칠해지지 않던 문제, 2026-11-04 효니).
 * 대신 그 글에 나오는 어려운 낱말을 아래 줄에 따로 모아 눌러 보게 한다. glossary.js가 이 줄에 밑줄을 입힌다. */
function renderWords(box, s) {
  const all = plain(s.text) + " " + (s.cite || "");
  const found = Object.keys(GLOSSARY).filter(k => all.includes(k));
  /* «사회 진화론» 안의 «진화론»은 빼되, 글에 따로 나오면(«진화론을 왜곡해») 남긴다 */
  const alone = k => found.filter(o => o !== k && o.includes(k)).reduce((t, o) => t.split(o).join(" "), all).includes(k);
  const words = found.filter(alone).sort((a, b) => all.indexOf(a) - all.indexOf(b));
  box.innerHTML = "";
  box.hidden = !words.length;
  if (!words.length) return;
  box.appendChild(el("span", "words-label", TEXT.wordsLabel));
  words.forEach(w => box.appendChild(el("span", "word", w)));
}

/* ── 화면 전환 ── */
function show(id) {
  S.screen = id; save();
  document.querySelectorAll(".screen").forEach(sc => { sc.hidden = sc.id !== id; });
  const stage = SCREEN_STAGE[id];
  $("steps").hidden = !stage;
  if (stage) {
    const k = STAGES.indexOf(stage);
    $("steps").querySelectorAll("li").forEach((li, i) => {
      li.classList.toggle("done", i < k);
      li.classList.toggle("now", i === k);
    });
  }
  if (id === "s1") renderPick();
  if (id === "s2") renderOpen();
  if (id === "s3") renderEvidence();
  if (id === "s4") refreshWrite();
  if (id === "s5") renderSummary();
  const slot = document.querySelector("#" + id + " .pin-slot");
  if (slot) slot.appendChild($("pin")); // 고정 띠는 왼쪽(자료) 칸 맨 위로
  renderPin(id);
  syncHead();
  window.scrollTo(0, 0);
}

/* 가로 모드에서 오른쪽 글쓰기 칸이 머리 띠 바로 아래에 붙도록 머리 높이를 CSS에 알려 준다 */
function syncHead() {
  document.documentElement.style.setProperty("--head-h", document.querySelector(".book-head").offsetHeight + "px");
}

/* 고정 띠: 앞에서 고른 것·쓴 것을 다음 화면 위에 다시 보여 준다 */
function renderPin(id) {
  const box = $("pin");
  box.innerHTML = "";
  const t = targetObj();
  if (!t || !["s3", "s4"].includes(id)) { box.hidden = true; return; }
  const line = (label, text, cls) => {
    const p = el("p", cls || "");
    p.appendChild(el("b", "", label));
    p.appendChild(document.createTextNode(text));
    box.appendChild(p);
  };
  if (id === "s4") { // 대상 원문 + 내가 칠한 형광펜
    const p = el("p", "claim-full");
    p.appendChild(el("b", "", t.title));
    parts(t.text).forEach((x, i) => p.appendChild(S.marks.includes(i) ? el("mark", "", x) : document.createTextNode(x)));
    box.appendChild(p);
  } else {
    line("대상", t.title + " (" + t.page + "쪽)");
  }
  frameVals().forEach(f => line(f.label, f.v || "…", "mine"));
  if (id === "s4" && evObj()) line("근거 · " + evObj().title + " (" + evObj().page + "쪽)", quoteText() || "…", "mine");
  box.hidden = false;
}

/* ── 고르기: 9장, 두 묶음 ── */
function renderPick() {
  const box = $("pickList");
  box.innerHTML = "";
  GROUPS.forEach(g => {
    box.appendChild(el("h3", "group-head", g.name));
    const grid = el("div", "claim-grid");
    grid.setAttribute("role", "radiogroup");
    TARGETS.filter(t => t.group === g.id).forEach(t => {
      const card = el("div", "claim");
      const head = el("div", "c-head");
      head.appendChild(el("span", "c-title", t.title));
      head.appendChild(el("span", "c-kind", t.kind));
      card.appendChild(head);
      if (t.img) card.appendChild(figure(t.img, "thumb"));
      const ps = parts(t.text);
      const preview = g.id === "expo" ? ps[0].trim() + " …" : plain(t.text) + (t.cite ? " " + t.cite : "");
      card.appendChild(el("p", "c-text", preview));
      card.appendChild(el("p", "c-page", t.page + "쪽"));
      pickable(card, "radio", S.target === t.id, () => pickTarget(t, card));
      grid.appendChild(rise(card));
    });
    box.appendChild(grid);
  });
  $("s1Next").disabled = !S.target && !skip();
}

function pickTarget(t, card) {
  if (S.submitted) { toast("이미 제출했어. 바꾸려면 선생님께 말해 줘."); return; }
  if (S.target && S.target !== t.id && (S.marks.length || FRAME_IDS.some(id => val(id)) || S.ev) &&
      !confirm("대상을 바꾸면 형광펜·빈칸·근거를 다시 골라야 해. 바꿀까?")) return;
  if (S.target !== t.id) { // 다른 대상의 빈칸·근거가 섞이지 않게 비운다(쓰기 칸 ①②는 학생 글이라 남긴다)
    S.target = t.id; S.marks = []; S.ev = ""; S.quote = [];
    FRAME_IDS.forEach(id => { $(id).value = ""; $(id).dispatchEvent(new Event("input", { bubbles: true })); });
  }
  save();
  $("pickList").querySelectorAll(".claim").forEach(x => x.setAttribute("aria-checked", x === card ? "true" : "false"));
  $("s1Next").disabled = false;
}

/* ── 뜯어보기: 형광펜 + 빈칸 ── */
function renderOpen() {
  const t = targetObj() || TARGETS[0];
  $("expoWord").hidden = t.group !== "expo";
  $("tPage").textContent = t.page + "쪽";
  $("tTitle").textContent = t.title;
  $("tBook").hidden = !t.book;
  $("tBook").textContent = t.book ? "📖 " + t.book : "";
  $("tFig").innerHTML = "";
  if (t.img) $("tFig").appendChild(figure(t.img));
  const box = $("markBox");
  box.innerHTML = "";
  parts(t.text).forEach((x, i) => {
    const sp = el("span", "chunk", x.trimEnd()); // 조각 사이 띄어쓰기는 칠하지 않아 조각이 나뉘어 보이게
    pickable(sp, "checkbox", S.marks.includes(i), () => {
      if (S.submitted) return;
      const on = S.marks.includes(i);
      if (!on && S.marks.length >= 2) { toast("형광펜은 2곳까지야. 하나를 지우고 칠해 줘."); return; }
      S.marks = on ? S.marks.filter(m => m !== i) : S.marks.concat(i);
      sp.setAttribute("aria-checked", on ? "false" : "true");
      save(); refreshOpen();
    });
    box.appendChild(sp);
    if (x !== x.trimEnd()) box.appendChild(document.createTextNode(" "));
  });
  renderWords($("markWords"), t);
  $("markCite").textContent = t.cite || "";
  $("markNote").textContent = t.note ? "※ " + t.note : "";
  const caps = $("tCaps");
  caps.innerHTML = "";
  t.captions.forEach(c => caps.appendChild(rise(captionCard(c))));
  /* 빈칸: rank는 3칸, need(로즈)는 2칸. 칸은 고정 id(f1~f3)라 draft_guard가 그대로 되살린다 */
  const fr = frameOf(t);
  FRAME_IDS.forEach((id, i) => {
    const row = $(id).closest(".frame-row");
    row.hidden = !fr[i];
    if (fr[i]) row.querySelector("label").textContent = fr[i].label;
  });
  $("frameHint").textContent = t.hint;
  refreshOpen();
}

function refreshOpen() {
  const fr = frameOf(targetObj());
  const filled = fr.every(f => val(f.id).length >= 1);
  $("s2Next").disabled = (S.marks.length < 1 || !filled) && !skip();
}

/* ── 근거 고르기: 신문 + 9장 중 하나, 문장 1~2개 ── */
function renderEvidence() {
  const box = $("evList");
  box.innerHTML = "";
  const groups = [{ name: "169쪽 · 조선 사람의 목소리", items: [REFERENCE] }]
    .concat(GROUPS.map(g => ({ name: g.name, items: TARGETS.filter(t => t.group === g.id) })));
  groups.forEach(g => {
    box.appendChild(el("h3", "group-head", g.name));
    const grid = el("div", "ev-list");
    grid.setAttribute("role", "radiogroup");
    g.items.forEach(s => {
      const b = el("div", "ev");
      b.appendChild(el("span", "", s.title));
      b.appendChild(el("span", "ev-tag", s.id === S.target ? "내가 고른 대상" : s.page + "쪽"));
      b.dataset.id = s.id;
      pickable(b, "radio", S.ev === s.id, () => {
        if (S.submitted || S.ev === s.id) return;
        S.ev = s.id; S.quote = [];
        save(); renderEvidence();
        const again = box.querySelector('.ev[data-id="' + s.id + '"]');
        if (again) again.focus({ preventScroll: true }); // 다시 그려도 키보드 위치를 잃지 않게
        const open = $("evOpen");
        if (open.scrollIntoView) open.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      grid.appendChild(b);
    });
    box.appendChild(grid);
  });
  const s = evObj();
  $("evOpen").hidden = !s;
  $("evEmpty").hidden = !!s;
  if (s) {
    $("evPage").textContent = s.page + "쪽";
    $("evTitle").textContent = s.title;
    $("evBook").hidden = !s.book;
    $("evBook").textContent = s.book ? "📖 " + s.book : "";
    renderWords($("evWords"), s);
    const list = $("evSents");
    list.innerHTML = "";
    const nBody = parts(s.text).length;
    sentList(s).forEach((x, i) => {
      const d = el("div", "sent");
      if (i >= nBody) d.appendChild(el("span", "s-tag", "사진 설명"));
      d.appendChild(document.createTextNode(x));
      pickable(d, "checkbox", S.quote.includes(i), () => {
        if (S.submitted) return;
        const on = S.quote.includes(i);
        if (!on && S.quote.length >= 2) { toast("근거 문장은 2개까지야."); return; }
        S.quote = on ? S.quote.filter(q => q !== i) : S.quote.concat(i);
        d.setAttribute("aria-checked", on ? "false" : "true");
        save(); refreshEvidenceNext();
      });
      list.appendChild(d);
    });
  }
  refreshEvidenceNext();
}

function refreshEvidenceNext() {
  $("s3Next").disabled = (!S.ev || !S.quote.length) && !skip();
}

/* ── 쓰기 ── */
function refreshWrite() {
  $("w1c").textContent = val("w1").length + "자";
  $("w2c").textContent = val("w2").length + "자";
  $("s4Next").disabled = (val("w1").length < 5 || val("w2").length < 5) && !skip();
}

/* ── 마무리 ── */
const bodyText = () => [val("w1"), val("w2")].filter(Boolean).join(" ");
const copyHead = () => { const t = targetObj(); return t ? "「" + t.title + "」 비판하기 (" + pageLabel(t) + ")" : ""; };
const copyAll = () => copyHead() + "\n" + bodyText();

function renderSummary() {
  const box = $("summary");
  box.innerHTML = "";
  box.appendChild(el("p", "sum-head", copyHead()));
  box.appendChild(el("p", "", bodyText() || "(아직 글이 없어)"));
  const n = bodyText().length;
  const short = n < TEXT.minChars;
  $("bodyCount").textContent = "내가 쓴 글 " + n + "자 (첫 줄 제외)" + (short ? " — " + TEXT.minChars + "자 이상 써 보자." : "");
  $("bodyCount").classList.toggle("warn", short);
  $("submitBtn").disabled = S.submitted || S.sending;
  $("submitBtn").textContent = S.submitted ? "제출 완료" : "제출";
  renderPadlet();
}

function renderPadlet() {
  const a = $("padletBtn");
  if (S.padletUrl) {
    a.href = S.padletUrl; a.hidden = false; $("padletMsg").textContent = "";
  } else {
    a.hidden = true; $("padletMsg").textContent = "패들렛 링크는 선생님이 알려 준 곳을 써 줘.";
  }
}

/* 시트 G열: [대상] … / [위] … / [아래] … / [기준] … / [근거] 제목: 문장 / ① … / ② … (로즈는 [누구의 필요]·[누구의 땅]) */
const FRAME_TAGS = { rank: ["위", "아래", "기준"], show: ["위", "기준"], need: ["누구의 필요", "누구의 땅"] };
function reflectionText() {
  const t = targetObj(), s = evObj();
  const tags = FRAME_TAGS[(t && t.frame) || "rank"];
  return ["[대상] " + (t ? t.title : "")]
    .concat(tags.map((g, i) => "[" + g + "] " + val(FRAME_IDS[i])))
    .concat(["[근거] " + (s ? s.title : "") + ": " + quoteText(), "① " + val("w1"), "② " + val("w2")])
    .join(" / ");
}

async function submitAll() {
  if (S.sending || S.submitted) return;
  $("outErr").textContent = "";
  const n = bodyText().length;
  if (n < TEXT.minChars && !skip() && !confirm("아직 " + n + "자야. " + TEXT.minChars + "자보다 짧은데 그래도 제출할까?")) return;
  S.sending = true; renderSummary(); $("submitBtn").textContent = "보내는 중…";
  const t = targetObj(), s = evObj();
  const payload = {
    studentId: S.sid, studentName: S.name, gameName: CONFIG.GAME_NAME,
    choiceSummary: (t ? t.title : "") + " ← " + (s ? s.title : ""),
    diffSummary: "",
    reflection: reflectionText(), // 시트 G열
    choicesJson: JSON.stringify({
      sid: S.sid, name: S.name, ban: S.ban,
      targetId: S.target, marks: S.marks.map(i => t ? parts(t.text)[i] : i),
      frame: t ? t.frame : "", f1: val("f1"), f2: val("f2"), f3: val("f3"),
      sourceId: S.ev, quote: quoteText(), s1: val("w1"), s2: val("w2"),
      writing: bodyText(), ts: new Date().toISOString()
    })
  };
  Object.assign(payload, FocusGuard.payload());
  try {
    await postToSheet(payload);
  } catch (e) {
    $("outErr").textContent = e.locked ? e.message : "저장이 안 됐어. 인터넷을 확인하고 다시 눌러 줘.";
    S.sending = false; renderSummary();
    return;
  }
  S.sending = false; S.submitted = true;
  if (!S.preview) {
    if (window.DraftGuard) DraftGuard.clear(); // 저장 성공 → 임시저장 삭제
    clearSave();
  }
  FRAME_IDS.concat(["w1", "w2"]).forEach(id => { $(id).readOnly = true; });
  renderSummary();
  $("outMsg").textContent = S.preview ? "미리보기라 저장하지 않았어." : (S.copied ? "제출했어! 복사한 글을 패들렛에 올려 줘." : "제출했어! 이제 글을 복사해서 패들렛에 올려 줘.");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = el("textarea");
    ta.value = text; ta.setAttribute("data-no-draft", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
    ta.remove();
    return ok;
  }
}

/* ── 시작 ── */
function startApp() {
  const sid = $("sid").value.trim();
  const name = $("sname").value.trim();
  const p = parseSid(sid);
  if (!p) { $("startErr").textContent = "학번은 숫자 5자리로 써 줘. (예: 20512)"; return; }
  if (!name) { $("startErr").textContent = "이름을 써 줘."; return; }
  $("startErr").textContent = "";
  S.sid = sid; S.name = name; S.grade = p.grade; S.ban = p.ban;
  FocusGuard.start({ key: CONFIG.GAME_NAME + ":" + sid }); // 작성 중 화면 이탈·붙여넣기 기록 (history26 snippets/focus_guard.js)
  if (window.DraftGuard) DraftGuard.start({ key: CONFIG.GAME_NAME, sid: sid }); // 글쓰기 칸 임시저장
  loadPadletUrl(p.grade, p.ban).then(u => { S.padletUrl = u; renderPadlet(); });
  load();
  show(SCREEN_STAGE[S.screen] ? S.screen : "s1");
  setTimeout(() => { if (S.screen === "s2") refreshOpen(); refreshWrite(); renderPin(S.screen); }, 700); // draft_guard가 글을 되살린 뒤 다시 그린다
}

/* 빈칸 3줄(f1~f3)은 화면에 미리 만들어 두고 대상마다 이름표만 바꾼다 */
function buildFrameRows() {
  const box = $("frameBox");
  FRAME_IDS.forEach(id => {
    const row = el("div", "frame-row");
    const lb = el("label");
    lb.setAttribute("for", id);
    const inp = el("input");
    inp.id = id; inp.maxLength = 40; inp.autocomplete = "off";
    inp.setAttribute("data-draft", id);
    inp.placeholder = TEXT.framePh;
    inp.addEventListener("input", refreshOpen);
    row.appendChild(lb); row.appendChild(inp);
    box.appendChild(row);
  });
}

/* ── 부팅 (모든 함수 선언 뒤, 파일 맨 마지막) ── */
function init() {
  const q = new URLSearchParams(location.search);
  S.preview = q.get("preview") === "1";
  let sid = (q.get("sid") || "").trim(), name = (q.get("name") || "").trim();
  if (S.preview) {
    $("previewBar").textContent = "미리보기 모드 — 저장되지 않아 · 활동을 다 안 해도 «다음»으로 넘어갈 수 있어";
    $("previewBar").hidden = false;
    if (!sid) sid = "20512";
    if (!name) name = "미리보기";
  }
  $("sid").value = sid; $("sname").value = name;

  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    riseObs = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); riseObs.unobserve(e.target); }
    }), { threshold: 0.1 });
  }

  buildFrameRows();
  window.addEventListener("resize", syncHead);
  $("eyebrow").textContent = INTRO.eyebrow;
  $("appTitle").textContent = INTRO.title;
  $("introQ").textContent = INTRO.question;
  $("pickQ").textContent = TEXT.pickQ;
  $("pickHow").textContent = TEXT.pickHow;
  $("expoWord").textContent = "💬 " + EXPO_WORD + " (168쪽)";
  $("markQ").textContent = TEXT.markQ;
  $("markHow").textContent = TEXT.markHow;
  $("frameQ").textContent = TEXT.frameQ;
  $("evQ").textContent = TEXT.evQ;
  $("evHow").textContent = TEXT.evHow;
  TEXT.evHints.forEach(h => $("evHint").appendChild(el("li", "", h)));
  $("w1Q").textContent = TEXT.w1Q;
  $("w2Q").textContent = TEXT.w2Q;
  $("w1").placeholder = TEXT.wPh;
  $("w2").placeholder = TEXT.wPh;
  $("wHint").textContent = TEXT.wHint;
  $("padletNote").textContent = TEXT.padletNote;

  $("startBtn").addEventListener("click", startApp);
  $("s1Next").addEventListener("click", () => { if (S.target || skip()) { if (!S.target) S.target = TARGETS[0].id; show("s2"); } });
  $("s2Prev").addEventListener("click", () => show("s1"));
  $("s2Next").addEventListener("click", () => {
    if (S.marks.length < 1 && !skip()) { $("s2Err").textContent = "1곳 이상 형광펜을 칠해 줘."; return; }
    if (!frameOf(targetObj()).every(f => val(f.id)) && !skip()) { $("s2Err").textContent = "빈칸을 모두 채워 줘."; return; }
    $("s2Err").textContent = ""; show("s3");
  });
  $("s3Prev").addEventListener("click", () => show("s2"));
  $("s3Next").addEventListener("click", () => {
    if ((!S.ev || !S.quote.length) && !skip()) { $("s3Err").textContent = "자료를 고르고 근거 문장을 1개 이상 눌러 줘."; return; }
    $("s3Err").textContent = ""; show("s4");
  });
  ["w1", "w2"].forEach(id => $(id).addEventListener("input", refreshWrite));
  $("s4Prev").addEventListener("click", () => show("s3"));
  $("s4Next").addEventListener("click", () => {
    if ((val("w1").length < 5 || val("w2").length < 5) && !skip()) { $("s4Err").textContent = "①과 ②를 한 문장씩 써 줘."; return; }
    $("s4Err").textContent = ""; show("s5");
  });
  $("s5Prev").addEventListener("click", () => show("s4"));
  $("copyBtn").addEventListener("click", async () => {
    const ok = await copyText(copyAll());
    S.copied = ok;
    toast(ok ? "복사했어! 패들렛에 붙여 넣어 줘." : "복사가 안 됐어. 글을 길게 눌러 직접 복사해 줘.");
  });
  $("submitBtn").addEventListener("click", submitAll);
  document.querySelectorAll(".hint-btn").forEach(b => b.addEventListener("click", () => {
    const h = $(b.dataset.hint);
    h.hidden = !h.hidden;
    b.setAttribute("aria-expanded", h.hidden ? "false" : "true");
  }));

  Glossary.start({ terms: GLOSSARY, skip: [".chunk", ".sent", ".claim", ".words-label", ".eyebrow", ".c-title", ".credit", "#steps", ".progress", ".group-head", ".ev", ".page-tag", ".cap-tag", ".s-tag", ".c-kind", ".pin b", ".toast", ".preview-bar"] });
}

init();
