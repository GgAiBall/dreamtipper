<template>
  <div class="page">
    <div class="page-header">
      <router-link to="/admin" class="back-link">← 管理后台</router-link>
      <h1>📤 扫盘数据管理</h1>
      <p>所有扫盘数据先保存为草稿，确认后点击"发布"逐条上线。已发布后仍可点击修改并记录变更时间</p>
    </div>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <button @click="showCreate = !showCreate" class="btn btn-primary">{{ showCreate ? '✕ 收起' : '✏️ 新增扫盘数据' }}</button>
      <button v-if="selectedIds.length" @click="batchPublish" class="btn btn-success">批量发布 ({{ selectedIds.length }})</button>
      <button v-if="selectedIds.length" @click="batchDelete" class="btn btn-ghost danger">批量删除</button>
      <button @click="batchFetch" class="btn btn-ghost" :disabled="fetching">🔄 批量获取官网结果</button>
      <div class="filter-tabs">
        <button :class="{ active: filter === 'all' }" @click="filter = 'all'; loadRecords()">全部 ({{ counts.all }})</button>
        <button :class="{ active: filter === 'pending' }" @click="filter = 'pending'; loadRecords()">📝 草稿 ({{ counts.pending }})</button>
        <button :class="{ active: filter === 'published' }" @click="filter = 'published'; loadRecords()">✅ 已发布 ({{ counts.published }})</button>
        <button :class="{ active: filter === 'settled' }" @click="filter = 'settled'; loadRecords()">🏁 已结算 ({{ counts.settled }})</button>
      </div>
    </div>

    <!-- 表格批量上传 -->
    <div class="upload-card sheet-card">
      <div class="sheet-head">
        <h3>📊 表格批量上传（支持 Excel / CSV / JSON）</h3>
        <button @click="downloadTemplate" class="btn btn-ghost btn-sm">⬇️ 下载模板</button>
      </div>
      <p class="sheet-tip">下载模板后在「扫盘数据」工作表填写每日比赛，表头自动识别。上传后可直接发布或存为草稿。多选用 / 隔开（如 胜/平）。</p>
      <div class="sheet-row">
        <input ref="uploadInput" type="file" accept=".xlsx,.xls,.csv,.json" @change="onFileChange" class="file-input" />
        <label class="publish-toggle">
          <input type="checkbox" v-model="autoPublish" /> 上传后直接发布
        </label>
        <button @click="handleUpload" class="btn btn-primary" :disabled="uploading || !uploadFile">
          {{ uploading ? '上传中...' : '📤 上传并导入' }}
        </button>
        <span v-if="uploadFile" class="file-name">已选：{{ uploadFile.name }}</span>
      </div>
      <div v-if="uploadResult" class="result-msg" :class="uploadResult.error ? 'error' : 'success'">
        {{ uploadResult.text }}
        <ul v-if="uploadResult.errors && uploadResult.errors.length" class="err-list">
          <li v-for="(e, i) in uploadResult.errors" :key="i">⚠️ {{ e }}</li>
        </ul>
      </div>
    </div>

    <!-- 新增表单 -->
    <div v-if="showCreate" class="upload-card">
      <h3>新增扫盘草稿</h3>
      <div class="form-row">
        <div class="form-group"><label>联赛</label><input v-model="form.league" required placeholder="如：英超" /></div>
        <div class="form-group"><label>主队</label><input v-model="form.home_team" required /></div>
        <div class="form-group"><label>客队</label><input v-model="form.away_team" required /></div>
        <div class="form-group"><label>比赛日期（自动填今天）</label><input v-model="form.match_date" type="date" required /></div>
        <div class="form-group"><label>开赛时间（每5分钟）</label>
          <select v-model="form.match_time_slot" required>
            <option v-for="t in timeSlots" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-group"><label>场次编号</label>
          <div style="display:flex;gap:8px;align-items:center">
            <select v-model.number="form.weekday" style="width:120px">
              <option v-for="d in weekdays" :key="d.value" :value="d.value">{{ d.label }}</option>
            </select>
            <input v-model="form.match_no" placeholder="如 001" maxlength="4" style="width:80px" />
          </div>
        </div>
        <div class="form-group"><label>信心星级</label>
          <select v-model.number="form.confidence_stars">
            <option v-for="n in 5" :key="n" :value="n">{{ '★'.repeat(n) }}{{ '☆'.repeat(5-n) }}</option>
          </select>
        </div>
        <div class="form-group"><label>权限</label>
          <select v-model="form.tier_required">
            <option value="free">🆓 免费</option><option value="monthly">💎 月度</option><option value="yearly">👑 年度</option>
          </select>
        </div>
        <div class="form-group"><label>分类</label>
          <select v-model="form.category">
            <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </div>
        <div class="form-group"><label>详情页链接(会员专享)</label><input v-model="form.detail_url" placeholder="https://... 留空则无" /></div>
      </div>

      <!-- 各玩法：tag 多选 + 手动输入 -->
      <div class="block-title">各玩法推荐（点击选项可多选，用 / 拼接；也可手动输入）</div>
      <div class="plays-grid">
        <div class="play-item" v-for="play in playTypes" :key="play.key">
          <div class="play-head"><span class="play-name">{{ play.label }}</span><span class="play-tag">{{ play.tag }}</span></div>
          <div class="tag-options">
            <button v-for="o in play.options" :key="o" type="button"
              class="tag-btn" :class="{ active: isSel(form.plays[play.key].pickArr, o) }"
              @click="toggleTag(form.plays[play.key], o)">{{ o }}</button>
          </div>
          <div class="form-group compact" style="margin-top:6px">
            <label>当前选择</label>
            <input v-model="form.plays[play.key].pick" placeholder="手动输入或留空" />
          </div>
          <div class="form-group compact">
            <label>红黑</label>
            <select v-model="form.plays[play.key].result">
              <option v-for="r in RESULT_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
          </div>
        </div>
        <!-- 让球：先选让几球，再选让胜/让平/让负（均可多选） -->
        <div class="play-item play-handicap">
          <div class="play-head"><span class="play-name">让球</span><span class="play-tag">让球+结果</span></div>
          <div class="hc-block">
            <label class="hc-label">让几球</label>
            <div class="tag-options">
              <button v-for="l in HANDICAP_LINES" :key="l" type="button"
                class="tag-btn" :class="{ active: isSel(form.plays.handicap.lineArr, l) }"
                @click="toggleTag(form.plays.handicap, l, 'lineArr', 'line')">{{ l }}</button>
            </div>
          </div>
          <div class="hc-block">
            <label class="hc-label">结果</label>
            <div class="tag-options">
              <button v-for="r in HANDICAP_RESULTS" :key="r" type="button"
                class="tag-btn" :class="{ active: isSel(form.plays.handicap.pickArr, r) }"
                @click="toggleTag(form.plays.handicap, r, 'pickArr', 'pick')">{{ r }}</button>
            </div>
          </div>
          <div class="form-group compact" style="margin-top:6px">
            <label>让几球（显示）</label>
            <input v-model="form.plays.handicap.line" placeholder="自动拼接或手输" />
          </div>
          <div class="form-group compact">
            <label>结果（显示）</label>
            <input v-model="form.plays.handicap.pick" placeholder="自动拼接或手输" />
          </div>
          <div class="form-group compact">
            <label>红黑</label>
            <select v-model="form.plays.handicap.result">
              <option v-for="r in RESULT_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
          </div>
        </div>
      </div>
      <div v-if="submitMsg" class="result-msg" :class="submitMsg.error ? 'error' : 'success'">{{ submitMsg.text }}</div>
      <button @click="submitDraft" class="btn btn-primary" :disabled="submitting">{{ submitting ? '保存中...' : '💾 保存为草稿' }}</button>
    </div>

    <!-- 数据列表 -->
    <div class="records-list" v-if="records.length">
      <div class="list-item" v-for="r in records" :key="r.id">
        <input type="checkbox" :value="r.id" v-model="selectedIds" class="checkbox" />
        <div class="item-main">
          <div class="item-top">
            <span class="league-tag">{{ r.league }}</span>
            <span class="match-teams">{{ r.home_team }} VS {{ r.away_team }}</span>
            <span class="mono time">{{ formatTime(r.match_time) }}</span>
            <span class="weekday-badge">{{ weekdayLabel(r.weekday) }} {{ r.match_no }}</span>
            <span v-if="r.category" class="cat-tag" :class="catClass(r.category)">{{ r.category }}</span>
            <span class="tier-tag" :class="r.tier_required">{{ tierTag(r.tier_required) }}</span>
            <span class="stars">
              <span v-for="n in 5" :key="n" class="star" :class="{ active: n <= (r.confidence_stars || 0) }">★</span>
            </span>
            <span class="status-badge" :class="r.status">{{ statusLabel(r.status) }}</span>
            <span v-if="r.official_result" class="official-badge" :class="r.result">🏟 官网 {{ officialScore(r) }} · {{ resultDot(r.result) }}</span>
          </div>
          <div class="item-plays">
            <div v-for="(p, key) in parsePlays(r.handicap)" :key="key" class="play-line" :class="p.result">
              <span class="play-label">{{ playLabel(key) }}</span>
              <span class="play-pick">{{ p.pick || '-' }}<span v-if="p.line" class="play-line-tag"> ({{ p.line }})</span></span>
              <span v-if="p.odds" class="play-odds">{{ formatOdds(p.odds) }}</span>
              <span class="play-result">{{ resultDot(p.result) }}</span>
            </div>
          </div>
          <div class="item-meta">
            <span class="mono">⏱ 创建: {{ formatDate(r.created_at) }}</span>
            <span class="mono">✏️ 更新: {{ formatDate(r.updated_at) }}</span>
            <span v-if="r.published_at" class="mono published-at">📤 发布: {{ formatDate(r.published_at) }}</span>
          </div>
        </div>
        <div class="item-actions">
          <button v-if="r.status === 'pending'" @click="publish(r.id)" class="btn btn-success btn-sm">📤 发布</button>
          <button v-else-if="r.status === 'published' || r.status === 'settled'" @click="unpublish(r.id)" class="btn btn-ghost btn-sm">↩️ 撤回</button>
          <button @click="fetchResult(r.id)" class="btn btn-ghost btn-sm" :disabled="fetching">🔄 获取结果</button>
          <button @click="showHistory(r)" class="btn btn-ghost btn-sm">📈 赔率变化</button>
          <button @click="showContext(r)" class="btn btn-ghost btn-sm">📊 基本信息</button>
          <button @click="openSporttery(r)" class="btn btn-ghost btn-sm" v-if="r.sporttery_match_id || r.wbsj_match_id">🔗 竞彩详情</button>
          <button @click="editRecord(r)" class="btn btn-ghost btn-sm">✏️ 修改</button>
          <button @click="removeRecord(r.id)" class="btn btn-ghost btn-sm danger">删除</button>
        </div>
      </div>
    </div>
    <div v-else class="empty">暂无扫盘数据</div>

    <!-- 赔率历史弹窗 -->
    <div v-if="historyModal.open" class="modal-mask" @click.self="historyModal.open = false">
      <div class="modal modal-lg">
        <div class="modal-head">
          <h3>📈 赔率变化历史</h3>
          <button @click="historyModal.open = false" class="btn-close">×</button>
        </div>
        <div class="modal-body">
          <div class="muted mb-8">{{ historyModal.record?.league }} | {{ historyModal.record?.home_team }} VS {{ historyModal.record?.away_team }} | {{ weekdayLabel(historyModal.record?.weekday) }} {{ historyModal.record?.match_no }}</div>
          <div v-if="historyModal.loading" class="muted">加载中...</div>
          <div v-else-if="!historyModal.list.length" class="empty">暂无赔率变化记录（同步脚本未检测到赔率变动时不会写入历史）</div>
          <table v-else class="odds-table">
            <thead><tr><th>时间</th><th>胜平负</th><th>让球</th><th>比分/进球/半全</th></tr></thead>
            <tbody>
              <tr v-for="(h, idx) in historyModal.list" :key="h.id || idx">
                <td class="mono">{{ formatDate(h.captured_at) }}</td>
                <td><div class="cell-mini" v-html="renderPlaysMini(h.handicap)"></div></td>
                <td><div class="cell-mini">{{ renderHandicapLine(h.handicap) }}</div></td>
                <td><div class="cell-mini muted">{{ renderOtherPlays(h.handicap) }}</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 基本信息弹窗（供 AI 生成提示词用） -->
    <div v-if="contextModal.open" class="modal-mask" @click.self="contextModal.open = false">
      <div class="modal modal-lg">
        <div class="modal-head">
          <h3>📊 基本信息（AI 提示词素材）</h3>
          <button @click="contextModal.open = false" class="btn-close">×</button>
        </div>
        <div class="modal-body">
          <div class="muted mb-8">{{ contextModal.record?.league }} | {{ contextModal.record?.home_team }} VS {{ contextModal.record?.away_team }} | {{ formatTime(contextModal.record?.match_time) }}</div>
          <!-- Tab 切换 -->
          <div class="ctx-tabs">
            <button :class="['ctx-tab', contextModal.tab==='odds'?'active':'']" @click="contextModal.tab='odds'">赔率</button>
            <button :class="['ctx-tab', contextModal.tab==='feature'?'active':'']" @click="contextModal.tab='feature'" :disabled="!contextModal.sporttery?.ok">特征分析</button>
            <button :class="['ctx-tab', contextModal.tab==='h2h'?'active':'']" @click="contextModal.tab='h2h'" :disabled="!contextModal.sporttery?.ok">历史交锋</button>
            <button :class="['ctx-tab', contextModal.tab==='tables'?'active':'']" @click="contextModal.tab='tables'" :disabled="!contextModal.sporttery?.ok">积分榜</button>
            <button :class="['ctx-tab', contextModal.tab==='future'?'active':'']" @click="contextModal.tab='future'" :disabled="!contextModal.sporttery?.ok">未来赛事</button>
            <button :class="['ctx-tab', contextModal.tab==='ai'?'active':'']" @click="contextModal.tab='ai'">AI 提示词</button>
          </div>
          <!-- Tab: 赔率（同步来的官方赔率） -->
          <div v-show="contextModal.tab==='odds'">
            <div class="odds-grid">
              <div v-for="(p, key) in parsePlays(contextModal.record?.handicap)" :key="key" v-show="p.pick" class="odds-cell">
                <div class="odds-cell-label">{{ playLabel(key) }}<span v-if="p.line" class="odds-cell-line">{{ p.line }}</span></div>
                <div class="odds-cell-pick">{{ p.pick }}</div>
                <div v-if="p.odds" class="odds-cell-odds">{{ formatOdds(p.odds) }}</div>
              </div>
            </div>
          </div>
          <!-- Tab: 特征分析（竞彩官方 6 维） -->
          <div v-show="contextModal.tab==='feature'">
            <div v-if="contextModal.sporttery?.error" class="muted">{{ contextModal.sporttery.error }}</div>
            <div v-else-if="!contextModal.sporttery?.feature" class="muted">竞彩暂无特征分析数据</div>
            <div v-else>
              <div v-for="(item, key) in featureList(contextModal.sporttery.feature)" :key="key" class="feature-row">
                <div class="feature-row-title">{{ item.title }}</div>
                <div class="feature-row-bars">
                  <div class="feature-bar"><span class="bar-home" :style="{width: item.homePct + '%'}"></span><span class="bar-text">{{ item.homeText }}</span></div>
                  <div class="feature-bar"><span class="bar-away" :style="{width: item.awayPct + '%'}"></span><span class="bar-text">{{ item.awayText }}</span></div>
                </div>
              </div>
            </div>
          </div>
          <!-- Tab: 历史交锋 -->
          <div v-show="contextModal.tab==='h2h'">
            <div v-if="!contextModal.sporttery?.history" class="muted">暂无历史交锋</div>
            <div v-else>
              <div class="muted mb-8" v-if="contextModal.sporttery.history.statistics">
                近{{ contextModal.sporttery.history.statistics.totalLegCnt || '?' }}场 胜 {{ contextModal.sporttery.history.statistics.winGoalMatchCnt }} 平 {{ contextModal.sporttery.history.statistics.drawMatchCnt }} 负 {{ contextModal.sporttery.history.statistics.lossGoalMatchCnt }}
              </div>
              <table class="h2h-table" v-if="contextModal.sporttery.history.matchList?.length">
                <thead><tr><th>日期</th><th>赛事</th><th>主队</th><th>比分</th><th>客队</th><th>总进球</th></tr></thead>
                <tbody>
                  <tr v-for="(m, i) in contextModal.sporttery.history.matchList.slice(0,20)" :key="i">
                    <td>{{ m.matchDate || '-' }}</td>
                    <td>{{ m.leagueAbbName || m.leagueName || '-' }}</td>
                    <td>{{ m.homeTeamShortName }}</td>
                    <td><b>{{ m.fullCourtGoal || '-' }}</b></td>
                    <td>{{ m.awayTeamShortName }}</td>
                    <td>{{ m.totalTeamFullCourtGoalCnt }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <!-- Tab: 积分榜 -->
          <div v-show="contextModal.tab==='tables'">
            <div v-if="!contextModal.sporttery?.tables" class="muted">暂无积分榜</div>
            <div v-else>
              <div v-for="(side, sideKey) in {homeTables:'主队',awayTables:'客队'}" :key="sideKey">
                <h4 class="mb-8">{{ side }}</h4>
                <table class="tables-table">
                  <thead><tr><th></th><th>场次</th><th>胜/平/负</th><th>胜率</th><th>进球</th><th>失球</th><th>净胜</th><th>积分</th><th>排名</th></tr></thead>
                  <tbody>
                    <tr v-for="(row, k) in ['total','home','away']" :key="k">
                      <td>{{ {total:'总',home:'主',away:'客'}[k] }}</td>
                      <td>{{ contextModal.sporttery.tables[sideKey]?.[row]?.totalLegCnt || '-' }}</td>
                      <td>{{ contextModal.sporttery.tables[sideKey]?.[row]?.winGoalMatchCnt }}/{{ contextModal.sporttery.tables[sideKey]?.[row]?.drawMatchCnt }}/{{ contextModal.sporttery.tables[sideKey]?.[row]?.lossGoalMatchCnt }}</td>
                      <td>{{ contextModal.sporttery.tables[sideKey]?.[row]?.winProbability || '-' }}</td>
                      <td>{{ contextModal.sporttery.tables[sideKey]?.[row]?.goalCnt || '-' }}</td>
                      <td>{{ contextModal.sporttery.tables[sideKey]?.[row]?.lossGoalCnt || '-' }}</td>
                      <td>{{ contextModal.sporttery.tables[sideKey]?.[row]?.netGoal || '-' }}</td>
                      <td><b>{{ contextModal.sporttery.tables[sideKey]?.[row]?.points || '-' }}</b></td>
                      <td>{{ contextModal.sporttery.tables[sideKey]?.[row]?.ranking || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <!-- Tab: 未来赛事 -->
          <div v-show="contextModal.tab==='future'">
            <div v-if="!contextModal.sporttery?.future" class="muted">暂无未来赛事</div>
            <div v-else>
              <div v-for="(side, sideKey) in {home:'主队未来',away:'客队未来'}" :key="sideKey">
                <h4 class="mb-8">{{ side }}</h4>
                <table class="h2h-table" v-if="contextModal.sporttery.future[sideKey]?.matchList?.length">
                  <thead><tr><th>日期</th><th>赛事</th><th>主队</th><th>客队</th></tr></thead>
                  <tbody>
                    <tr v-for="(m, i) in contextModal.sporttery.future[sideKey].matchList.slice(0,10)" :key="i">
                      <td>{{ (m.matchDateTime || '').slice(0,10) }}</td>
                      <td>{{ m.leagueAbbName || '-' }}</td>
                      <td>{{ m.homeTeamShortName }}</td>
                      <td>{{ m.awayTeamShortName }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="muted">暂无</div>
              </div>
            </div>
          </div>
          <!-- Tab: AI 提示词 -->
          <div v-show="contextModal.tab==='ai'">
            <div v-if="contextModal.loading" class="muted">加载中...</div>
            <div v-else-if="!contextModal.data || contextModal.data.error" class="muted">
              {{ contextModal.data?.error || 'AI 提示词需 football-data.org 或 API-Football 数据（API-Football 今日配额已耗尽）。点击下面按钮跳转到 AI 分析页手动输入基本信息。' }}
            </div>
            <div v-else class="ctx-block">
              <div class="ctx-row"><span class="ctx-key">积分榜</span><pre class="ctx-val">{{ JSON.stringify(contextModal.data.standings || '暂无', null, 2) }}</pre></div>
              <div class="ctx-row"><span class="ctx-key">近况</span><pre class="ctx-val">{{ JSON.stringify(contextModal.data.form || '暂无', null, 2) }}</pre></div>
              <div class="ctx-row"><span class="ctx-key">场均</span><pre class="ctx-val">{{ JSON.stringify(contextModal.data.stats || '暂无', null, 2) }}</pre></div>
              <div class="ctx-row"><span class="ctx-key">历史交锋</span><pre class="ctx-val">{{ JSON.stringify(contextModal.data.h2h || '暂无', null, 2) }}</pre></div>
            </div>
          </div>
          <div class="modal-foot">
            <a v-if="contextModal.record" :href="`/analysis/match?home=${encodeURIComponent(contextModal.record.home_team)}&away=${encodeURIComponent(contextModal.record.away_team)}&league=${encodeURIComponent(contextModal.record.league)}&date=${encodeURIComponent(contextModal.record.match_time)}`" target="_blank" class="btn btn-primary btn-sm">🤖 跳转到 AI 分析页</a>
            <button v-if="contextModal.sporttery?.detailUrl" @click="window.open(contextModal.sporttery.detailUrl, '_blank')" class="btn btn-ghost btn-sm">🔗 打开竞彩官网</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="editing" class="modal-mask" @click.self="editing = null">
      <div class="modal modal-large">
        <h3>修改扫盘数据 <span class="modal-hint">（修改时间会自动记录）</span></h3>
        <div class="form-row">
          <div class="form-group"><label>联赛</label><input v-model="editForm.league" /></div>
          <div class="form-group"><label>主队</label><input v-model="editForm.home_team" /></div>
          <div class="form-group"><label>客队</label><input v-model="editForm.away_team" /></div>
          <div class="form-group"><label>比赛日期</label><input v-model="editForm.match_date" type="date" /></div>
          <div class="form-group"><label>开赛时间（每5分钟）</label>
            <select v-model="editForm.match_time_slot">
              <option v-for="t in timeSlots" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="form-group"><label>场次编号</label>
            <div style="display:flex;gap:8px;align-items:center">
              <select v-model.number="editForm.weekday" style="width:120px">
                <option v-for="d in weekdays" :key="d.value" :value="d.value">{{ d.label }}</option>
              </select>
              <input v-model="editForm.match_no" placeholder="如 001" maxlength="4" style="width:80px" />
            </div>
          </div>
          <div class="form-group"><label>信心星级</label>
            <select v-model.number="editForm.confidence_stars">
              <option v-for="n in 5" :key="n" :value="n">{{ '★'.repeat(n) }}{{ '☆'.repeat(5-n) }}</option>
            </select>
          </div>
          <div class="form-group"><label>权限</label>
            <select v-model="editForm.tier_required">
              <option value="free">🆓 免费</option><option value="monthly">💎 月度</option><option value="yearly">👑 年度</option>
            </select>
          </div>
          <div class="form-group"><label>分类</label>
            <select v-model="editForm.category">
              <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
          </div>
          <div class="form-group"><label>详情页链接(会员专享)</label><input v-model="editForm.detail_url" placeholder="https://... 留空则无" /></div>
        </div>

        <!-- 各玩法：tag 多选 + 手动输入 -->
        <div class="block-title">各玩法推荐（点击选项可多选，用 / 拼接；也可手动输入）</div>
        <div class="plays-grid">
          <div class="play-item" v-for="play in playTypes" :key="play.key">
            <div class="play-head"><span class="play-name">{{ play.label }}</span></div>
            <div class="tag-options">
              <button v-for="o in play.options" :key="o" type="button"
                class="tag-btn" :class="{ active: isSel(editForm.plays[play.key].pickArr, o) }"
                @click="toggleTag(editForm.plays[play.key], o)">{{ o }}</button>
            </div>
            <div class="form-group compact" style="margin-top:6px">
              <label>当前选择</label>
              <input v-model="editForm.plays[play.key].pick" placeholder="手动输入或留空" />
            </div>
            <div class="form-group compact">
              <label>红黑</label>
              <select v-model="editForm.plays[play.key].result">
                <option v-for="r in RESULT_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
              </select>
            </div>
          </div>
          <!-- 让球 -->
          <div class="play-item play-handicap">
            <div class="play-head"><span class="play-name">让球</span></div>
            <div class="hc-block">
              <label class="hc-label">让几球</label>
              <div class="tag-options">
                <button v-for="l in HANDICAP_LINES" :key="l" type="button"
                  class="tag-btn" :class="{ active: isSel(editForm.plays.handicap.lineArr, l) }"
                  @click="toggleTag(editForm.plays.handicap, l, 'lineArr', 'line')">{{ l }}</button>
              </div>
            </div>
            <div class="hc-block">
              <label class="hc-label">结果</label>
              <div class="tag-options">
                <button v-for="r in HANDICAP_RESULTS" :key="r" type="button"
                  class="tag-btn" :class="{ active: isSel(editForm.plays.handicap.pickArr, r) }"
                  @click="toggleTag(editForm.plays.handicap, r, 'pickArr', 'pick')">{{ r }}</button>
              </div>
            </div>
            <div class="form-group compact" style="margin-top:6px">
              <label>让几球（显示）</label>
              <input v-model="editForm.plays.handicap.line" placeholder="自动拼接或手输" />
            </div>
            <div class="form-group compact">
              <label>结果（显示）</label>
              <input v-model="editForm.plays.handicap.pick" placeholder="自动拼接或手输" />
            </div>
            <div class="form-group compact">
              <label>红黑</label>
              <select v-model="editForm.plays.handicap.result">
                <option v-for="r in RESULT_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="saveEdit" class="btn btn-primary" :disabled="saving">{{ saving ? '保存中...' : '💾 保存修改' }}</button>
          <button @click="editing = null" class="btn btn-ghost">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/stores/auth'

const records = ref([])
const filter = ref('all')
const counts = ref({ all: 0, pending: 0, published: 0, settled: 0 })
const selectedIds = ref([])
const showCreate = ref(false)
const submitting = ref(false)
const submitMsg = ref(null)
// 赔率历史弹窗
const historyModal = ref({ open: false, record: null, list: [], loading: false })
// 基本信息弹窗
const contextModal = ref({ open: false, record: null, data: null, loading: false })

// ===== 玩法下拉选项定义 =====
const WDL_OPTIONS = ['胜', '平', '负']
const HANDICAP_LINES = ['+1', '+2', '+3', '+4', '-1', '-2', '-3', '-4']
const HANDICAP_RESULTS = ['让胜', '让平', '让负']
const SCORE_OPTIONS = ['1:0','2:0','2:1','3:0','3:1','3:2','4:0','4:1','4:2','5:0','5:1','5:2','胜其它','0:0','1:1','2:2','3:3','平其他','0:1','0:2','1:2','0:3','1:3','2:3','0:4','1:4','2:4','0:5','1:5','2:5','负其它']
const GOALS_OPTIONS = ['0','1','2','3','4','5','6','7+']
const HALF_FULL_OPTIONS = ['胜胜','胜平','胜负','平胜','平平','平负','负胜','负平','负负']
const RESULT_OPTIONS = [
  { value: 'pending', label: '⏳ 待定' },
  { value: 'win', label: '✅ 红' },
  { value: 'loss', label: '❌ 黑' },
  { value: 'push', label: '🔄 走' },
]

const playTypes = [
  { key: 'win_draw_loss', label: '胜平负', tag: '胜/平/负', options: WDL_OPTIONS },
  { key: 'score', label: '比分', tag: '精确比分', options: SCORE_OPTIONS },
  { key: 'goals', label: '进球', tag: '总进球', options: GOALS_OPTIONS },
  { key: 'half_full', label: '半全', tag: '半场/全场', options: HALF_FULL_OPTIONS },
]
const weekdays = [
  { value: 1, label: '周一' }, { value: 2, label: '周二' },
  { value: 3, label: '周三' }, { value: 4, label: '周四' },
  { value: 5, label: '周五' }, { value: 6, label: '周六' }, { value: 7, label: '周日' },
]
const categories = [
  { value: '人工扫盘', label: '人工扫盘（人工录入/上传）' },
  { value: 'AI扫盘', label: 'AI 扫盘（AI 分析生成）' },
  { value: '大神扫盘', label: '大神扫盘（专家推荐）' },
]

// ===== 多选 tag 逻辑 =====
function isSel(arr, val) { return Array.isArray(arr) && arr.includes(val) }
function toggleTag(playObj, val, arrKey, fieldKey) {
  // 默认操作 pickArr/pick
  const ak = arrKey || 'pickArr'
  const fk = fieldKey || 'pick'
  if (!Array.isArray(playObj[ak])) playObj[ak] = []
  const idx = playObj[ak].indexOf(val)
  if (idx >= 0) { playObj[ak].splice(idx, 1) }
  else { playObj[ak].push(val) }
  // 同步到文本字段（用 / 拼接）
  playObj[fk] = playObj[ak].join('/')
}

function emptyPlays() {
  const obj = {}
  playTypes.forEach(p => { obj[p.key] = { pick: '', result: 'pending', pickArr: [] } })
  obj.handicap = { pick: '', result: 'pending', line: '', pickArr: [], lineArr: [] }
  return obj
}

const form = ref({
  league: '', home_team: '', away_team: '',
  match_date: todayStr(), match_time_slot: '00:00',
  confidence_stars: 3, tier_required: 'free', plays: emptyPlays(),
  weekday: 1, match_no: '', category: '人工扫盘', detail_url: ''
})

const editing = ref(null)
const saving = ref(false)
const editForm = ref({ league: '', home_team: '', away_team: '', match_date: todayStr(), match_time_slot: '00:00', confidence_stars: 3, tier_required: 'free', plays: emptyPlays(), weekday: 1, match_no: '', category: '人工扫盘', detail_url: '' })

function tierTag(t) { return { free: '🆓', monthly: '💎', yearly: '👑' }[t] || t }
function catClass(c) { return { '人工扫盘': 'cat-manual', 'AI扫盘': 'cat-ai', '大神扫盘': 'cat-god' }[c] || 'cat-other' }
function statusLabel(s) { return { pending: '📝 草稿', published: '✅ 已发布', settled: '🏁 已结算' }[s] || s }
function playLabel(k) { return { win_draw_loss: '胜平负', handicap: '让球', score: '比分', goals: '进球', half_full: '半全' }[k] || k }
function resultDot(r) { return { win: '✅', loss: '❌', push: '🔄', pending: '⏳' }[r] || '-' }
function formatOdds(odds) {
  if (!odds || typeof odds !== 'object') return ''
  return Object.entries(odds).map(([k, val]) => `${k} ${val}`).join(' / ')
}
function parsePlays(h) {
  if (!h) return {}
  let v
  try { v = JSON.parse(h) } catch (e) { v = h }
  // 已经是期望的分组对象，直接返回（补齐 odds/line 字段）
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const out = {}
    for (const k of ['win_draw_loss','handicap','score','goals','half_full']) {
      out[k] = v[k] ? { pick: v[k].pick || '', result: v[k].result || 'pending', odds: v[k].odds, line: v[k].line } : { pick: '', result: 'pending' }
    }
    return out
  }
  // 新分组数组 [{key, pick, odds, line, result}] → 转成对象
  if (Array.isArray(v) && v.some(p => p && p.key)) {
    const out = { win_draw_loss:{pick:'',result:'pending'}, handicap:{pick:'',result:'pending'}, score:{pick:'',result:'pending'}, goals:{pick:'',result:'pending'}, half_full:{pick:'',result:'pending'} }
    for (const p of v) {
      if (!p || !p.key) continue
      out[p.key] = { pick: p.pick || '', result: p.result || 'pending', odds: p.odds, line: p.line }
    }
    return out
  }
  // 旧数组格式 [{pick, handicap, result}, ...] → 按玩法归类
  if (Array.isArray(v)) {
    const SCORE = ['1:0','2:0','2:1','3:0','3:1','3:2','4:0','4:1','4:2','5:0','5:1','5:2','胜其它','0:0','1:1','2:2','3:3','平其它','0:1','0:2','1:2','0:3','1:3','2:3','0:4','1:4','2:4','0:5','1:5','2:5','负其它']
    const GOALS = ['0','1','2','3','4','5','6','7+']
    const HF = ['胜胜','胜平','胜负','平胜','平平','平负','负胜','负平','负负']
    const out = { win_draw_loss: { pick: '', result: 'pending' }, handicap: { pick: '', result: 'pending' }, score: { pick: '', result: 'pending' }, goals: { pick: '', result: 'pending' }, half_full: { pick: '', result: 'pending' } }
    const wdlPicks = [], hcPicks = [], hcLines = [], scorePicks = [], goalPicks = [], hfPicks = []
    for (const p of v) {
      const pick = String(p.pick || '')
      const result = p.result || 'pending'
      if (pick === '胜' || pick === '平' || pick === '负') wdlPicks.push({ pick, result })
      else if (pick.startsWith('让')) { hcPicks.push({ pick, result }); if (p.handicap != null && p.handicap !== '') hcLines.push(String(p.handicap)) }
      else if (SCORE.includes(pick)) scorePicks.push({ pick, result })
      else if (GOALS.includes(pick)) goalPicks.push({ pick, result })
      else if (HF.includes(pick)) hfPicks.push({ pick, result })
    }
    // 取最后一个 result（模拟多选最后一项）
    const pickWithResult = arr => arr.length ? arr.map(x => x.pick).join('/') + (arr.some(x => x.result !== 'pending') ? ' · ' + arr[arr.length-1].result : '') : ''
    if (wdlPicks.length) { out.win_draw_loss.pick = wdlPicks.map(x=>x.pick).join('/'); out.win_draw_loss.result = wdlPicks[wdlPicks.length-1].result }
    if (hcPicks.length) { out.handicap.pick = hcLines.length ? hcLines.join('/') + ' ' + hcPicks.map(x=>x.pick).join('/') : hcPicks.map(x=>x.pick).join('/'); out.handicap.result = hcPicks[hcPicks.length-1].result }
    if (scorePicks.length) { out.score.pick = scorePicks.map(x=>x.pick).join('/'); out.score.result = scorePicks[scorePicks.length-1].result }
    if (goalPicks.length) { out.goals.pick = goalPicks.map(x=>x.pick).join('/'); out.goals.result = goalPicks[goalPicks.length-1].result }
    if (hfPicks.length) { out.half_full.pick = hfPicks.map(x=>x.pick).join('/'); out.half_full.result = hfPicks[hfPicks.length-1].result }
    return out
  }
  return { handicap: { pick: String(v), result: 'pending' } }
}
function formatTime(t) { if (!t) return '-'; return new Date(t).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) }
function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleString('zh-CN', { year:'2-digit', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) }
function weekdayLabel(w) { return {1:'周一',2:'周二',3:'周三',4:'周四',5:'周五',6:'周六',7:'周日'}[w]||'' }
function todayStr() { const d = new Date(); const p = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}` }
function genTimeSlots() { const a = []; for (let h=0; h<24; h++) for (let m=0; m<60; m+=5) a.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`); return a }
const timeSlots = genTimeSlots()
function officialScore(r) {
  if (!r.official_result) return ''
  try { const o = typeof r.official_result === 'string' ? JSON.parse(r.official_result) : r.official_result; if (o && o.home_score != null) return `${o.home_score}-${o.away_score}` } catch (e) {}
  return ''
}

