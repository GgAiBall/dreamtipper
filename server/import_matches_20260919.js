/**
 * import_matches_20260919.js
 * 批量写入今明两日扫盘数据到 dreamtipper 数据库
 * 用法: node import_matches_20260919.js
 */
const https = require('https');

// 配置
const API_BASE = 'https://dreamtipper-api.onrender.com';
const ADMIN_EMAIL = 'admin@dreamtipper.com';
const ADMIN_PASSWORD = 'admin123';

let JWT_TOKEN = null;

// 统一时间转换函数（处理北京时间）
function toUTC(beijingDateStr, timeStr) {
  // 北京时间 = UTC+8，手动计算避免 Date.UTC 负数时区偏移问题
  const [year, month, day] = beijingDateStr.split('-').map(Number);
  let [hour, minute] = timeStr.split(':').map(Number);
  hour -= 8;
  let y = year, m = month - 1, d = day;
  if (hour < 0) { hour += 24; d -= 1; }
  // 月份跨年
  if (d < 1) { m -= 1; if (m < 0) { m = 11; y -= 1; } const daysInPrevMonth = new Date(y, m + 1, 0).getDate(); d = daysInPrevMonth; }
  const pad = n => String(n).padStart(2, '0');
  return `${y}-${pad(m + 1)}-${pad(d)}T${pad(hour)}:${pad(minute)}:00`;
}

// 生成星期
function getWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00+08:00');
  return d.getDay() === 0 ? 7 : d.getDay();
}

