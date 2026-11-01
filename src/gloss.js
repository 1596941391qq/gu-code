// 蛊码 GuCode · 状态和效果的名字与说明。全游戏只用这一套名字（洞府、秘境、试阵、斗幽灵、蛊典、战斗画面共用），纯数据 + 纯函数，不 import 任何文件。
//   GLOSS            每个词一行：{ id 引擎里的键, n 名字, kind 'buff' 增益 | 'debuff' 减益 | 'act' 招式效果 | 'rule' 战斗规则 | 'term' 说明用词, col 图标颜色, d 一句大白话 }
//   GL / GL_BY_NAME  按 id、按名字查
//   ST_NAME          引擎状态键 → 名字（战斗画面蛊身上的小牌子、战斗记录、悬停都用它）
//   glossHTML(text)  把一段纯文字转义成 HTML，并给里面的这些词加虚下划线（.gl，悬停或点一下看说明，ui.js 的提示框接 data-tip-fn="gl"）
//   glossNote(text)  这段文字里出现了哪些词，逐个写「名字 · 增益或减益：说明」（悬停提示框里用：提示框本身不能再悬停，就把说明直接列在下面）
//   glossTip(id)     一个词的提示框内容
//   glossTable()     「状态说明」整张表（战斗画面顶部的按钮、蛊典的「状态说明」分区共用）
// 界面写「增益」「减益」，不写英文；状态说明表的分区标题写明「对它有利 / 不利」。改名字只改这里和数据文案，不动数值。
export const GL_KIND = { buff: '增益', debuff: '减益', act: '效果', rule: '规则', term: '说明' };
// 写法照卡牌游戏的状态说明：只写机制和数字。X = 蛊身上小牌子的数。「敌蛊的伤害」= 普攻、技能、撞击，不含灼烧、中毒、寄生、天劫压阵。数字照 battle.js / bestiary.js 写，改数值时同步改这里
export const GLOSS = [
  { id: 'debuffs', n: '减益', kind: 'term', d: '对它不利的状态：灼烧、中毒、寄生、冰寒、眩晕、落网、印记、封印。「清掉减益」会清除这些，以及临时被削的攻和速度。' },
  { id: 'buffs', n: '增益', kind: 'term', d: '对它有利的状态：护体、格挡、嘲讽。' },
  { id: 'burn', n: '灼烧', kind: 'debuff', col: '#c2501f', d: '每轮开始受到固定伤害，持续 X 轮。伤害在挂上时按施放者的攻算好，之后不变。重复挂上：伤害、轮数各取较大值，不叠加。无视护体。' },
  { id: 'psn', n: '中毒', kind: 'debuff', col: '#3d7a33', d: '每轮开始失去 X 点血，不会消退。重复挂上：X 叠加，上限为最大血量的 25%（不低于 60）。无视护体。' },
  { id: 'para', n: '寄生', kind: 'debuff', col: '#4f6e2a', d: '每轮开始失去 X 点血，不会消退，叠加和上限同中毒。部分寄生另外每轮攻 -8%。无视护体。' },
  { id: 'chill', n: '冰寒', kind: 'debuff', col: '#3d78a8', d: '每层速度 -15%。叠到 3 层：清空，并冻住。每轮开始退 1 层。' },
  { id: 'freeze', n: '冻住', kind: 'debuff', col: '#5f93c0', d: '冰寒叠到 3 层时触发：眩晕 1 次。' },
  { id: 'stun', n: '眩晕', kind: 'debuff', col: '#6a5a8a', d: '跳过接下来 X 次出手。最多 4 次。' },
  { id: 'web', n: '落网', kind: 'debuff', col: '#6e6a5e', d: '接下来 X 次普攻落空。不影响主动技。' },
  { id: 'mark', n: '印记', kind: 'debuff', col: '#a8352c', d: '受到敌蛊的伤害 +25%，持续 X 轮。重复挂上取较大轮数。' },
  { id: 'seal', n: '封印', kind: 'debuff', col: '#5a5244', d: '蛊力不增长，持续 X 轮。重复挂上取较大轮数。' },
  { id: 'sh', n: '护体', kind: 'buff', col: '#9a7a2a', d: '受到伤害先扣护体，扣完再扣血。整场不消失，上限为最大血量的 2 倍（不低于 990）。灼烧、中毒、寄生、破甲、天劫压阵无视护体。' },
  { id: 'grd', n: '格挡', kind: 'buff', col: '#8a7434', d: '接下来 X 次受到敌蛊的伤害减半。重复挂上叠加次数。' },
  { id: 'taunt', n: '嘲讽', kind: 'buff', col: '#8a5a2a', d: '敌方的普攻和单体技能只能打它，持续 X 轮。重复挂上取较大轮数。' },
  { id: 'crit', n: '暴击', kind: 'act', col: '#b8402a', d: '这次伤害 ×1.5。普攻暴击率 10%，技能的暴击率写在技能里。' },
  { id: 'pierce', n: '破甲', kind: 'act', col: '#8a4a3a', d: '这次伤害无视护体。' },
  { id: 'knock', n: '击退', kind: 'act', col: '#7a5a34', d: '目标后退一格。身后有蛊：不动，它和身后那只各受一次撞击伤害；已在最后一列：不动，它受一次撞击伤害。撞击伤害 = 施放者攻的 40%（技能另写的按技能）。' },
  { id: 'draw', n: '拉近', kind: 'act', col: '#7a5a34', d: '目标前进一格。身前有蛊：不动，它和身前那只各受一次撞击伤害，伤害同击退。已在第一列：没有效果。' },
  { id: 'summon', n: '召唤', kind: 'act', col: '#7a62a0', d: '在己方空格放出一只召唤物，攻、血按召唤者的攻、最大血量折算（比例写在技能里）。己方已有 9 只时召唤失败。召唤物只存在于本场战斗。' },
  { id: 'eat', n: '吞噬', kind: 'act', col: '#6a3a5a', d: '吞掉血量不高于 30% 的敌蛊，或任意召唤物；施放者获得它 30% 的攻和最大血量（技能另写的按技能）。被吞掉算阵亡。' },
  { id: 'gp', n: '蛊力', kind: 'rule', col: '#b08a2a', d: '攒满 100：下一次出手改放主动技，然后清零。开战 20；每次出手 +34；近战被身前友蛊挡住时 +60；受到敌蛊的伤害 +15。' },
  { id: 'doom', n: '天劫压阵', kind: 'rule', col: '#4a4038', d: '第 20 轮起，每轮开始所有蛊失去最大血量的 10% ×（轮数 − 19）：第 20 轮 10%，第 21 轮 20%，依此类推。无视护体。' },
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
  const row = g => `<li><b class="glic" style="background:${g.col || '#5a5244'}">${g.n}</b><p>${glEsc(g.d)}</p></li>`;
  const sec = (k, h) => { const L = GLOSS.filter(g => g.kind === k); return L.length ? `<h5>${glEsc(h)}</h5><ul class="gltab">${L.map(row).join('')}</ul>` : ''; };
  return `<div class="glossary"><p class="sm">X = 蛊身上小牌子的数字。每轮开始：先结算灼烧、中毒、寄生、天劫压阵，再把按轮计的状态减 1、冰寒退 1 层。「敌蛊的伤害」指普攻、技能和撞击，不含灼烧、中毒、寄生。</p>`
    + sec('debuff', '减益 · 对它不利') + sec('buff', '增益 · 对它有利') + sec('act', '效果 · 当场生效') + sec('rule', '规则') + '</div>';
}