// 把 pickArr 同步到 pick（用户可能手改了 pick 文本，但提交前确保 tag 操作的最新值生效）
function syncPlaysForSubmit(plays) {
  const out = JSON.parse(JSON.stringify(plays))
  // 普通玩法
  playTypes.forEach(p => {
    if (out[p.key] && out[p.key].pickArr && out[p.key].pickArr.length) {
      out[p.key].pick = out[p.key].pickArr.join('/')
    }
    delete out[p.key].pickArr
  })
  // 让球
  if (out.handicap) {
    if (out.handicap.lineArr && out.handicap.lineArr.length) {
      out.handicap.line = out.handicap.lineArr.join('/')
    }
    if (out.handicap.pickArr && out.handicap.pickArr.length) {
      out.handicap.pick = out.handicap.pickArr.join('/')
    }
    // 合并 line + pick -> pick
    const line = (out.handicap.line || '').trim()
    const pick = (out.handicap.pick || '').trim()
    out.handicap.pick = line ? (pick ? `${line} ${pick}` : line) : pick
    delete out.handicap.lineArr
    delete out.handicap.pickArr
    delete out.handicap.line
  }
  return out
}

// 从 pick 文本拆出 pickArr（编辑模式回填）
function splitToArr(pickText) {
  if (!pickText) return []
  return String(pickText).split('/').map(s => s.trim()).filter(Boolean)
}

