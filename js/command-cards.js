/**
 * 指令卡模組 (Command Cards Module)
 * 完整依據手冊第 9、10 頁「指令卡的定義」建置所有 63 種指令卡（含套件數量、功能描述、使用限制與 SVG 圖示）
 */
(function (global) {
  'use strict';

  const CATEGORIES = [
    { id: 'all', name: '全部指令卡', icon: '🧩' },
    { id: 'control', name: '起點與終點', icon: '🏁' },
    { id: 'function', name: '函式起點', icon: '⭐' },
    { id: 'condition', name: '條件與事件', icon: '🔀' },
    { id: 'loop', name: '簡單迴圈', icon: '🔁' },
    { id: 'motion', name: '移動與暫停', icon: '⬆️' },
    { id: 'gear', name: '輸出齒輪', icon: '⚙️' },
    { id: 'sound', name: '播放音效', icon: '🔊' },
    { id: 'light_color', name: '燈光顏色', icon: '💡' },
    { id: 'light_fx', name: '燈光效果', icon: '✨' },
    { id: 'number', name: '數字卡 1-9', icon: '🔢' }
  ];

  // 共用 SVG 產生輔助函式
  function svgWrap(bg, inner, borderColor) {
    const stroke = borderColor || 'rgba(0,0,0,0.16)';
    return `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" class="card-svg">
      <rect x="2" y="2" width="76" height="76" rx="12" fill="${bg}" stroke="${stroke}" stroke-width="3"/>
      ${inner}
    </svg>`;
  }

  function starPath(cx, cy, rOuter, rInner) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return d + 'Z';
  }

  function funcStartSvg(starColor, strokeColor) {
    return svgWrap('#b7d346', `
      <rect x="14" y="14" width="52" height="52" rx="8" fill="#d9ea89" stroke="#ffffff" stroke-width="2.5"/>
      <path d="${starPath(40, 41, 20, 8.5)}" fill="${starColor}" stroke="${strokeColor}" stroke-width="2.5"/>
      <path d="M12,18 L24,18 M12,18 L12,30" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
      <polygon points="62,62 62,50 50,62" fill="${starColor}" opacity="0.85"/>
    `);
  }

  function lightBulbSvg(bulbColor, innerExtra, isRainbow) {
    const fillAttr = isRainbow ? 'url(#rainbowGrad)' : bulbColor;
    const defs = isRainbow ? `
      <defs>
        <linearGradient id="rainbowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ef4444"/>
          <stop offset="20%" stop-color="#f97316"/>
          <stop offset="40%" stop-color="#eab308"/>
          <stop offset="60%" stop-color="#22c55e"/>
          <stop offset="80%" stop-color="#3b82f6"/>
          <stop offset="100%" stop-color="#a855f7"/>
        </linearGradient>
      </defs>` : '';
    return svgWrap('#a3c639', `
      ${defs}
      <g stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.9">
        <line x1="40" y1="8" x2="40" y2="14"/>
        <line x1="17" y1="18" x2="22" y2="23"/>
        <line x1="63" y1="18" x2="58" y2="23"/>
        <line x1="11" y1="38" x2="17" y2="38"/>
        <line x1="69" y1="38" x2="63" y2="38"/>
      </g>
      <path d="M25,37 C25,27 32,20 40,20 C48,20 55,27 55,37 C55,44 50,48 48,54 L32,54 C30,48 25,44 25,37 Z"
            fill="${fillAttr}" stroke="#ffffff" stroke-width="2.8"/>
      <rect x="33" y="55" width="14" height="5" rx="2" fill="#e5e7eb" stroke="#4b5563" stroke-width="1.5"/>
      <rect x="35" y="61" width="10" height="5" rx="2" fill="#9ca3af" stroke="#4b5563" stroke-width="1.5"/>
      ${innerExtra || ''}
    `);
  }

  function lightFxSvg(symbolSvg) {
    return svgWrap('#9dc42f', `
      <path d="M27,36 C27,27 33,21 40,21 C47,21 53,27 53,36 C53,42 49,46 47,51 L33,51 C31,46 27,42 27,36 Z"
            fill="#a855f7" stroke="#ffffff" stroke-width="2.5"/>
      <rect x="34" y="52" width="12" height="5" rx="2" fill="#e5e7eb" stroke="#4b5563" stroke-width="1.5"/>
      <rect x="36" y="58" width="8" height="4" rx="2" fill="#9ca3af"/>
      ${symbolSvg}
    `);
  }

  function numberSvg(num) {
    return svgWrap('#6b7280', `
      <rect x="10" y="10" width="60" height="60" rx="10" fill="#525866" stroke="#d1d5db" stroke-width="2" stroke-dasharray="4 3"/>
      <text x="40" y="55" text-anchor="middle" font-family="Nunito, Arial, sans-serif" font-weight="900" font-size="42" fill="#ffffff">${num}</text>
    `);
  }

  const COMMAND_CARDS = [
    // ==================== 起點與終點 ====================
    {
      id: 'start',
      name: '起點',
      shortName: '起點',
      category: 'control',
      qty: 4,
      color: '#f59e0b',
      acceptsNumber: false,
      allowedIn: ['main'],
      description: '每個主程式的一開頭都必須使用這張起點指令卡。這張起點指令卡只能在主程式中使用。',
      svg: svgWrap('#f59e0b', `
        <path d="M18,58 L18,20 L58,20 L50,32 L58,44 L18,44" fill="#ffffff" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/>
        <line x1="18" y1="18" x2="18" y2="64" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
        <text x="36" y="36" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="11" fill="#d97706">START</text>
      `)
    },
    {
      id: 'end',
      name: '終點',
      shortName: '終點',
      category: 'control',
      qty: 10,
      color: '#dc2626',
      acceptsNumber: false,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '每個程式的結尾都必須使用這張終點指令卡。這張結束指令卡可以在主程式和函式中使用。',
      svg: svgWrap('#dc2626', `
        <polygon points="24,18 58,18 58,48 41,48 41,62 24,62" fill="#ffffff" opacity="0.22"/>
        <path d="M22,64 L22,18 L58,18 L58,44 L22,44" fill="#ffffff" stroke="#991b1b" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="26" y="22" width="8" height="8" fill="#dc2626"/>
        <rect x="42" y="22" width="8" height="8" fill="#dc2626"/>
        <rect x="34" y="30" width="8" height="8" fill="#dc2626"/>
        <rect x="50" y="30" width="6" height="8" fill="#dc2626"/>
        <line x1="22" y1="16" x2="22" y2="65" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
      `)
    },

    // ==================== 函式起點 ====================
    {
      id: 'func_red',
      name: '紅色函式起點卡',
      shortName: '紅函式',
      category: 'function',
      qty: 2,
      color: '#ef4444',
      funcColor: 'red',
      acceptsNumber: false,
      allowedIn: ['func_red'],
      description: '紅色函式必須使用此卡作為起點。當機器人以與基地卡箭頭相同的方向進入紅色星星格時，會自動前進一步進基地並執行此函式，結束後自動退回星星記號處繼續執行主程式。',
      svg: funcStartSvg('#ef4444', '#991b1b')
    },
    {
      id: 'func_green',
      name: '綠色函式起點卡',
      shortName: '綠函式',
      category: 'function',
      qty: 2,
      color: '#22c55e',
      funcColor: 'green',
      acceptsNumber: false,
      allowedIn: ['func_green'],
      description: '綠色函式必須使用此卡作為起點。當機器人以與基地卡箭頭相同的方向進入綠色星星格時，會自動前進一步進基地並執行此函式，結束後自動退回星星記號處繼續執行主程式。',
      svg: funcStartSvg('#22c55e', '#166534')
    },
    {
      id: 'func_blue',
      name: '藍色函式起點卡',
      shortName: '藍函式',
      category: 'function',
      qty: 2,
      color: '#3b82f6',
      funcColor: 'blue',
      acceptsNumber: false,
      allowedIn: ['func_blue'],
      description: '藍色函式必須使用此卡作為起點。當機器人以與基地卡箭頭相同的方向進入藍色星星格時，會自動前進一步進基地並執行此函式，結束後自動退回星星記號處繼續執行主程式。',
      svg: funcStartSvg('#3b82f6', '#1e40af')
    },

    // ==================== 條件與事件 ====================
    {
      id: 'if',
      name: '如果 (條件語句元素)',
      shortName: '如果 IF',
      category: 'condition',
      qty: 2,
      color: '#e11d74',
      acceptsNumber: false,
      allowedIn: ['condition'],
      description: '這張指令卡是一個條件語句（IF-THEN）功能的起點卡。當機器人掃描到滿足條件的事件卡時，就會執行函式。',
      svg: svgWrap('#e11d74', `
        <path d="M16,18 L64,18 L54,32 L64,46 L16,46 Z" fill="#ffffff" opacity="0.18"/>
        <text x="40" y="50" text-anchor="middle" font-family="Nunito, Arial, sans-serif" font-weight="900" font-size="30" fill="#ffffff">IF</text>
        <text x="40" y="67" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="11" fill="#fce7f3">如果</text>
      `)
    },
    {
      id: 'do',
      name: '執行 (條件語句元素)',
      shortName: '執行 DO',
      category: 'condition',
      qty: 2,
      color: '#db2777',
      acceptsNumber: false,
      allowedIn: ['condition'],
      description: '這張指令卡只能在條件語句中使用。如果滿足條件時，會執行在這張指令卡之後的指令序列。',
      svg: svgWrap('#db2777', `
        <circle cx="40" cy="36" r="24" fill="#ffffff" opacity="0.18"/>
        <text x="40" y="47" text-anchor="middle" font-family="Nunito, Arial, sans-serif" font-weight="900" font-size="27" fill="#ffffff">DO</text>
        <text x="40" y="67" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="11" fill="#fce7f3">執行</text>
      `)
    },
    {
      id: 'else',
      name: '否則 (條件語句元素)',
      shortName: '否則 ELSE',
      category: 'condition',
      qty: 2,
      color: '#be185d',
      acceptsNumber: false,
      allowedIn: ['condition'],
      description: '這張指令卡只能在條件語句中使用。如果無法滿足條件時，會執行在這張指令卡之後的指令序列。備註：這幾張卡（前進、後退、右轉、左轉與暫停）不能放在否則卡的後面。',
      svg: svgWrap('#be185d', `
        <rect x="12" y="18" width="56" height="34" rx="8" fill="#ffffff" opacity="0.18"/>
        <text x="40" y="43" text-anchor="middle" font-family="Nunito, Arial, sans-serif" font-weight="900" font-size="21" fill="#ffffff">ELSE</text>
        <text x="40" y="67" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="11" fill="#fce7f3">否則</text>
      `)
    },
    {
      id: 'and',
      name: '以及 (條件元素)',
      shortName: '以及 AND',
      category: 'condition',
      qty: 1,
      color: '#ec4899',
      acceptsNumber: false,
      allowedIn: ['condition'],
      description: '這張指令卡只能在條件語句中使用。如果在條件語句中出現這張「以及」卡時，表示必須滿足兩個條件才會執行函式。',
      svg: svgWrap('#ec4899', `
        <circle cx="32" cy="34" r="15" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.7"/>
        <circle cx="48" cy="34" r="15" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.7"/>
        <text x="40" y="43" text-anchor="middle" font-family="Nunito, Arial, sans-serif" font-weight="900" font-size="20" fill="#ffffff">AND</text>
        <text x="40" y="67" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="11" fill="#fdf2f8">以及</text>
      `)
    },
    {
      id: 'or',
      name: '或者 (條件元素)',
      shortName: '或者 OR',
      category: 'condition',
      qty: 1,
      color: '#f472b6',
      acceptsNumber: false,
      allowedIn: ['condition'],
      description: '這張指令卡只能在條件語句中使用。如果在條件語句中出現這張「或者」卡時，表示只需要滿足兩個條件的任一個條件就能執行函式。',
      svg: svgWrap('#f472b6', `
        <path d="M18,26 L36,36 L18,46 M62,26 L44,36 L62,46" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.5"/>
        <text x="40" y="45" text-anchor="middle" font-family="Nunito, Arial, sans-serif" font-weight="900" font-size="25" fill="#ffffff">OR</text>
        <text x="40" y="67" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="11" fill="#fdf2f8">或者</text>
      `)
    },
    {
      id: 'event_1',
      name: '事件1 (條件語句元素)',
      shortName: '事件1 星',
      category: 'condition',
      qty: 1,
      color: '#c026d3',
      eventId: 'event_1',
      acceptsNumber: false,
      allowedIn: ['condition'],
      description: '在條件語句副程式中會使用這張指令卡。這張事件卡定義了必須滿足的條件是什麼，並在滿足條件時，就會執行函式。機器人必須掃描到對應圖案的地圖卡（五角星）。',
      svg: svgWrap('#c026d3', `
        <circle cx="40" cy="38" r="24" fill="none" stroke="#ffffff" stroke-width="3"/>
        <path d="${starPath(40, 38, 17, 7.5)}" fill="#ffffff"/>
        <text x="64" y="21" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="13" fill="#ffffff">1</text>
      `)
    },
    {
      id: 'event_2',
      name: '事件2 (條件語句元素)',
      shortName: '事件2 閃爆',
      category: 'condition',
      qty: 1,
      color: '#c026d3',
      eventId: 'event_2',
      acceptsNumber: false,
      allowedIn: ['condition'],
      description: '在條件語句副程式中會使用這張指令卡。這張事件卡定義了必須滿足的條件是什麼，並在滿足條件時，就會執行函式。機器人必須掃描到對應圖案的地圖卡（閃電火花）。',
      svg: svgWrap('#c026d3', `
        <polygon points="40,12 46,28 63,21 52,36 66,46 49,48 53,65 40,53 27,65 31,48 14,46 28,36 17,21 34,28" fill="#ffffff"/>
        <polygon points="40,22 44,32 54,28 47,37 55,44 45,45 47,54 40,47 33,54 35,45 25,44 33,37 26,28 36,32" fill="#c026d3"/>
        <text x="64" y="21" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="13" fill="#ffffff">2</text>
      `)
    },
    {
      id: 'event_3',
      name: '事件3 (條件語句元素)',
      shortName: '事件3 漩渦',
      category: 'condition',
      qty: 1,
      color: '#c026d3',
      eventId: 'event_3',
      acceptsNumber: false,
      allowedIn: ['condition'],
      description: '在條件語句副程式中會使用這張指令卡。這張事件卡定義了必須滿足的條件是什麼，並在滿足條件時，就會執行函式。機器人必須掃描到對應圖案的地圖卡（漩渦）。',
      svg: svgWrap('#c026d3', `
        <path d="M40,40 C40,34 48,34 48,40 C48,49 32,49 32,38 C32,25 54,25 54,40 C54,57 24,57 24,38 C24,18 60,18 60,40"
              fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round"/>
        <text x="64" y="21" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="13" fill="#ffffff">3</text>
      `)
    },
    {
      id: 'event_4',
      name: '事件4 (條件語句元素)',
      shortName: '事件4 愛心',
      category: 'condition',
      qty: 1,
      color: '#c026d3',
      eventId: 'event_4',
      acceptsNumber: false,
      allowedIn: ['condition'],
      description: '在條件語句副程式中會使用這張指令卡。這張事件卡定義了必須滿足的條件是什麼，並在滿足條件時，就會執行函式。機器人必須掃描到對應圖案的地圖卡（愛心）。',
      svg: svgWrap('#c026d3', `
        <path d="M40,60 C40,60 16,45 16,30 C16,21 23,16 30,16 C35,16 38,19 40,23 C42,19 45,16 50,16 C57,16 64,21 64,30 C64,45 40,60 40,60 Z"
              fill="#ffffff"/>
        <text x="64" y="21" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="13" fill="#ffffff">4</text>
      `)
    },

    // ==================== 簡單迴圈 ====================
    {
      id: 'loop_green_start',
      name: '綠色簡單迴圈起點卡',
      shortName: '綠迴圈起',
      category: 'loop',
      qty: 2,
      pairTotalQty: 4,
      color: '#eab308',
      loopColor: 'green',
      loopRole: 'start',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這兩張卡（起點與終點）可以讓您決定想要重複執行的指令是什麼，將指令序列放置在這兩張卡之間，若在第一張迴圈卡後面放置一張數字卡，代表該迴圈重複執行的次數。',
      svg: svgWrap('#facc15', `
        <path d="M26,24 L52,24 C60,24 64,30 64,38 L64,44 C64,52 58,56 50,56 L26,56" fill="none" stroke="#16a34a" stroke-width="6" stroke-linecap="round"/>
        <polygon points="34,15 16,24 34,33" fill="#16a34a"/>
        <circle cx="24" cy="56" r="6" fill="#16a34a"/>
        <text x="41" y="45" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="13" fill="#14532d">起點</text>
      `)
    },
    {
      id: 'loop_green_end',
      name: '綠色簡單迴圈終點卡',
      shortName: '綠迴圈終',
      category: 'loop',
      qty: 2,
      pairTotalQty: 4,
      color: '#eab308',
      loopColor: 'green',
      loopRole: 'end',
      acceptsNumber: false,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '綠色簡單迴圈的終點卡，必須與綠色迴圈起點卡成對使用。注意：數字卡只能放在迴圈起點卡後面，不能放在迴圈終點卡後面。',
      svg: svgWrap('#facc15', `
        <path d="M54,24 L28,24 C20,24 16,30 16,38 L16,44 C16,52 22,56 30,56 L54,56" fill="none" stroke="#16a34a" stroke-width="6" stroke-linecap="round"/>
        <polygon points="46,47 64,56 46,65" fill="#16a34a"/>
        <rect x="50" y="18" width="10" height="12" rx="2" fill="#16a34a"/>
        <text x="39" y="45" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="13" fill="#14532d">終點</text>
      `)
    },
    {
      id: 'loop_red_start',
      name: '紅色簡單迴圈起點卡',
      shortName: '紅迴圈起',
      category: 'loop',
      qty: 2,
      pairTotalQty: 4,
      color: '#eab308',
      loopColor: 'red',
      loopRole: 'start',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這兩張卡（起點與終點）可以讓您決定想要重複執行的指令是什麼，將指令序列放置在這兩張卡之間，若在第一張迴圈卡後面放置一張特定次數的數字卡，代表會重複執行的次數。',
      svg: svgWrap('#facc15', `
        <path d="M26,24 L52,24 C60,24 64,30 64,38 L64,44 C64,52 58,56 50,56 L26,56" fill="none" stroke="#dc2626" stroke-width="6" stroke-linecap="round"/>
        <polygon points="34,15 16,24 34,33" fill="#dc2626"/>
        <circle cx="24" cy="56" r="6" fill="#dc2626"/>
        <text x="41" y="45" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="13" fill="#7f1d1d">起點</text>
      `)
    },
    {
      id: 'loop_red_end',
      name: '紅色簡單迴圈終點卡',
      shortName: '紅迴圈終',
      category: 'loop',
      qty: 2,
      pairTotalQty: 4,
      color: '#eab308',
      loopColor: 'red',
      loopRole: 'end',
      acceptsNumber: false,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '紅色簡單迴圈的終點卡，必須與紅色迴圈起點卡成對使用。可與綠色迴圈搭配組成雙層巢狀迴圈。',
      svg: svgWrap('#facc15', `
        <path d="M54,24 L28,24 C20,24 16,30 16,38 L16,44 C16,52 22,56 30,56 L54,56" fill="none" stroke="#dc2626" stroke-width="6" stroke-linecap="round"/>
        <polygon points="46,47 64,56 46,65" fill="#dc2626"/>
        <rect x="50" y="18" width="10" height="12" rx="2" fill="#dc2626"/>
        <text x="39" y="45" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="13" fill="#7f1d1d">終點</text>
      `)
    },

    // ==================== 移動與暫停 ====================
    {
      id: 'forward',
      name: '前進',
      shortName: '前進',
      category: 'motion',
      qty: 24,
      color: '#2563eb',
      acceptsNumber: true,
      forbiddenAfterElse: true,
      allowedIn: ['main', 'condition'],
      description: '這張指令卡代表機器人向前移動一個地圖卡。只能在主程式中使用這張卡（條件語句中不能放在否則卡後面）。在程式序列中，若這張卡的後方有數字卡，則表示重複執行前進的次數。',
      svg: svgWrap('#2563eb', `
        <path d="M40,14 L62,38 L49,38 L49,64 L31,64 L31,38 L18,38 Z" fill="#ffffff"/>
      `)
    },
    {
      id: 'backward',
      name: '後退',
      shortName: '後退',
      category: 'motion',
      qty: 24,
      color: '#2563eb',
      acceptsNumber: true,
      forbiddenAfterElse: true,
      allowedIn: ['main', 'condition'],
      description: '這張指令卡代表機器人向後移動一個地圖卡。只能在主程式中使用這張卡（條件語句中不能放在否則卡後面）。在程式序列中，若這張卡的後方有數字卡，則表示重複執行後退的次數。',
      svg: svgWrap('#2563eb', `
        <path d="M40,66 L62,42 L49,42 L49,16 L31,16 L31,42 L18,42 Z" fill="#ffffff"/>
      `)
    },
    {
      id: 'turn_right',
      name: '右轉（順時針）',
      shortName: '右轉 90°',
      category: 'motion',
      qty: 18,
      color: '#2563eb',
      acceptsNumber: true,
      forbiddenAfterElse: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡命令機器人向右轉動90度。在程式序列中，若這張卡的後方有數字卡，則表示重複執行向右轉的次數。',
      svg: svgWrap('#2563eb', `
        <path d="M24,60 L24,38 C24,28 31,24 41,24 L50,24" fill="none" stroke="#ffffff" stroke-width="11" stroke-linecap="round"/>
        <polygon points="46,11 67,24 46,37" fill="#ffffff"/>
      `)
    },
    {
      id: 'turn_left',
      name: '左轉（逆時針）',
      shortName: '左轉 90°',
      category: 'motion',
      qty: 18,
      color: '#2563eb',
      acceptsNumber: true,
      forbiddenAfterElse: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡命令機器人向左轉動90度。在程式序列中，若這張卡的後方有數字卡，則表示重複執行向左轉的次數。',
      svg: svgWrap('#2563eb', `
        <path d="M56,60 L56,38 C56,28 49,24 39,24 L30,24" fill="none" stroke="#ffffff" stroke-width="11" stroke-linecap="round"/>
        <polygon points="34,11 13,24 34,37" fill="#ffffff"/>
      `)
    },
    {
      id: 'wait',
      name: '暫停',
      shortName: '暫停 1秒',
      category: 'motion',
      qty: 4,
      color: '#1d4ed8',
      acceptsNumber: true,
      forbiddenAfterElse: true,
      allowedIn: ['main', 'condition'],
      description: '這張指令卡命令機器人暫停一秒鐘。這張卡只能在主程式中使用（條件語句中不能放在否則卡後面）。在程式序列中，若這張卡的後方有數字卡，則表示暫停幾秒鐘。',
      svg: svgWrap('#1d4ed8', `
        <rect x="22" y="14" width="36" height="6" rx="3" fill="#ffffff"/>
        <rect x="22" y="60" width="36" height="6" rx="3" fill="#ffffff"/>
        <path d="M26,20 L54,20 L43,40 L54,60 L26,60 L37,40 Z" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round"/>
        <polygon points="32,26 48,26 40,37" fill="#93c5fd"/>
        <polygon points="34,58 46,58 40,48" fill="#93c5fd"/>
      `)
    },

    // ==================== 輸出齒輪 ====================
    {
      id: 'gear_cw',
      name: '輸出齒輪向右轉（順時針）',
      shortName: '齒輪順轉',
      category: 'gear',
      qty: 5,
      color: '#4f46e5',
      acceptsNumber: true,
      allowedIn: ['func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡命令機器人將其輸出齒輪順時針轉動一秒鐘。這張卡只能在函式中使用。在程式序列中，若這張卡的後方有數字卡，則表示順時針轉動幾秒鐘。',
      svg: svgWrap('#4f46e5', `
        <circle cx="40" cy="42" r="14" fill="none" stroke="#ffffff" stroke-width="6" stroke-dasharray="6 4"/>
        <circle cx="40" cy="42" r="6" fill="#ffffff"/>
        <path d="M22,22 A25,25 0 0,1 58,22" fill="none" stroke="#fde047" stroke-width="4.5" stroke-linecap="round"/>
        <polygon points="56,12 65,24 51,25" fill="#fde047"/>
      `)
    },
    {
      id: 'gear_ccw',
      name: '輸出齒輪向左轉（逆時針）',
      shortName: '齒輪逆轉',
      category: 'gear',
      qty: 5,
      color: '#4f46e5',
      acceptsNumber: true,
      allowedIn: ['func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡命令機器人將其輸出齒輪逆時針轉動一秒鐘。這張卡只能在函式中使用。在程式序列中，若這張卡的後方有數字卡，則表示逆時針轉動幾秒鐘。',
      svg: svgWrap('#4f46e5', `
        <circle cx="40" cy="42" r="14" fill="none" stroke="#ffffff" stroke-width="6" stroke-dasharray="6 4"/>
        <circle cx="40" cy="42" r="6" fill="#ffffff"/>
        <path d="M58,22 A25,25 0 0,0 22,22" fill="none" stroke="#fde047" stroke-width="4.5" stroke-linecap="round"/>
        <polygon points="24,12 15,24 29,25" fill="#fde047"/>
      `)
    },
    {
      id: 'gear_wait',
      name: '輸出齒輪暫停',
      shortName: '齒輪暫停',
      category: 'gear',
      qty: 4,
      color: '#4338ca',
      acceptsNumber: true,
      allowedIn: ['func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡命令機器人將其輸出齒輪暫停一秒鐘。這張卡只能在函式中使用。在程式序列中，若這張卡的後方有數字卡，則表示暫停幾秒鐘。',
      svg: svgWrap('#4338ca', `
        <circle cx="40" cy="40" r="22" fill="none" stroke="#c7d2fe" stroke-width="5" stroke-dasharray="7 5"/>
        <rect x="30" y="26" width="7" height="28" rx="3" fill="#ffffff"/>
        <rect x="43" y="26" width="7" height="28" rx="3" fill="#ffffff"/>
      `)
    },

    // ==================== 播放音效 (10種) ====================
    {
      id: 'sound_hi',
      name: '播放音效：嗨！',
      shortName: '音效：嗨！',
      category: 'sound',
      soundId: 'hi',
      bubbleText: '嗨！👋',
      qty: 2,
      color: '#16a34a',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出「嗨！」的音效。在這張卡後方若放一張數字卡，則表示重複發出該音效的次數。',
      svg: svgWrap('#16a34a', `
        <rect x="18" y="12" width="44" height="24" rx="10" fill="#ffffff"/>
        <polygon points="34,35 42,35 36,43" fill="#ffffff"/>
        <text x="40" y="29" text-anchor="middle" font-family="Nunito, Arial, sans-serif" font-weight="900" font-size="14" fill="#16a34a">HI!</text>
        <circle cx="40" cy="56" r="13" fill="#fde047" stroke="#ffffff" stroke-width="2"/>
        <circle cx="35" cy="54" r="2" fill="#14532d"/>
        <circle cx="45" cy="54" r="2" fill="#14532d"/>
        <path d="M35,59 Q40,64 45,59" fill="none" stroke="#14532d" stroke-width="2" stroke-linecap="round"/>
      `)
    },
    {
      id: 'sound_ah',
      name: '播放音效：啊！',
      shortName: '音效：啊！',
      category: 'sound',
      soundId: 'ah',
      bubbleText: '啊！✨',
      qty: 2,
      color: '#16a34a',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出「啊！」的輕快聲。在這張卡後方若放一張數字卡，則表示重複發出該音效的次數。',
      svg: svgWrap('#16a34a', `
        <circle cx="40" cy="43" r="22" fill="#ffffff" opacity="0.2"/>
        <circle cx="40" cy="43" r="18" fill="#fef08a" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="33" cy="38" r="2.6" fill="#14532d"/>
        <circle cx="47" cy="38" r="2.6" fill="#14532d"/>
        <ellipse cx="40" cy="49" rx="5.5" ry="6.5" fill="#dc2626"/>
        <text x="61" y="25" font-family="Arial, sans-serif" font-weight="900" font-size="18" fill="#ffffff">!</text>
      `)
    },
    {
      id: 'sound_huh',
      name: '播放音效：咦？',
      shortName: '音效：咦？',
      category: 'sound',
      soundId: 'huh',
      bubbleText: '咦？❓',
      qty: 2,
      color: '#16a34a',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出「咦？」的質疑聲。在這張卡後方若放一張數字卡，則表示重複發出該音效的次數。',
      svg: svgWrap('#16a34a', `
        <text x="24" y="28" font-family="Arial, sans-serif" font-weight="900" font-size="18" fill="#fde047">?</text>
        <text x="53" y="27" font-family="Arial, sans-serif" font-weight="900" font-size="22" fill="#ffffff">?</text>
        <circle cx="40" cy="48" r="17" fill="#fef08a" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="34" cy="45" r="2.4" fill="#14532d"/>
        <circle cx="46" cy="44" r="3" fill="#14532d"/>
        <path d="M34,55 Q40,51 46,55" fill="none" stroke="#14532d" stroke-width="2.5" stroke-linecap="round"/>
      `)
    },
    {
      id: 'sound_uhoh',
      name: '播放音效：呃啊',
      shortName: '音效：呃啊',
      category: 'sound',
      soundId: 'uhoh',
      bubbleText: '呃啊…😣',
      qty: 2,
      color: '#16a34a',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出「呃啊」的沮喪聲。在這張卡後方若放一張數字卡，則表示重複發出該音效的次數。',
      svg: svgWrap('#16a34a', `
        <circle cx="40" cy="44" r="19" fill="#bbf7d0" stroke="#ffffff" stroke-width="2.5"/>
        <line x1="30" y1="36" x2="37" y2="41" stroke="#14532d" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="50" y1="36" x2="43" y2="41" stroke="#14532d" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M31,54 Q40,46 49,54" fill="none" stroke="#14532d" stroke-width="3" stroke-linecap="round"/>
        <path d="M58,24 C58,24 63,31 63,34 A5,5 0 1,1 53,34 C53,31 58,24 58,24 Z" fill="#60a5fa"/>
      `)
    },
    {
      id: 'sound_mouse',
      name: '播放音效：老鼠呼叫',
      shortName: '老鼠吱吱',
      category: 'sound',
      soundId: 'mouse',
      bubbleText: '吱吱吱！🐭',
      qty: 2,
      color: '#16a34a',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出像老鼠呼叫一樣的吱吱聲。在這張卡後方若放一張數字卡，則表示重複發出該音效的次數。',
      svg: svgWrap('#16a34a', `
        <circle cx="26" cy="28" r="11" fill="#e5e7eb" stroke="#ffffff" stroke-width="2"/>
        <circle cx="26" cy="28" r="6" fill="#fda4af"/>
        <circle cx="54" cy="28" r="11" fill="#e5e7eb" stroke="#ffffff" stroke-width="2"/>
        <circle cx="54" cy="28" r="6" fill="#fda4af"/>
        <ellipse cx="40" cy="47" rx="17" ry="15" fill="#e5e7eb" stroke="#ffffff" stroke-width="2"/>
        <circle cx="34" cy="44" r="2.3" fill="#1f2937"/>
        <circle cx="46" cy="44" r="2.3" fill="#1f2937"/>
        <circle cx="40" cy="52" r="3" fill="#f43f5e"/>
        <path d="M22,50 L31,51 M22,55 L31,54 M58,50 L49,51 M58,55 L49,54" stroke="#6b7280" stroke-width="1.8"/>
      `)
    },
    {
      id: 'sound_penguin',
      name: '播放音效：企鵝嘎嘎叫',
      shortName: '企鵝嘎嘎',
      category: 'sound',
      soundId: 'penguin',
      bubbleText: '嘎嘎嘎！🐧',
      qty: 2,
      color: '#16a34a',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出像企鵝一樣的嘎嘎聲。在這張卡後方若放一張數字卡，則表示重複發出該音效的次數。',
      svg: svgWrap('#16a34a', `
        <ellipse cx="40" cy="45" rx="17" ry="22" fill="#1f2937" stroke="#ffffff" stroke-width="2"/>
        <ellipse cx="40" cy="50" rx="11" ry="15" fill="#ffffff"/>
        <circle cx="34" cy="34" r="2.5" fill="#ffffff"/>
        <circle cx="46" cy="34" r="2.5" fill="#ffffff"/>
        <polygon points="35,40 45,40 40,47" fill="#f97316"/>
        <text x="61" y="26" font-size="16" fill="#fde047">♪</text>
      `)
    },
    {
      id: 'sound_cheer',
      name: '播放音效：歡呼',
      shortName: '音效：歡呼',
      category: 'sound',
      soundId: 'cheer',
      bubbleText: '耶～太棒了！🎉',
      qty: 2,
      color: '#16a34a',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出歡呼的音效。在這張卡後方若放一張數字卡，則表示重複發出該音效的次數。',
      svg: svgWrap('#16a34a', `
        <polygon points="22,62 34,28 54,48" fill="#fde047" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
        <line x1="36" y1="22" x2="40" y2="12" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <line x1="48" y1="26" x2="58" y2="18" stroke="#fca5a5" stroke-width="3" stroke-linecap="round"/>
        <line x1="56" y1="38" x2="66" y2="36" stroke="#93c5fd" stroke-width="3" stroke-linecap="round"/>
        <circle cx="24" cy="24" r="3.5" fill="#f472b6"/>
        <circle cx="60" cy="52" r="3.5" fill="#fde047"/>
      `)
    },
    {
      id: 'sound_factory',
      name: '播放音效：工廠',
      shortName: '音效：工廠',
      category: 'sound',
      soundId: 'factory',
      bubbleText: '喀噠喀噠！🏭',
      qty: 2,
      color: '#16a34a',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出工廠加工的音效。在這張卡後方若放一張數字卡，則表示重複發出該音效的次數。',
      svg: svgWrap('#16a34a', `
        <polygon points="14,62 14,38 30,46 30,36 46,44 46,24 60,24 60,62" fill="#e5e7eb" stroke="#14532d" stroke-width="2.2" stroke-linejoin="round"/>
        <rect x="20" y="50" width="8" height="7" fill="#16a34a"/>
        <rect x="33" y="50" width="8" height="7" fill="#16a34a"/>
        <rect x="46" y="50" width="8" height="7" fill="#16a34a"/>
        <circle cx="53" cy="17" r="4.5" fill="#ffffff" opacity="0.9"/>
        <circle cx="62" cy="13" r="6" fill="#ffffff" opacity="0.75"/>
      `)
    },
    {
      id: 'sound_firehose',
      name: '播放音效：消防水管',
      shortName: '消防水管',
      category: 'sound',
      soundId: 'firehose',
      bubbleText: '嘶——噴水！🚒',
      qty: 2,
      color: '#16a34a',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出消防水管噴水而熄滅大火的音效。在這張卡後方若放一張數字卡，則表示重複發出該音效的次數。',
      svg: svgWrap('#16a34a', `
        <path d="M14,54 L34,54 L42,42" fill="none" stroke="#ef4444" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="38" y="34" width="10" height="12" rx="2" transform="rotate(-35 43 40)" fill="#fde047" stroke="#ffffff" stroke-width="1.5"/>
        <path d="M47,33 Q56,22 65,18 M49,37 Q60,31 67,31 M48,41 Q58,42 64,46" fill="none" stroke="#93c5fd" stroke-width="4" stroke-linecap="round"/>
      `)
    },
    {
      id: 'sound_siren',
      name: '播放音效：警笛',
      shortName: '音效：警笛',
      category: 'sound',
      soundId: 'siren',
      bubbleText: '喔伊喔伊！🚨',
      qty: 2,
      color: '#16a34a',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出緊急狀況的警笛聲。在這張卡後方若放一張數字卡，則表示重複發出該音效的次數。',
      svg: svgWrap('#16a34a', `
        <path d="M24,54 L28,32 C29,25 34,22 40,22 C46,22 51,25 52,32 L56,54 Z" fill="#ef4444" stroke="#ffffff" stroke-width="2.5"/>
        <rect x="18" y="54" width="44" height="9" rx="3" fill="#e5e7eb" stroke="#374151" stroke-width="1.5"/>
        <line x1="40" y1="10" x2="40" y2="16" stroke="#fde047" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="18" y1="18" x2="23" y2="23" stroke="#fde047" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="62" y1="18" x2="57" y2="23" stroke="#fde047" stroke-width="3.5" stroke-linecap="round"/>
      `)
    },

    // ==================== 燈光顏色 (8種) ====================
    {
      id: 'light_blue',
      name: '燈光顏色：藍',
      shortName: '藍燈',
      category: 'light_color',
      lightColor: '#3b82f6',
      lightName: '藍色',
      durationSec: 1,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人改變其輸出齒輪內部燈光的顏色，發出藍色燈光一秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightBulbSvg('#3b82f6')
    },
    {
      id: 'light_purple',
      name: '燈光顏色：紫',
      shortName: '紫燈',
      category: 'light_color',
      lightColor: '#a855f7',
      lightName: '紫色',
      durationSec: 1,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人改變其輸出齒輪內部燈光的顏色，發出紫色燈光一秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightBulbSvg('#a855f7')
    },
    {
      id: 'light_pink',
      name: '燈光顏色：粉紅',
      shortName: '粉紅燈',
      category: 'light_color',
      lightColor: '#ec4899',
      lightName: '粉紅色',
      durationSec: 1,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人改變其輸出齒輪內部燈光的顏色，發出粉紅色燈光一秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightBulbSvg('#ec4899')
    },
    {
      id: 'light_red',
      name: '燈光顏色：紅',
      shortName: '紅燈',
      category: 'light_color',
      lightColor: '#ef4444',
      lightName: '紅色',
      durationSec: 1,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人改變其輸出齒輪內部燈光的顏色，發出紅色燈光一秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightBulbSvg('#ef4444')
    },
    {
      id: 'light_orange',
      name: '燈光顏色：橘',
      shortName: '橘燈',
      category: 'light_color',
      lightColor: '#f97316',
      lightName: '橘色',
      durationSec: 1,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人改變其輸出齒輪內部燈光的顏色，發出橘色燈光一秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightBulbSvg('#f97316')
    },
    {
      id: 'light_yellow',
      name: '燈光顏色：黃',
      shortName: '黃燈',
      category: 'light_color',
      lightColor: '#facc15',
      lightName: '黃色',
      durationSec: 1,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人改變其輸出齒輪內部燈光的顏色，發出黃色燈光一秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightBulbSvg('#facc15')
    },
    {
      id: 'light_green',
      name: '燈光顏色：綠',
      shortName: '綠燈',
      category: 'light_color',
      lightColor: '#22c55e',
      lightName: '綠色',
      durationSec: 1,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人改變其輸出齒輪內部燈光的顏色，發出綠色燈光一秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightBulbSvg('#22c55e')
    },
    {
      id: 'light_rainbow',
      name: '燈光顏色：彩虹',
      shortName: '彩虹燈',
      category: 'light_color',
      lightColor: 'rainbow',
      lightName: '七色彩虹',
      durationSec: 3.5,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人改變其輸出齒輪內部燈光的顏色，發出七種顏色的光，每種顏色的光發出半秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightBulbSvg('#ffffff', '', true)
    },

    // ==================== 燈光效果 (10種) ====================
    {
      id: 'fx_disco',
      name: '燈光效果：迪斯科閃燈',
      shortName: '迪斯科閃燈',
      category: 'light_fx',
      fxType: 'disco',
      durationSec: 3,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出快速、閃爍的燈光，預設的燈光效果為發出紫色的燈光效果，並且持續三秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightFxSvg(`
        <circle cx="16" cy="20" r="3" fill="#fde047"/>
        <circle cx="64" cy="20" r="3" fill="#f472b6"/>
        <circle cx="14" cy="44" r="2.5" fill="#60a5fa"/>
        <circle cx="66" cy="44" r="2.5" fill="#fde047"/>
        <text x="40" y="40" text-anchor="middle" font-size="13" font-weight="900" fill="#ffffff">✦</text>
      `)
    },
    {
      id: 'fx_emergency',
      name: '燈光效果：緊急事件',
      shortName: '緊急閃燈',
      category: 'light_fx',
      fxType: 'emergency',
      durationSec: 3,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出像是緊急救援消防車的燈光，預設的燈光效果為發出紫色的燈光效果，並且持續三秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightFxSvg(`
        <path d="M12,32 L21,35 M12,42 L21,40 M68,32 L59,35 M68,42 L59,40" stroke="#ef4444" stroke-width="3.5" stroke-linecap="round"/>
        <text x="40" y="41" text-anchor="middle" font-family="Arial" font-weight="900" font-size="17" fill="#ffffff">!</text>
      `)
    },
    {
      id: 'fx_meteor',
      name: '燈光效果：流星',
      shortName: '流星燈',
      category: 'light_fx',
      fxType: 'meteor',
      durationSec: 3,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出快慢快的閃爍燈光。預設的燈光效果為發出紫色的燈光效果，並且持續三秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightFxSvg(`
        <line x1="12" y1="22" x2="26" y2="14" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <line x1="54" y1="14" x2="68" y2="22" stroke="#fde047" stroke-width="3" stroke-linecap="round"/>
        <path d="M31,37 L49,37" stroke="#fde047" stroke-width="3" stroke-dasharray="4 3"/>
      `)
    },
    {
      id: 'fx_twinkle',
      name: '燈光效果：閃爍星光',
      shortName: '閃爍星光',
      category: 'light_fx',
      fxType: 'twinkle',
      durationSec: 3,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出連續的閃爍燈光。預設的燈光效果為發出紫色的燈光效果，並且持續三秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightFxSvg(`
        <path d="${starPath(17, 22, 6, 2.5)}" fill="#ffffff"/>
        <path d="${starPath(63, 24, 7, 3)}" fill="#fde047"/>
        <path d="${starPath(40, 36, 7, 3)}" fill="#ffffff"/>
      `)
    },
    {
      id: 'fx_firefly',
      name: '燈光效果：螢火蟲',
      shortName: '螢火蟲燈',
      category: 'light_fx',
      fxType: 'firefly',
      durationSec: 3,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出像是螢火蟲的燈光效果。預設的燈光效果為發出紫色的燈光效果，並且持續三秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightFxSvg(`
        <circle cx="18" cy="26" r="5" fill="#fef08a" opacity="0.85"/>
        <circle cx="62" cy="30" r="4" fill="#fef08a" opacity="0.7"/>
        <circle cx="40" cy="36" r="6" fill="#fef08a" opacity="0.85"/>
      `)
    },
    {
      id: 'fx_blink_slow',
      name: '燈光效果：慢速閃爍',
      shortName: '慢速閃爍',
      category: 'light_fx',
      fxType: 'blink_slow',
      durationSec: 3,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出緩慢地眨眼睛的閃爍燈光效果。預設的燈光效果為發出紫色的燈光效果，並且持續三秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightFxSvg(`
        <circle cx="40" cy="36" r="5" fill="#ffffff"/>
        <text x="61" y="22" text-anchor="middle" font-size="11" font-weight="900" fill="#ffffff">慢</text>
      `)
    },
    {
      id: 'fx_blink_medium',
      name: '燈光效果：中速閃爍',
      shortName: '中速閃爍',
      category: 'light_fx',
      fxType: 'blink_medium',
      durationSec: 3,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出中速地眨眼睛的閃爍燈光效果。預設的燈光效果為發出紫色的燈光效果，並且持續三秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightFxSvg(`
        <circle cx="34" cy="36" r="4" fill="#ffffff"/>
        <circle cx="46" cy="36" r="4" fill="#ffffff"/>
        <text x="61" y="22" text-anchor="middle" font-size="11" font-weight="900" fill="#ffffff">中</text>
      `)
    },
    {
      id: 'fx_blink_fast',
      name: '燈光效果：快速閃爍',
      shortName: '快速閃爍',
      category: 'light_fx',
      fxType: 'blink_fast',
      durationSec: 3,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出快速地眨眼睛的閃爍燈光效果。預設的燈光效果為發出紫色的燈光效果，並且持續三秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightFxSvg(`
        <circle cx="32" cy="36" r="3" fill="#ffffff"/>
        <circle cx="40" cy="36" r="3" fill="#ffffff"/>
        <circle cx="48" cy="36" r="3" fill="#ffffff"/>
        <text x="61" y="22" text-anchor="middle" font-size="11" font-weight="900" fill="#ffffff">快</text>
      `)
    },
    {
      id: 'fx_speed_up',
      name: '燈光效果：加快',
      shortName: '閃爍加快',
      category: 'light_fx',
      fxType: 'speed_up',
      durationSec: 3,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出愈來愈快的閃爍燈光效果。預設的燈光效果為發出紫色的燈光效果，並且持續三秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightFxSvg(`
        <polygon points="31,31 39,36 31,41" fill="#ffffff"/>
        <polygon points="41,31 49,36 41,41" fill="#fde047"/>
        <text x="60" y="22" text-anchor="middle" font-size="11" font-weight="900" fill="#ffffff">≫</text>
      `)
    },
    {
      id: 'fx_slow_down',
      name: '燈光效果：放慢',
      shortName: '閃爍放慢',
      category: 'light_fx',
      fxType: 'slow_down',
      durationSec: 3,
      qty: 2,
      color: '#84cc16',
      acceptsNumber: true,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: '這張指令卡告訴機器人發出愈來愈慢的閃爍燈光效果。預設的燈光效果為發出紫色的燈光效果，並且持續三秒鐘。這張卡可與數字卡併用，達到重複的效果。',
      svg: lightFxSvg(`
        <polygon points="49,31 41,36 49,41" fill="#ffffff"/>
        <polygon points="39,31 31,36 39,41" fill="#fde047"/>
        <text x="60" y="22" text-anchor="middle" font-size="11" font-weight="900" fill="#ffffff">≪</text>
      `)
    }
  ];

  // 數字卡 1-9 (各2張)
  for (let n = 1; n <= 9; n++) {
    COMMAND_CARDS.push({
      id: `num_${n}`,
      name: `數字卡 ${n}`,
      shortName: `×${n}`,
      category: 'number',
      numberValue: n,
      qty: 2,
      color: '#6b7280',
      acceptsNumber: false,
      allowedIn: ['main', 'func_red', 'func_green', 'func_blue', 'condition'],
      description: `執行數字卡前方的指令 ${n} 次。只有在緊接著簡單迴圈起點卡、前進/後退、右轉/左轉、暫停、輸出齒輪轉動/暫停、音效卡、燈光顏色卡、燈光效果卡時才會生效；不可連續放置多張數字卡。`,
      svg: numberSvg(n)
    });
  }

  const CARD_BY_ID = {};
  COMMAND_CARDS.forEach(c => { CARD_BY_ID[c.id] = c; });

  global.CommandCardsModule = {
    CATEGORIES,
    CARDS: COMMAND_CARDS,
    getById(id) { return CARD_BY_ID[id] || null; },
    getByCategory(catId) {
      if (!catId || catId === 'all') return COMMAND_CARDS;
      return COMMAND_CARDS.filter(c => c.category === catId);
    }
  };
})(window);
