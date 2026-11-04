/* word_lookup.js — 학생이 쓴 낱말을 풀이 사전에서 찾는다(화면 코드 없음, 2026-11-04).
 * 사전에는 «그릇된»처럼 교과서에 나온 꼴만 있어서, 활용형·조사가 달라도 같은 낱말로 찾는다.
 * 앞글자만 같다고 찾아 주지 않는다: «원주율»에 «원주민» 풀이를 보여 주면 학생이 틀린 뜻을 믿는다.
 * forms: 규칙으로 못 맞추는 꼴 { "자아내다": "자아냈다" }
 * 돌려주는 값: { hit: "exact"|"near"|"none"|"short", items: [{ word, meaning }] }
 *   exact = 같은 낱말(활용형 포함), near = 낱말의 앞부분만 쓴 경우(«진화» → 진화론) */
const WORD_ENDINGS = ["되었다", "하였다", "되다", "하다", "됐다", "했다", "되는", "하는", "된", "한", "적인", "적", "을", "를", "은", "는", "이", "가", "의", "에", "로", "과", "와", "도"];

function lookupWord(input, terms, forms) {
  const squeeze = s => String(s).replace(/\s+/g, "");
  const q = squeeze(input);
  if (q.length < 2) return { hit: "short", items: [] };
  const keys = Object.keys(terms);
  const item = k => ({ word: k, meaning: terms[k] });
  const direct = keys.filter(k => squeeze(k) === q);
  if (direct.length) return { hit: "exact", items: direct.map(item) };
  if (forms && terms[forms[q]]) return { hit: "exact", items: [item(forms[q])] };
  for (const end of WORD_ENDINGS) {
    if (!q.endsWith(end)) continue;
    const stem = q.slice(0, -end.length);
    if (stem.length < 2) continue;
    const same = keys.filter(k => [stem, stem + "된", stem + "한"].includes(squeeze(k)));
    if (same.length) return { hit: "exact", items: same.map(item) };
  }
  const near = keys.filter(k => squeeze(k).startsWith(q)).sort((a, b) => a.length - b.length);
  return near.length ? { hit: "near", items: near.slice(0, 4).map(item) } : { hit: "none", items: [] };
}