async function loadCounts() {
  try {
    for (const s of ['all', 'pending', 'published', 'settled']) {
      const { data } = await api.get('/admin/sweep', { params: { status: s === 'all' ? undefined : s, limit: 1 } })
      counts.value[s] = data.total
    }
  } catch (e) { console.error(e) }
}

async function loadRecords() {
  try {
    const params = { limit: 100 }
    if (filter.value !== 'all') params.status = filter.value
    const { data } = await api.get('/admin/sweep', { params })
    records.value = data.records
    selectedIds.value = []
    await loadCounts()
  } catch (e) { console.error(e) }
}

async function submitDraft() {
  submitting.value = true; submitMsg.value = null
  try {
    const plays = syncPlaysForSubmit(form.value.plays)
    const payload = {
      league: form.value.league, home_team: form.value.home_team, away_team: form.value.away_team,
      match_time: `${form.value.match_date}T${form.value.match_time_slot}:00`, confidence_stars: form.value.confidence_stars,
      tier_required: form.value.tier_required, odds_type: 'multi',
      handicap: JSON.stringify(plays), odds: 0, result: 'pending',
      weekday: form.value.weekday, match_no: form.value.match_no,
      category: form.value.category, detail_url: form.value.detail_url || null
    }
    const settled = Object.values(plays).filter(p => p.result !== 'pending')
    if (settled.length > 0) {
      const wins = settled.filter(p => p.result === 'win').length
      const losses = settled.filter(p => p.result === 'loss').length
      if (wins > losses) payload.result = 'win'
      else if (losses > wins) payload.result = 'loss'
      else payload.result = 'push'
    }
    await api.post('/admin/sweep', payload)
    submitMsg.value = { text: '已保存为草稿，可点击"发布"上线', error: false }
    form.value = { league: '', home_team: '', away_team: '', match_date: todayStr(), match_time_slot: '00:00', confidence_stars: 3, tier_required: 'free', plays: emptyPlays(), weekday: 1, match_no: '', category: '人工扫盘', detail_url: '' }
    await loadRecords()
  } catch (e) { submitMsg.value = { text: e.response?.data?.error || '保存失败', error: true } }
  finally { submitting.value = false }
}

