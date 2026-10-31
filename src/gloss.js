// 蛊码 GuCode · 状态和效果的名字与说明。全游戏只用这一套名字（洞府、秘境、试阵、斗幽灵、蛊典、战斗画面共用），纯数据 + 纯函数，不 import 任何文件。
//   GLOSS            每个词一行：{ id 引擎里的键, n 名字, kind 'buff' 增益 | 'debuff' 减益 | 'act' 招式效果 | 'rule' 战斗规则 | 'term' 说明用词, col 图标颜色, d 一句大白话 }
//   GL / GL_BY_NAME  按 id、按名字查
//   ST_NAME          引擎状态键 → 名字（战斗画面蛊身上的小牌子、战斗记录、悬停都用它）
//   glossHTML(text)  把一段纯文字转义成 HTML，并给里面的这些词加虚下划线（.gl，悬停或点一下看说明，ui.js 的提示框接 data-tip-fn="gl"）
//   glossNote(text)  这段文字里出现了哪些词，逐个写「名字 · 增益或减益：说明」（悬停提示框里用：提示框本身不能再悬停，就把说明直接列在下面）
//   glossTip(id)     一个词的提示框内容
//   glossTable()     「状态说明」整张表（战斗画面顶部的按钮、蛊典的「状态说明」分区共用）
// 界面一律写「增益（对它有利）」「减益（对它不利）」，不写英文。改名字只改这里和数据文案，不动数值。
export const GL_KIND = { buff: '增益（对它有利）', debuff: '减益（对它不利）', act: '招式效果（当场生效，不挂在身上）', rule: '战斗规则', term: '说明' };
export const GLOSS = [
  { id: 'debuffs', n: '减益', kind: 'term', d: '挂在蛊身上、对它不利的状态，比如灼烧、中毒、冰寒、眩晕。写着「清掉减益」的效果能把它们一次清掉。' },
  { id: 'buffs', n: '增益', kind: 'term', d: '挂在蛊身上、对它有利的状态，比如格挡、护体、嘲讽。' },
  { id: 'burn', n: '灼烧', kind: 'debuff', col: '#c2501f', d: '每轮开始掉血，持续几轮；再挂一次取伤害更高、轮数更长的那个，不叠加。护体挡不住。' },
  { id: 'psn', n: '中毒', kind: 'debuff', col: '#3d7a33', d: '每轮开始掉血，再挂就越叠越多（最多约最大血量的四分之一），不会自己消失。护体挡不住。' },
  { id: 'para', n: '寄生', kind: 'debuff', col: '#4f6e2a', d: '虫卵在身上安了家：每轮开始掉血，不会自己消失，有的还会削攻。护体挡不住。' },
  { id: 'chill', n: '冰寒', kind: 'debuff', col: '#3d78a8', d: '每层速度 -15%，叠到 3 层就冻住一次（层数清空）；每轮退一层。' },
  { id: 'freeze', n: '冻住', kind: 'debuff', col: '#5f93c0', d: '冰寒叠满 3 层时触发：跳过下一次出手（算一次眩晕）。' },
  { id: 'stun', n: '眩晕', kind: 'debuff', col: '#6a5a8a', d: '跳过接下来几次出手（最多攒 4 次），每轮到它出手就用掉一次。' },
  { id: 'web', n: '落网', kind: 'debuff', col: '#6e6a5e', d: '接下来几次普攻落空，主动技照放。' },
  { id: 'mark', n: '印记', kind: 'debuff', col: '#a8352c', d: '持续几轮：受到敌方的伤害 +25%。' },
  { id: 'seal', n: '封印', kind: 'debuff', col: '#5a5244', d: '持续几轮：蛊力不涨，攒不满就放不出主动技。' },
  { id: 'grd', n: '格挡', kind: 'buff', col: '#8a7434', d: '接下来几次挨敌方打，伤害减半，每挨一次用掉一次。和护体不同：格挡是减半，护体是先扣一层护盾。' },
  { id: 'sh', n: '护体', kind: 'buff', col: '#9a7a2a', d: '一层护盾：挨打时先扣护体，扣完才掉血。灼烧、中毒、寄生和破甲的伤害绕过护体。' },
  { id: 'taunt', n: '嘲讽', kind: 'buff', col: '#8a5a2a', d: '持续几轮：敌方的单体攻击优先打它，替队友挡刀。' },
  { id: 'crit', n: '暴击', kind: 'act', col: '#b8402a', d: '这一下伤害 ×1.5。普攻有 10% 机会暴击，有的技能另写暴击率。' },
  { id: 'pierce', n: '破甲', kind: 'act', col: '#8a4a3a', d: '这一下的伤害不被护体挡，直接打在血上。' },
  { id: 'knock', n: '击退', kind: 'act', col: '#7a5a34', d: '把目标往后推一格；身后被挡住或到了边上就撞上，双方都受一点伤。' },
  { id: 'draw', n: '拉近', kind: 'act', col: '#7a5a34', d: '把目标往前拉一格；身前被挡住就撞上，双方都受一点伤。' },
  { id: 'summon', n: '召唤', kind: 'act', col: '#7a62a0', d: '在空格里召出小蛊帮忙打；阵盘满了就召不出，召唤物打完这一场就散。' },
  { id: 'eat', n: '吞噬', kind: 'act', col: '#6a3a5a', d: '把血量不多的敌蛊（一般是三成以下）或任意召唤物直接吞掉，自己得到它一部分攻血。' },
  { id: 'doom', n: '天劫压阵', kind: 'rule', col: '#4a4038', d: '打到第 20 轮还没分出胜负，双方每轮都掉血，越往后越多，护体挡不住，免得两边互相回血拖到最后。' },
];
export const GL = Object.fromEntries(GLOSS.map(g => [g.id, g]));
export const GL_BY_NAME = Object.fromEntries(GLOSS.map(g => [g.n, g]));
export const ST_NAME = { psn: '中毒', para: '寄生', burn: '灼烧', chill: '冰寒', freeze: '冻住', stun: '眩晕', web: '落网', grd: '格挡', guard: '格挡', mark: '印记', seal: '封印', taunt: '嘲讽', sh: '护体', crit: '暴击', doom: '天劫压阵', summon: '召唤' };
export const ST_COLOR = Object.fromEntries(Object.entries(ST_NAME).map(([k, n]) => [k, (GL_BY_NAME[n] || {}).col || '#5a5244']));

const glEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const GL_NAMES = GLOSS.map(g => g.n).sort((a, b) => b.length - a.length);
const GL_RE = new RegExp(GL_NAMES.join('|'), 'g');
export const glossKind = g => GL_KIND[g.kind] || '';
// 纯文字 → 转义后的 HTML，词加虚下划线。opts.tip === false 时只描下划线、不挂提示（提示框里面用）
export function glossHTML(text, opts = {}) {
  const tip = opts.tip !== false;
  return glEsc(text).replace(GL_RE, n => { const g = GL_BY_NAME[n]; return `<u class="gl gl-${g.kind}" data-gl="${g.id}"${tip ? ' data-tip-fn="gl" tabindex="0"' : ''}>${n}</u>`; });
}
export const glossFound = text => { const seen = []; String(text || '').replace(GL_RE, n => { if (!seen.includes(n)) seen.push(n); return n; }); return seen.map(n => GL_BY_NAME[n]); };
// 提示框底下的小注：出现了哪些词就写哪些（同一段只写一次）
export function glossNote(text, max = 4) {
  const list = glossFound(text).filter(g => g.kind !== 'term').slice(0, max); if (!list.length) return '';
  return `<div class="glnote">${list.map(g => `<p><b class="glic" style="background:${g.col}">${g.n}</b><i>${glEsc(g.kind === 'buff' ? '增益' : g.kind === 'debuff' ? '减益' : g.kind === 'rule' ? '规则' : '效果')}</i>${glEsc(g.d)}</p>`).join('')}</div>`;
}
export function glossTip(id) {
  const g = GL[id] || GL_BY_NAME[id]; if (!g) return '';
  return `<b>${g.n}</b> <span class="glk gl-${g.kind}">${glEsc(glossKind(g))}</span><br>${glEsc(g.d)}`;
}
export function glossTable() {
  const row = g => `<li><b class="glic" style="background:${g.col || '#5a5244'}">${g.n}</b><span class="glk gl-${g.kind}">${glEsc(glossKind(g))}</span><p>${glEsc(g.d)}</p></li>`;
  const sec = (k, h) => { const L = GLOSS.filter(g => g.kind === k); return L.length ? `<h5>${glEsc(h)}</h5><ul class="gltab">${L.map(row).join('')}</ul>` : ''; };
  return `<div class="glossary"><p class="sm">蛊身上挂的状态分两种：<b>增益</b>是对它有利的，<b>减益</b>是对它不利的。战斗里蛊身下沿的小牌子写着状态名和数字（层数、次数、轮数或每轮掉多少血），一格放不下的合成「+几」，悬停或点一下蛊能看全部。文字里带虚线的词，悬停或点一下也能看说明。</p>`
    + sec('debuff', '减益（对它不利）') + sec('buff', '增益（对它有利）') + sec('act', '招式效果（当场生效，不挂在身上）') + sec('rule', '战斗规则') + '</div>';
}