// 格式化日期为 YYYY-MM-DD（北京时间）
function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${y}-${m}-${d}`;
}

// 今明两日比赛数据
const today = '2026-09-19';
const tomorrow = '2026-09-20';

const matches = [
  // ========== 周六001-004 下午场 ==========
  { no: '001', league: '日职', home: '长崎航海', away: '大阪樱花', date: today, time: '17:30', stars: 3 },
  { no: '002', league: '日乙', home: '藤枝MYFC', away: '大宫松鼠', date: today, time: '17:30', stars: 2 },
  { no: '003', league: '韩职', home: '安养FC', away: '蔚山现代', date: today, time: '18:00', stars: 3 },
  { no: '004', league: '日职', home: '横滨水手', away: '水户蜀葵', date: today, time: '18:30', stars: 2 },

  // ========== 周六005-010 晚间 ==========
  { no: '005', league: '英超', home: '托特纳姆热刺', away: '阿斯顿维拉', date: today, time: '19:30', stars: 4 },
  { no: '006', league: '英冠', home: '斯托克城', away: '谢菲尔德联', date: today, time: '19:30', stars: 3 },
  { no: '007', league: '西甲', home: '奥萨苏纳', away: '巴列卡诺', date: today, time: '20:00', stars: 3 },
  { no: '008', league: '意甲', home: '乌迪内斯', away: '卡利亚里', date: today, time: '21:00', stars: 3 },
  { no: '009', league: '意甲', home: '博洛尼亚', away: '都灵', date: today, time: '21:00', stars: 3 },
  { no: '010', league: '瑞超', home: '韦斯特罗斯', away: '马尔默', date: today, time: '21:00', stars: 3 },

  // ========== 周六011-019 德甲黄金档 ==========
  { no: '011', league: '德甲', home: '法兰克福', away: '弗赖堡', date: today, time: '21:30', stars: 4 },
  { no: '012', league: '德甲', home: '汉堡', away: '科隆', date: today, time: '21:30', stars: 4 },
  { no: '013', league: '德甲', home: '门兴格拉德巴赫', away: '美因茨', date: today, time: '21:30', stars: 3 },
  { no: '014', league: '德甲', home: '云达不来梅', away: '奥格斯堡', date: today, time: '21:30', stars: 3 },

  // ========== 周六015-019 英超/挪超 ==========
  { no: '015', league: '英超', home: '埃弗顿', away: '伊普斯维奇', date: today, time: '22:00', stars: 4 },
  { no: '016', league: '英超', home: '纽卡斯尔联', away: '赫尔城', date: today, time: '22:00', stars: 4 },
  { no: '017', league: '挪超', home: '克里斯蒂安松', away: '罗森博格', date: today, time: '22:00', stars: 3 },
  { no: '018', league: '西甲', home: '毕尔巴鄂竞技', away: '阿拉维斯', date: today, time: '22:15', stars: 3 },
  { no: '019', league: '法甲', home: '巴黎FC', away: '斯特拉斯堡', date: today, time: '23:15', stars: 3 },

  // ========== 周六020-030 凌晨场（9/20凌晨） ==========
  { no: '020', league: '意甲', home: '罗马', away: '国际米兰', date: today, time: '00:00', stars: 5, note: '开赛时间实为次日00:00' },
  { no: '021', league: '英超', home: '诺丁汉森林', away: '考文垂', date: today, time: '00:30', stars: 4, note: '开赛时间实为次日00:30' },
  { no: '022', league: '德甲', home: '斯图加特', away: '多特蒙德', date: today, time: '00:30', stars: 5, note: '开赛时间实为次日00:30' },
  { no: '023', league: '西甲', home: '维戈塞尔塔', away: '桑坦德竞技', date: today, time: '00:30', stars: 3, note: '开赛时间实为次日00:30' },
  { no: '024', league: '荷甲', home: '阿贾克斯', away: 'SBV精英', date: today, time: '02:00', stars: 3, note: '开赛时间实为次日02:00' },
  { no: '025', league: '意甲', home: '威尼斯', away: '拉齐奥', date: today, time: '02:45', stars: 4, note: '开赛时间实为次日02:45' },
  { no: '026', league: '法甲', home: '昂热', away: '特鲁瓦', date: today, time: '02:45', stars: 2, note: '开赛时间实为次日02:45' },
  { no: '027', league: '法甲', home: '里昂', away: '雷恩', date: today, time: '02:45', stars: 4, note: '开赛时间实为次日02:45' },
  { no: '028', league: '西甲', home: '塞维利亚', away: '巴塞罗那', date: today, time: '03:00', stars: 5, note: '开赛时间实为次日03:00' },
  { no: '029', league: '葡超', home: '里斯本竞技', away: '阿罗卡', date: today, time: '03:30', stars: 3, note: '开赛时间实为次日03:30' },
  { no: '030', league: '巴甲', home: '米拉索尔', away: '博塔弗戈', date: today, time: '04:00', stars: 3, note: '开赛时间实为次日04:00' },

  // ========== 周日001-010 下午-晚间 ==========
  { no: '001', league: '亚运男足', home: '伊朗亚运男足', away: '中国亚运男足', date: tomorrow, time: '13:00', stars: 5 },
  { no: '002', league: '日职', home: '町田泽维亚', away: '柏太阳神', date: tomorrow, time: '16:00', stars: 3 },
  { no: '003', league: '日职', home: '大阪钢巴', away: '神户胜利船', date: tomorrow, time: '16:00', stars: 4 },
  { no: '004', league: '韩职', home: '仁川联', away: '大田市民', date: tomorrow, time: '18:00', stars: 3 },
  { no: '005', league: '亚运男足', home: '吉尔吉斯斯坦亚足', away: '日本亚足', date: tomorrow, time: '18:30', stars: 4 },
  { no: '006', league: '意甲', home: '佛罗伦萨', away: '那不勒斯', date: tomorrow, time: '18:30', stars: 4 },
  { no: '007', league: '英冠', home: '伍尔弗汉普顿', away: '西布罗姆维奇', date: tomorrow, time: '19:00', stars: 3 },
  { no: '008', league: '西甲', home: '赫塔费', away: '马拉加', date: tomorrow, time: '20:00', stars: 3 },
  { no: '009', league: '荷甲', home: '特温特', away: 'PSV埃因霍温', date: tomorrow, time: '20:30', stars: 4 },
  { no: '010', league: '英超', home: '利兹联', away: '水晶宫', date: tomorrow, time: '21:00', stars: 4 },

  // ========== 周日011-030 晚场 ==========
  { no: '011', league: '英超', home: '伯恩茅斯', away: '利物浦', date: tomorrow, time: '21:00', stars: 5 },
  { no: '012', league: '英超', home: '曼彻斯特城', away: '桑德兰', date: tomorrow, time: '21:00', stars: 5 },
  { no: '013', league: '意甲', home: '帕尔马', away: '热那亚', date: tomorrow, time: '21:00', stars: 3 },
  { no: '014', league: '意甲', home: '弗洛西诺内', away: '科莫', date: tomorrow, time: '21:00', stars: 3 },
  { no: '015', league: '德甲', home: '勒沃库森', away: '莱比锡红牛', date: tomorrow, time: '21:30', stars: 5 },
  { no: '016', league: '西甲', home: '马德里竞技', away: '皇家马德里', date: tomorrow, time: '22:15', stars: 5 },
  { no: '017', league: '瑞超', home: '米亚尔比', away: '哥德堡盖斯', date: tomorrow, time: '22:15', stars: 2 },
  { no: '018', league: '英超', home: '富勒姆', away: '曼彻斯特联', date: tomorrow, time: '23:00', stars: 4 },
  { no: '019', league: '法甲', home: '尼斯', away: '里尔', date: tomorrow, time: '23:15', stars: 3 },
  { no: '020', league: '德甲', home: '沙尔克04', away: '埃沃斯堡', date: tomorrow, time: '23:30', stars: 3 },
];

// 生成唯一ID
function genId(prefix, date, no) {
  // 用 uuidv4 格式确保唯一性，避免 Date.now() 并发重复
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${date.replace(/-/g, '')}-${no.padStart(3, '0')}-${ts}${rand}`;
}

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
        catch (e) { json = { raw: Buffer.concat(chunks).toString('utf8').slice(0, 200) }; }
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
  console.log('🔐 登录获取 Token...');
  const res = await httpRequest('POST', '/api/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (res.status !== 200 || !res.data.token) {
    throw new Error(`登录失败: ${JSON.stringify(res.data)}`);
  }
  JWT_TOKEN = res.data.token;
  console.log('✅ 登录成功！');
}