async function publish(id) {
  if (!confirm('确认发布？发布后会员可查看。')) return
  try { await api.post(`/admin/sweep/${id}/publish`); await loadRecords() }
  catch (e) { alert('发布失败: ' + e.message) }
}

async function unpublish(id) {
  if (!confirm('撤回后会员将无法查看，确认？')) return
  try { await api.post(`/admin/sweep/${id}/unpublish`, {}); await loadRecords() }
  catch (e) { alert('撤回失败: ' + e.message) }
}

function editRecord(r) {
  editing.value = r.id
  const plays = parsePlays(r.handicap)
  const filled = emptyPlays()
  Object.keys(plays).forEach(k => {
    if (filled[k]) {
      filled[k] = { ...plays[k], result: plays[k].result || 'pending' }
      // 回填 pickArr
      filled[k].pickArr = splitToArr(plays[k].pick)
    }
  })
  // 让球：从 pick 中拆出 line（+1/+2... 开头）和 result
  if (filled.handicap) {
    const rawPick = (filled.handicap.pick || '').trim()
    const m = rawPick.match(/^([+\d\/\-]+)\s*(.*)$/)
    if (m) {
      filled.handicap.line = m[1]
      filled.handicap.pick = m[2] || ''
      filled.handicap.lineArr = splitToArr(m[1])
      filled.handicap.pickArr = splitToArr(m[2])
    } else {
      filled.handicap.line = ''
      filled.handicap.lineArr = []
      filled.handicap.pickArr = splitToArr(rawPick)
    }
  }
  const mt = (r.match_time || '').replace(' ', 'T').split('T')
  const ed = mt[0] ? mt[0].substring(0, 10) : todayStr()
  const et = mt[1] ? mt[1].substring(0, 5) : '00:00'
  editForm.value = { league: r.league, home_team: r.home_team, away_team: r.away_team, match_date: ed, match_time_slot: et, confidence_stars: r.confidence_stars, tier_required: r.tier_required, plays: filled, weekday: r.weekday || 1, match_no: r.match_no || '', category: r.category || '人工扫盘', detail_url: r.detail_url || '' }
}

