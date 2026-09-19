const fs = require('fs');
const p = 'C:/Users/DELL/.qclaw/workspace-agent-3756128a/dreamtipper/client/src/views/AdminUpload.vue';
let c = fs.readFileSync(p, 'utf8');
const lines = c.split('\n');
const si = lines.findIndex(l => l.includes('function featureList'));
const ei = lines.findIndex(l => l.includes('async function fetchResult'));
console.log('si:', si, 'ei:', ei);
const fl = `function featureList(d) {
  if (!d) return []
  const fmt = (s) => {
    if (!s) return null
    const total = parseInt(s.totalLegCnt || s.totalLeg || 0)
    const wins = parseInt(s.winGoalMatchCnt || 0)
    const draws = parseInt(s.drawMatchCnt || 0)
    const losses = parseInt(s.lossGoalMatchCnt || 0)
    const pct = (n) => total > 0 ? Math.round(n * 100 / total) : 0
    const homeText = wins + '胜' + draws + '平' + losses + '负 (' + total + '场)'
    const awayText = losses + '胜' + draws + '平' + wins + '负 (' + total + '场)'
    return { homeText, awayText, homePct: pct(wins), awayPct: pct(losses) }
  }
  const items = [
    { key: 'last', title: '近10场战绩' },
    { key: 'sameHomeAway', title: '同主客场近况' },
    { key: 'eachHomeAway', title: '主客交锋' },
    { key: 'eachSameHomeAway', title: '同主客交锋' }
  ]
  const rows = []
  for (const it of items) { const f = fmt(d[it.key]); if (f) rows.push({ title: it.title, ...f }) }
  if (d.homeFeature || d.awayFeature) {
    const hf = d.homeFeature || {}; const af = d.awayFeature || {}
    rows.push({ title: '场均进球', homeText: (hf.avgGoal || '-') + '个', awayText: (af.avgGoal || '-') + '个', homePct: parseFloat(hf.avgGoal || 0) * 30, awayPct: parseFloat(af.avgGoal || 0) * 30 })
    rows.push({ title: '场均失球', homeText: (hf.avgLossGoal || '-') + '个', awayText: (af.avgLossGoal || '-') + '个', homePct: parseFloat(hf.avgLossGoal || 0) * 30, awayPct: parseFloat(af.avgLossGoal || 0) * 30 })
  }
  return rows
}`;
const newLines = [...lines.slice(0, si), ...fl.split('\n'), ...lines.slice(ei)];
const newC = newLines.join('\n');
fs.writeFileSync(p, newC);
console.log('done', c.length, '->', newC.length);