async function insertMatch(match) {
  const weekday = getWeekday(match.date);
  // 注意：凌晨场（time < 08:00）实际是次日，需要调整日期
  let actualDate = match.date;
  let actualTime = match.time;
  if (match.time >= '00:00' && match.time <= '08:00') {
    // 凌晨场是次日，北京时间+1天
    const d = new Date(match.date + 'T00:00:00+08:00');
    d.setDate(d.getDate() + 1);
    actualDate = d.toISOString().slice(0, 10);
    weekday = getWeekday(actualDate);
  }

  const matchTimeUTC = toUTC(actualDate, actualTime);
  const matchId = genId('sweep', match.date, match.no);
  const tier = match.stars >= 4 ? 'monthly' : 'free';
  const plays = {
    win_draw_loss: { pick: '', result: 'pending' },
    handicap: { pick: '', result: 'pending' },
    score: { pick: '', result: 'pending' },
    goals: { pick: '', result: 'pending' },
    half_full: { pick: '', result: 'pending' },
  };

  const payload = {
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
  };

  return httpRequest('POST', '/api/admin/sweep', payload, JWT_TOKEN);
}

async function main() {
  try {
    await login();

    console.log(`\n📋 开始写入 ${matches.length} 条比赛数据...\n`);

    let success = 0, skip = 0, fail = 0;
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const label = `周${m.date === today ? '六' : '日'}${m.no.padStart(3,'0')} ${m.league} ${m.home} vs ${m.away}`;
      try {
        const res = await insertMatch(m);
        if (res.status === 200 || res.status === 201) {
          success++;
          console.log(`  ✅ [${i+1}/${matches.length}] ${label} → ${res.data.message || 'OK'}`);
        } else if (res.data.error && (res.data.error.includes('UNIQUE') || res.data.error.includes('already exists'))) {
          skip++;
          console.log(`  ⏭  [${i+1}/${matches.length}] ${label} → 已存在，跳过`);
        } else {
          fail++;
          console.log(`  ❌ [${i+1}/${matches.length}] ${label} → [${res.status}] ${res.data.error || JSON.stringify(res.data).slice(0,200)}`);
        }
      } catch (e) {
        fail++;
        console.log(`  ❌ [${i+1}/${matches.length}] ${label} → ${e.message}`);
      }
      // 防止请求过快
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`\n========== 完成 ==========`);
    console.log(`  ✅ 成功: ${success}`);
    console.log(`  ⏭  跳过: ${skip}`);
    console.log(`  ❌ 失败: ${fail}`);
    console.log(`  📊 合计: ${matches.length}`);

    if (success > 0) {
      console.log(`\n🚀 建议下一步：`);

      // 批量发布今日（周六005起）已开售比赛
      const toPublish = matches.filter(m => {
        const hour = parseInt(m.time.split(':')[0]);
        // 只发布19:30以后开赛的（已开售场次）
        const isTodayEvening = m.date === today && hour >= 19;
        const isTomorrow = m.date === tomorrow;
        return (isTodayEvening || isTomorrow) && m.stars >= 3;
      });
      console.log(`\n  可发布 ${toPublish.length} 条高信心场次到网站前台`);
      console.log(`  或登录后台手动审核发布: https://dreamtipper-api.onrender.com/admin/upload`);
    }
  } catch (e) {
    console.error('❌ 脚本异常:', e.message);
    process.exit(1);
  }
}

main();