async function saveEdit() {
  saving.value = true
  try {
    const plays = syncPlaysForSubmit(editForm.value.plays)
    const payload = { league: editForm.value.league, home_team: editForm.value.home_team, away_team: editForm.value.away_team, match_time: `${editForm.value.match_date}T${editForm.value.match_time_slot}:00`, confidence_stars: editForm.value.confidence_stars, tier_required: editForm.value.tier_required, handicap: JSON.stringify(plays), result: 'pending', weekday: editForm.value.weekday, match_no: editForm.value.match_no, category: editForm.value.category, detail_url: editForm.value.detail_url || null }
    await api.put(`/admin/sweep/${editing.value}`, payload)
    editing.value = null
    await loadRecords()
  } catch (e) { alert('保存失败: ' + e.message) }
  finally { saving.value = false }
}

async function removeRecord(id) {
  if (!confirm('确认删除？此操作不可恢复。')) return
  try { await api.delete(`/admin/sweep/${id}`); await loadRecords() }
  catch (e) { alert('删除失败: ' + e.message) }
}

async function batchPublish() {
  if (!confirm(`确认发布选中的 ${selectedIds.value.length} 条数据？`)) return
  try { await api.post('/admin/sweep/batch-publish', { ids: selectedIds.value }); await loadRecords() }
  catch (e) { alert('批量发布失败: ' + e.message) }
}

