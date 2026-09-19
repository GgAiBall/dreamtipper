/**
 * retry_midnight_20260919.js
 * 重跑之前失败的凌晨场次（周六020-030）
 */
const https = require('https');

const API_BASE = 'https://dreamtipper-api.onrender.com';
const ADMIN_EMAIL = 'admin@dreamtipper.com';
const ADMIN_PASSWORD = 'admin123';

let JWT_TOKEN = null;

function toUTC(beijingDateStr, timeStr) {
  const [year, month, day] = beijingDateStr.split('-').map(Number);
  let [hour, minute] = timeStr.split(':').map(Number);
  hour -= 8;
  let y = year, m = month - 1, d = day;
  if (hour < 0) { hour += 24; d -= 1; }
  if (d < 1) { m -= 1; if (m < 0) { m = 11; y -= 1; } const daysInPrevMonth = new Date(y, m + 1, 0).getDate(); d = daysInPrevMonth; }
  const pad = n => String(n).padStart(2, '0');
  return `${y}-${pad(m + 1)}-${pad(d)}T${pad(hour)}:${pad(minute)}:00`;
}

function getWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00+08:00');
  return d.getDay() === 0 ? 7 : d.getDay();
}

function genId(prefix, date, no) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${date.replace(/-/g, '')}-${no.padStart(3, '0')}-${ts}${rand}`;
}

const today = '2026-09-19';

const midnightMatches = [
  { no: '020', league: '意甲', home: '罗马', away: '国际米兰', date: today, time: '00:00', stars: 5 },
  { no: '021', league: '英超', home: '诺丁汉森林', away: '考文垂', date: today, time: '00:30', stars: 4 },
  { no: '022', league: '德甲', home: '斯图加特', away: '多特蒙德', date: today, time: '00:30', stars: 5 },
  { no: '023', league: '西甲', home: '维戈塞尔塔', away: '桑坦德竞技', date: today, time: '00:30', stars: 3 },
  { no: '024', league: '荷甲', home: '阿贾克斯', away: 'SBV精英', date: today, time: '02:00', stars: 3 },
  { no: '025', league: '意甲', home: '威尼斯', away: '拉齐奥', date: today, time: '02:45', stars: 4 },
  { no: '026', league: '法甲', home: '昂热', away: '特鲁瓦', date: today, time: '02:45', stars: 2 },
  { no: '027', league: '法甲', home: '里昂', away: '雷恩', date: today, time: '02:45', stars: 4 },
  { no: '028', league: '西甲', home: '塞维利亚', away: '巴塞罗那', date: today, time: '03:00', stars: 5 },
  { no: '029', league: '葡超', home: '里斯本竞技', away: '阿罗卡', date: today, time: '03:30', stars: 3 },
  { no: '030', league: '巴甲', home: '米拉索尔', away: '博塔弗戈', date: today, time: '04:00', stars: 3 },
];

function httpRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const opt = {
      method,
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    };
    if (token) opt.headers['Authorization'] = `Bearer ${token}`;
    const req = https.request(opt, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        let json;
        try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch (e) { json = { raw: Buffer.concat(chunks).toString('utf8').slice(0, 500) }; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login() {
  const res = await httpRequest('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (res.status !== 200 || !res.data.token) throw new Error(`登录失败: ${JSON.stringify(res.data)}`);
  JWT_TOKEN = res.data.token;
  console.log('✅ 登录成功\n');
}

async function insertMatch(match) {
  const weekday = getWeekday(match.date);
  const matchTimeUTC = toUTC(match.date, match.time);
  const matchId = genId('sweep', match.date, match.no);
  const tier = match.stars >= 4 ? 'monthly' : 'free';
  const plays = {
    win_draw_loss: { pick: '', result: 'pending' },
    handicap: { pick: '', result: 'pending' },
    score: { pick: '', result: 'pending' },
    goals: { pick: '', result: 'pending' },
    half_full: { pick: '', result: 'pending' },
  };

  console.log(`   调试: date=${match.date} time=${match.time} → UTC=${matchTimeUTC} weekday=${weekday} id=${matchId.slice(0,30)}...`);

  return httpRequest('POST', '/api/admin/sweep', {
    id: matchId,
    match_id: `match-${matchId}`,
    league: match.league,
    home_team: match.home,
    away_team: match.away,
    match_time: matchTimeUTC,
    handicap: JSON.stringify(plays),
    odds: 0,
    odds_type: '胜平负',
    confidence_stars: match.stars,
    tier_required: tier,
    result: 'pending',
    weekday,
    match_no: match.no,
    category: '人工扫盘',
    data_source: 'admin_import',
  }, JWT_TOKEN);
}

async function main() {
  try {
    await login();
    let success = 0, skip = 0, fail = 0;
    for (let i = 0; i < midnightMatches.length; i++) {
      const m = midnightMatches[i];
      const label = `周六${m.no} ${m.league} ${m.home} vs ${m.away}`;
      try {
        const res = await insertMatch(m);
        if (res.status === 200 || res.status === 201) {
          success++;
          console.log(`  ✅ ${label} → ${res.data.message || 'OK'}\n`);
        } else if (res.data.error && res.data.error.toLowerCase().includes('unique')) {
          skip++;
          console.log(`  ⏭  ${label} → 已存在，跳过\n`);
        } else {
          fail++;
          console.log(`  ❌ ${label} → [${res.status}] ${res.data.error || JSON.stringify(res.data).slice(0,300)}\n`);
        }
      } catch (e) {
        fail++;
        console.log(`  ❌ ${label} → ${e.message}\n`);
      }
      await new Promise(r => setTimeout(r, 500));
    }
    console.log(`完成: ✅${success} ⏭${skip} ❌${fail}`);
  } catch (e) {
    console.error('异常:', e.message);
  }
}

main();