async function batchDelete() {
  if (!confirm(`确认删除选中的 ${selectedIds.value.length} 条数据？`)) return
  for (const id of selectedIds.value) {
    try { await api.delete(`/admin/sweep/${id}`) } catch (e) {}
  }
  await loadRecords()
}

const uploading = ref(false)
const uploadResult = ref(null)

const fetching = ref(false)

// 显示赔率变化历史
async function showHistory(r) {
  historyModal.value = { open: true, record: r, list: [], loading: true }
  try {
    const { data } = await api.get(`/admin/sweep/${r.id}/odds-history`)
    historyModal.value.list = data.history || []
  } catch (e) {
    historyModal.value.list = []
  } finally {
    historyModal.value.loading = false
  }
}
// 渲染胜平负列
function renderPlaysMini(h) {
  if (!h) return '-'
  let arr; try { arr = JSON.parse(h) } catch(e) { return h.slice(0, 60) }
  if (!Array.isArray(arr)) return '-'
  const wdl = arr.find(p => p.key === 'win_draw_loss')
  if (wdl) {
    const odds = wdl.odds ? ' ' + formatOdds(wdl.odds) : ''
    return (wdl.pick || '-') + odds
  }
  const old = arr.filter(p => ['胜','平','负'].includes(String(p.pick))).map(p => p.pick).join('/')
  return old || '-'
}
// 渲染让球盘口
function renderHandicapLine(h) {
  if (!h) return '-'
  let arr; try { arr = JSON.parse(h) } catch(e) { return '-' }
  if (!Array.isArray(arr)) return '-'
  const hc = arr.find(p => p.key === 'handicap')
  if (hc) {
    const odds = hc.odds ? ' ' + formatOdds(hc.odds) : ''
    const line = hc.line ? hc.line + ' ' : ''
    return line + (hc.pick || '-') + odds
  }
  const old = arr.filter(p => String(p.pick || '').startsWith('让'))
  if (!old.length) return '-'
  const lines = [...new Set(old.map(p => p.handicap).filter(Boolean))].join('/')
  const picks = [...new Set(old.map(p => p.pick))].join('/')
  return lines ? `${lines} ${picks}` : picks
}
// 渲染比分/进球/半全
function renderOtherPlays(h) {
  if (!h) return '-'
  let arr; try { arr = JSON.parse(h) } catch(e) { return '-' }
  if (!Array.isArray(arr)) return '-'
  const get = k => arr.find(p => p.key === k)
  const score = get('score'), goals = get('goals'), hf = get('half_full')
  if (score || goals || hf) {
    const parts = []
    if (score) parts.push(`比分${score.odds ? ' ' + formatOdds(score.odds) : ''}`)
    if (goals) parts.push(`进球${goals.odds ? ' ' + formatOdds(goals.odds) : ''}`)
    if (hf) parts.push(`半全${hf.odds ? ' ' + formatOdds(hf.odds) : ''}`)
    return parts.join(' · ')
  }
  const SCORE = ['1:0','2:0','2:1','3:0','3:1','3:2','4:0','4:1','4:2','5:0','5:1','5:2','胜其它','0:0','1:1','2:2','3:3','平其它','0:1','0:2','1:2','0:3','1:3','2:3','0:4','1:4','2:4','0:5','1:5','2:5','负其它']
  const GOALS = ['0','1','2','3','4','5','6','7+']
  const HF = ['胜胜','胜平','胜负','平胜','平平','平负','负胜','负平','负负']
  const scores = arr.filter(p => SCORE.includes(p.pick)).map(p => p.pick)
  const goalsA = arr.filter(p => GOALS.includes(p.pick)).map(p => p.pick)
  const hfa = arr.filter(p => HF.includes(p.pick)).map(p => p.pick)
  return [scores.length && `比分${scores.length}`, goalsA.length && `进球${goalsA.length}`, hfa.length && `半全${hfa.length}`].filter(Boolean).join(' · ') || '-'
}

// 显示基本信息（供 AI 提示词用）
async function showContext(r) {
  contextModal.value = { open: true, record: r, data: null, loading: true, sporttery: null, tab: 'odds' }
  try {
    const { data } = await api.get(`/admin/sweep/${r.id}/context`)
    contextModal.value.data = data.context
  } catch (e) {
    contextModal.value.data = { error: e.response?.data?.error || e.message }
  }
  // 同时拉竞彩详情
  try {
    const { data: sdata } = await api.get(`/admin/sweep/${r.id}/sporttery-context`)
    contextModal.value.sporttery = sdata
  } catch (e) { contextModal.value.sporttery = { error: e.message } }
  contextModal.value.loading = false
}

function openSporttery(r) {
  const id = r.sporttery_match_id
  const url = id
    ? `https://www.sporttery.cn/jc/zqdz/index.html?showType=2&mid=${id}`
    : `https://www.sporttery.cn/jc/zqdz/index.html?showType=2&gm=${r.wbsj_match_id}`
  window.open(url, '_blank')
}

// 特征分析（6 维 bar chart）
function featureList(d) {
  if (!d) return []
  // d = { last: {home/away}, sameHomeAway: ..., eachHomeAway: ..., eachSameHomeAway: ..., homeFeature, awayFeature }
  const fmt = (s) => {
    if (!s) return null
    const total = parseInt(s.totalLegCnt || s.totalLeg || 0)
    const wins = parseInt(s.winGoalMatchCnt || 0)
    const draws = parseInt(s.drawMatchCnt || 0)
    const losses = parseInt(s.lossGoalMatchCnt || 0)
    const pct = (n) => total > 0 ? Math.round(n * 100 / total) : 0
    return { homeText: `${wins}胜${draws}平${losses}负 (${total}场)`, awayText: `${losses}胜${draws}平${wins}负 (${total}场)`, homePct: pct(wins), awayPct: pct(losses) }
  }
  const items = [
    { key: 'last', title: '近10场战绩' },
    { key: 'sameHomeAway', title: '同主客场近况' },
    { key: 'eachHomeAway', title: '主客交锋' },
    { key: 'eachSameHomeAway', title: '同主客交锋' }
  ]
  const rows = []
  for (const it of items) {
    const f = fmt(d[it.key])
    if (f) rows.push({ title: it.title, ...f })
  }
  // 场均进失球
  if (d.homeFeature || d.awayFeature) {
    const hf = d.homeFeature || {}
    const af = d.awayFeature || {}
    rows.push({
      title: '场均进球',
      homeText: `${hf.avgGoal || '-'}个`, awayText: `${af.avgGoal || '-'}个`,
      homePct: parseFloat(hf.avgGoal || 0) * 30, awayPct: parseFloat(af.avgGoal || 0) * 30
    })
    rows.push({
      title: '场均失球',
      homeText: `${hf.avgLossGoal || '-'}个`, awayText: `${af.avgLossGoal || '-'}个`,
      homePct: parseFloat(hf.avgLossGoal || 0) * 30, awayPct: parseFloat(af.avgLossGoal || 0) * 30
    })
  }
  return rows
}

async function fetchResult(id) {
  fetching.value = true
  try {
    const { data } = await api.post(`/admin/sweep/${id}/fetch-result`)
    if (data.success) {
      const label = data.sweepResult === 'win' ? '红单 ✅' : data.sweepResult === 'loss' ? '黑单 ❌' : data.sweepResult === 'push' ? '走盘 🔄' : '待定'
      alert(`获取成功：${label}`)
    }
    await loadRecords()
  } catch (e) { alert('获取失败: ' + (e.response?.data?.error || e.message)) }
  finally { fetching.value = false }
}
async function batchFetch() {
  if (!confirm('确认对所有未结算比赛批量获取官网结果？')) return
  fetching.value = true
  try {
    const { data } = await api.post('/admin/sweep/batch-fetch-result')
    alert(`批量获取完成：成功 ${data.fetched} 条，跳过 ${data.skipped} 条`)
    await loadRecords()
  } catch (e) { alert('批量获取失败: ' + (e.response?.data?.error || e.message)) }
  finally { fetching.value = false }
}

const uploadFile = ref(null)
const uploadInput = ref(null)
const autoPublish = ref(false)

function onFileChange(e) {
  const f = e.target.files && e.target.files[0]
  uploadFile.value = f || null
  uploadResult.value = null
}

async function downloadTemplate() {
  try {
    const { data } = await api.get('/admin/upload/template', { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url; a.download = 'sweep_template.xlsx'; a.click()
    URL.revokeObjectURL(url)
  } catch (e) { alert('下载模板失败: ' + (e.response?.data?.error || e.message)) }
}

async function handleUpload() {
  if (!uploadFile.value) { uploadResult.value = { error: true, text: '请先选择 Excel / CSV / JSON 文件' }; return }
  uploading.value = true; uploadResult.value = null
  try {
    const fd = new FormData()
    fd.append('file', uploadFile.value)
    fd.append('publish', autoPublish.value ? '1' : '0')
    const { data } = await api.post('/admin/upload/sweep', fd)
    uploadResult.value = { error: false, text: `✅ ${data.message}`, errors: data.errors || [] }
    uploadFile.value = null
    if (uploadInput.value) uploadInput.value.value = ''
    await loadRecords()
  } catch (e) {
    uploadResult.value = { error: true, text: e.response?.data?.error || '上传失败' }
  } finally { uploading.value = false }
}

onMounted(loadRecords)
</script>

<style scoped>
.page { max-width: 1200px; margin: 0 auto; padding: 40px 24px; }
.back-link { color: #58A6FF; font-size: 13px; display: inline-block; margin-bottom: 8px; }
.page-header h1 { font-size: 28px; margin-bottom: 8px; }
.page-header p { color: #8B949E; font-size: 14px; margin-bottom: 24px; }

.action-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
.filter-tabs { display: flex; gap: 4px; margin-left: auto; }
.filter-tabs button { padding: 6px 14px; border-radius: 6px; border: 1px solid #30363D; background: transparent; color: #8B949E; cursor: pointer; font-size: 13px; }
.filter-tabs button.active { background: #21262D; color: #58A6FF; border-color: #58A6FF; }

.upload-card { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
.upload-card h3 { font-size: 15px; margin-bottom: 16px; }

.sheet-card { border-color: #1F6FEB44; }
.sheet-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.sheet-tip { color: #8B949E; font-size: 13px; line-height: 1.6; margin: 8px 0 16px; }
.sheet-row { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
.file-input { color: #C9D1D9; font-size: 13px; max-width: 280px; }
.publish-toggle { color: #C9D1D9; font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.file-name { color: #58A6FF; font-size: 13px; }
.err-list { margin: 8px 0 0; padding-left: 18px; color: #F85149; font-size: 12px; }
.err-list li { margin: 2px 0; }

.form-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 12px; }
.form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
.form-group label { font-size: 12px; color: #8B949E; }
.form-group input, .form-group select, .form-group textarea { padding: 9px 12px; background: #0D1117; border: 1px solid #30363D; border-radius: 8px; color: #E6EDF3; font-size: 14px; outline: none; font-family: inherit; }
.form-group.compact input, .form-group.compact select { padding: 7px 10px; font-size: 13px; }

.block-title { font-size: 13px; font-weight: 700; color: #E6EDF3; margin: 16px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #21262D; }

.plays-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
.play-item { background: #0D1117; border: 1px solid #21262D; border-radius: 8px; padding: 10px 12px; }
.play-handicap { grid-column: span 2; }
.play-head { display: flex; justify-content: space-between; margin-bottom: 6px; }
.play-name { font-size: 13px; font-weight: 700; color: #E6EDF3; }
.play-tag { font-size: 10px; color: #8B949E; }

.tag-options { display: flex; flex-wrap: wrap; gap: 4px; }
.tag-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid #30363D; background: transparent; color: #8B949E; cursor: pointer; font-size: 12px; transition: all 0.12s; user-select: none; }
.tag-btn:hover { border-color: #58A6FF; color: #C9D1D9; }
.tag-btn.active { background: #58A6FF; color: #0D1117; border-color: #58A6FF; font-weight: 600; }

.hc-block { margin-bottom: 6px; }
.hc-label { font-size: 11px; color: #8B949E; display: block; margin-bottom: 4px; }

.result-msg { padding: 12px; border-radius: 8px; font-size: 13px; margin: 12px 0; }
.result-msg.success { background: rgba(63,185,80,0.1); border: 1px solid #3FB950; color: #3FB950; }
.result-msg.error { background: rgba(248,81,73,0.1); border: 1px solid #F85149; color: #F85149; }

.records-list { display: flex; flex-direction: column; gap: 10px; }
.list-item { display: flex; gap: 16px; padding: 16px; background: #161B22; border: 1px solid #21262D; border-radius: 10px; align-items: flex-start; }
.list-item:hover { border-color: #30363D; }
.checkbox { margin-top: 12px; width: 16px; height: 16px; cursor: pointer; }
.item-main { flex: 1; }
.item-top { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
.league-tag { font-size: 11px; color: #58A6FF; font-weight: 600; }
.match-teams { font-size: 14px; font-weight: 600; }
.time { font-size: 12px; color: #8B949E; }
.stars { display: flex; gap: 1px; }
.star { color: #30363D; font-size: 12px; }
.star.active { color: #F0883E; }
.tier-tag { font-size: 13px; }
.cat-tag { font-size: 10px; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
.cat-manual { background: rgba(88,166,255,0.15); color: #58A6FF; }
.cat-ai { background: rgba(163,113,247,0.15); color: #A371F7; }
.cat-god { background: rgba(255,191,46,0.15); color: #FFBF2E; }
.cat-other { background: rgba(139,148,158,0.15); color: #8B949E; }

.status-badge { font-size: 11px; padding: 3px 10px; border-radius: 10px; font-weight: 500; margin-left: auto; }
.status-badge.pending { background: rgba(240,136,62,0.15); color: #F0883E; }
.status-badge.published { background: rgba(63,185,80,0.15); color: #3FB950; }
.status-badge.settled { background: rgba(88,166,255,0.15); color: #58A6FF; }
.official-badge { font-size: 11px; padding: 3px 10px; border-radius: 10px; font-weight: 500; font-family: 'JetBrains Mono', monospace; margin-left: 8px; background: rgba(63,185,80,0.12); color: #3FB950; }
.official-badge.loss { background: rgba(248,81,73,0.12); color: #F85149; }
.official-badge.push { background: rgba(139,148,158,0.12); color: #8B949E; }

.item-plays { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.play-line { display: flex; gap: 6px; align-items: center; font-size: 11px; padding: 3px 8px; border-radius: 4px; background: rgba(33,38,45,0.5); }
.play-line.win { background: rgba(63,185,80,0.1); }
.play-line.loss { background: rgba(248,81,73,0.1); }
.play-line.push { background: rgba(139,148,158,0.1); }
.play-label { color: #8B949E; font-weight: 600; min-width: 32px; }
.play-pick { color: #E6EDF3; font-family: 'JetBrains Mono', monospace; }
.play-result { font-size: 11px; }

.item-meta { display: flex; gap: 16px; font-size: 11px; color: #8B949E; flex-wrap: wrap; padding-top: 6px; border-top: 1px solid #21262D; }
.published-at { color: #3FB950; }

.item-actions { display: flex; flex-direction: column; gap: 6px; min-width: 90px; }

.empty { text-align: center; color: #8B949E; padding: 40px; }

.btn { display: inline-flex; align-items: center; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.15s; }
.btn-sm { padding: 6px 10px; font-size: 12px; }
.btn-primary { background: #58A6FF; color: #0D1117; }
.btn-success { background: #3FB950; color: #0D1117; }
.btn-primary:disabled, .btn-success:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost { background: transparent; color: #8B949E; border: 1px solid #30363D; }
.btn-ghost:hover { border-color: #58A6FF; color: #58A6FF; }
.btn-ghost.danger:hover { color: #F85149; border-color: #F85149; }

.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #161B22; border: 1px solid #30363D; border-radius: 12px; padding: 24px; width: 90%; max-width: 500px; }
.modal-lg { max-width: 800px; max-height: 90vh; overflow-y: auto; }
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.modal-head h3 { font-size: 16px; margin: 0; }
.btn-close { background: transparent; border: none; color: #8B949E; font-size: 24px; cursor: pointer; padding: 0 8px; line-height: 1; }
.btn-close:hover { color: #58A6FF; }
.modal-body { font-size: 13px; }
.modal-foot { margin-top: 16px; padding-top: 12px; border-top: 1px solid #21262D; }
.modal-large { max-width: 700px; max-height: 90vh; overflow-y: auto; }
.modal h3 { font-size: 16px; margin-bottom: 16px; }
.modal-hint { font-size: 12px; color: #8B949E; font-weight: 400; }
.modal-actions { display: flex; gap: 12px; margin-top: 16px; }

.muted { color: #8B949E; }
.mb-8 { margin-bottom: 8px; }
.odds-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.odds-table th, .odds-table td { padding: 8px; border-bottom: 1px solid #21262D; text-align: left; vertical-align: top; }
.odds-table th { color: #8B949E; font-weight: 600; }
.odds-table tbody tr:hover { background: #0D1117; }
.cell-mini { font-size: 12px; color: #C9D1D9; }

.ctx-block { display: flex; flex-direction: column; gap: 12px; }
.ctx-row { background: #0D1117; border: 1px solid #21262D; border-radius: 6px; padding: 10px; }
.ctx-key { display: block; font-size: 12px; color: #58A6FF; margin-bottom: 6px; font-weight: 600; }
.ctx-val { margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #C9D1D9; white-space: pre-wrap; max-height: 180px; overflow-y: auto; }

.odds-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.odds-cell { background: #0D1117; border: 1px solid #21262D; border-radius: 6px; padding: 8px 10px; min-width: 120px; }
.odds-cell-label { font-size: 11px; color: #58A6FF; font-weight: 600; margin-bottom: 4px; }
.odds-cell-line { color: #8B949E; font-weight: 400; margin-left: 4px; }
.odds-cell-pick { font-size: 13px; color: #C9D1D9; margin-bottom: 4px; }
.odds-cell-odds { font-size: 12px; color: #3FB950; font-family: 'JetBrains Mono', monospace; }

.play-odds { font-size: 11px; color: #3FB950; font-family: 'JetBrains Mono', monospace; margin-left: 6px; }
.play-line-tag { font-size: 11px; color: #8B949E; }

/* 历史赔率弹窗中的 odds 渲染 */
.cell-odds { font-size: 11px; color: #3FB950; font-family: 'JetBrains Mono', monospace; }

.mono { font-family: 'JetBrains Mono', monospace; }

/* 基本信息弹窗：Tab + 竞彩特征分析/历史交锋/积分榜 */
.ctx-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid #21262D; padding-bottom: 10px; }
.ctx-tab { background: #0D1117; border: 1px solid #21262D; color: #8B949E; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; }
.ctx-tab:hover:not(:disabled) { border-color: #58A6FF; color: #C9D1D9; }
.ctx-tab.active { background: #1F6FEB; border-color: #1F6FEB; color: #fff; }
.ctx-tab:disabled { opacity: 0.4; cursor: not-allowed; }

.feature-row { margin-bottom: 12px; }
.feature-row-title { font-size: 13px; color: #C9D1D9; font-weight: 600; margin-bottom: 6px; }
.feature-row-bars { display: flex; flex-direction: column; gap: 4px; }
.feature-bar { position: relative; background: #0D1117; border-radius: 4px; height: 20px; overflow: hidden; font-size: 10px; }
.feature-bar .bar-home { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(63,185,80,0.35); }
.feature-bar .bar-away { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(248,81,73,0.35); }
.feature-bar .bar-text { position: absolute; left: 6px; top: 0; line-height: 20px; color: #C9D1D9; z-index: 1; font-family: 'JetBrains Mono', monospace; }

.h2h-table, .tables-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
.h2h-table th, .tables-table th { background: #161B22; color: #8B949E; padding: 6px 4px; text-align: center; font-weight: 600; }
.h2h-table td, .tables-table td { padding: 5px 4px; border-top: 1px solid #21262D; text-align: center; color: #C9D1D9; font-family: 'JetBrains Mono', monospace; }
.h2h-table td:nth-child(2), .h2h-table td:nth-child(3), .h2h-table td:nth-child(5) { text-align: left; }

@media (max-width: 768px) {
  .play-handicap { grid-column: span 1; }
  .ctx-tabs { overflow-x: auto; flex-wrap: nowrap; }
  .h2h-table, .tables-table { display: block; overflow-x: auto; }
}
</style>
