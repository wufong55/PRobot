/**
 * 地圖卡模組 (Map Cards Module)
 * 完整依據手冊第 11 頁「地圖卡概述」建置四種雙面地圖卡（共 19 張雙面卡、38 個圖案面）
 * 包含：
 * 1. 起點地圖卡 (1 張雙面)
 * 2. 基地卡 (紅、綠、藍 3 張雙面，2×1 雙格卡)
 * 3. 事件地圖卡 (2 張雙面：事件2/事件4、事件3/事件1)
 * 4. 一般地圖卡 (13 張雙面：左欄 1~5、中欄 1~5、右欄 1~3)
 */
(function (global) {
  'use strict';

  const MAP_CATEGORIES = [
    { id: 'all', name: '全部地圖卡', icon: '🗺️' },
    { id: 'start', name: '起點地圖卡', icon: '🚩' },
    { id: 'base', name: '基地卡 (2格)', icon: '⭐' },
    { id: 'event', name: '事件地圖卡', icon: '⚡' },
    { id: 'general', name: '一般地圖卡', icon: '🌿' }
  ];

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

  function tileWrap(content, w, h) {
    const W = w || 100;
    const H = h || 100;
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="map-svg" preserveAspectRatio="xMidYMid slice">
      ${content}
      <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="6" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="2"/>
    </svg>`;
  }

  function grassBg(W, H) {
    return `
      <rect width="${W}" height="${H}" fill="#5c913b"/>
      <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="4" fill="#689f43" opacity="0.65"/>
      <g stroke="#4f7e31" stroke-width="1.5" opacity="0.45">
        <path d="M18,24 l3,-5 l3,5 M76,20 l2,-4 l2,4 M24,78 l3,-5 l3,5 M72,82 l2,-4 l2,4" fill="none"/>
      </g>
    `;
  }

  function hazardBorder(W, H) {
    return `
      <defs>
        <pattern id="hz_${W}_${H}" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="12" fill="#facc15"/>
          <rect x="6" width="6" height="12" fill="#1f2937"/>
        </pattern>
      </defs>
      <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="4" fill="none" stroke="url(#hz_${W}_${H})" stroke-width="6"/>
    `;
  }

  function cone(x, y) {
    return `<g transform="translate(${x},${y})">
      <ellipse cx="0" cy="6" rx="6" ry="2.5" fill="#ea580c"/>
      <polygon points="0,-7 -4.5,5 4.5,5" fill="#f97316"/>
      <line x1="-2.5" y1="0" x2="2.5" y2="0" stroke="#ffffff" stroke-width="2"/>
    </g>`;
  }

  function cornerBrackets(color) {
    const c = color || '#64748b';
    return `<g stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round">
      <path d="M12,24 L12,12 L24,12"/>
      <path d="M76,12 L88,12 L88,24"/>
      <path d="M12,76 L12,88 L24,88"/>
      <path d="M76,88 L88,88 L88,76"/>
    </g>`;
  }

  function numberBadge(num) {
    const dots = '•'.repeat(num);
    return `
      <rect x="60" y="75" width="32" height="18" rx="4" fill="rgba(255,255,255,0.82)"/>
      <text x="69" y="88" font-family="Arial, sans-serif" font-weight="900" font-size="11" fill="#1f2937">${num}</text>
      <text x="77" y="88" font-family="Arial, sans-serif" font-weight="900" font-size="8" fill="#4b5563">${dots.slice(0, 3)}</text>
    `;
  }

  function baseFrontSvg(starColor, theme) {
    const isGrass = theme === 'grass';
    const bg = isGrass
      ? grassBg(200, 100) + `
          <circle cx="145" cy="50" r="32" fill="#2c4a3e" stroke="#a7f3d0" stroke-width="2" opacity="0.85"/>
          <circle cx="145" cy="50" r="20" fill="none" stroke="#6ee7b7" stroke-width="1.5" stroke-dasharray="4 3"/>
        `
      : `
          <rect width="200" height="100" fill="#cbd5e1"/>
          <rect x="10" y="10" width="180" height="80" fill="#e2e8f0" rx="4"/>
          ${hazardBorder(200, 100)}
          <rect x="105" y="18" width="78" height="64" rx="4" fill="#94a3b8" opacity="0.55" stroke="#475569" stroke-width="1.5"/>
          ${cone(122, 30)}
          ${cone(172, 74)}
        `;

    return tileWrap(`
      ${bg}
      <line x1="100" y1="6" x2="100" y2="94" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-dasharray="4 4"/>
      <circle cx="48" cy="50" r="27" fill="rgba(255,255,255,0.88)" stroke="${starColor}" stroke-width="2.5"/>
      <path d="${starPath(48, 50, 21, 9)}" fill="${starColor}"/>
      <g fill="${starColor}" opacity="0.92">
        <polygon points="82,40 92,50 82,60 86,50"/>
        <polygon points="92,40 102,50 92,60 96,50"/>
        <polygon points="102,40 112,50 102,60 106,50"/>
      </g>
    `, 200, 100);
  }

  function baseBackSvg(starColor, style) {
    let bg = '';
    if (style === 'red_back') {
      bg = `
        <rect width="200" height="100" fill="#e5e7eb"/>
        <rect x="115" y="8" width="77" height="84" rx="4" fill="#5c913b"/>
        <circle cx="154" cy="50" r="24" fill="#475569" stroke="#cbd5e1" stroke-width="3"/>
        <circle cx="154" cy="50" r="10" fill="#94a3b8"/>
        <g stroke="#cbd5e1" stroke-width="1"><line x1="0" y1="33" x2="115" y2="33"/><line x1="0" y1="66" x2="115" y2="66"/><line x1="38" y1="0" x2="38" y2="100"/><line x1="76" y1="0" x2="76" y2="100"/></g>
      `;
    } else if (style === 'green_back') {
      bg = `
        <rect width="200" height="100" fill="#d1d5db"/>
        <g stroke="#9ca3af" stroke-width="1"><line x1="0" y1="25" x2="140" y2="25"/><line x1="0" y1="50" x2="140" y2="50"/><line x1="0" y1="75" x2="140" y2="75"/><line x1="35" y1="0" x2="35" y2="100"/><line x1="70" y1="0" x2="70" y2="100"/><line x1="105" y1="0" x2="105" y2="100"/></g>
        <rect x="142" y="14" width="46" height="72" rx="5" fill="#4b5563" stroke="#1f2937" stroke-width="2"/>
        <rect x="150" y="24" width="30" height="24" rx="3" fill="#e5e7eb"/>
        <circle cx="158" cy="64" r="5" fill="#22c55e"/>
        <circle cx="172" cy="64" r="5" fill="#facc15"/>
      `;
    } else {
      bg = `
        ${grassBg(200, 100)}
        <circle cx="150" cy="50" r="30" fill="#64748b" stroke="#e2e8f0" stroke-width="3"/>
        <circle cx="150" cy="50" r="18" fill="#475569" stroke="#94a3b8" stroke-width="2"/>
        <circle cx="150" cy="50" r="7" fill="#38bdf8"/>
      `;
    }
    return tileWrap(`
      ${bg}
      <line x1="100" y1="6" x2="100" y2="94" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-dasharray="4 4"/>
      <circle cx="48" cy="50" r="27" fill="rgba(255,255,255,0.88)" stroke="${starColor}" stroke-width="2.5"/>
      <path d="${starPath(48, 50, 21, 9)}" fill="${starColor}"/>
      <g fill="${starColor}" opacity="0.92">
        <polygon points="82,40 92,50 82,60 86,50"/>
        <polygon points="92,40 102,50 92,60 96,50"/>
        <polygon points="102,40 112,50 102,60 106,50"/>
      </g>
    `, 200, 100);
  }

  const MAP_CARDS = [
    // ==================== 1. 起點地圖卡 ====================
    {
      id: 'map_start',
      name: '起點地圖卡',
      category: 'start',
      width: 1,
      height: 1,
      role: 'start',
      description: '機器人主程式開始出發的起點地圖卡（內含特殊光學識別圖案）。前面為草地直線起點，背面為草地弧形彎道起點。',
      sides: {
        front: {
          label: '前面（草地起點）',
          role: 'start',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            <path d="M18,22 L82,22 L82,78 L18,78 Z" fill="#7cb342" stroke="#dce775" stroke-width="2" opacity="0.65"/>
            <rect x="24" y="34" width="38" height="32" rx="4" fill="#ffffff" stroke="#33691e" stroke-width="2"/>
            <text x="43" y="54" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="11" fill="#33691e">START</text>
            <g fill="#ffffff">
              <polygon points="66,42 74,50 66,58"/>
              <polygon points="75,42 83,50 75,58"/>
              <polygon points="84,42 92,50 84,58"/>
            </g>
          `)
        },
        back: {
          label: '背面（彎道起點）',
          role: 'start',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            <path d="M90,24 L46,24 C22,24 22,76 46,76 L90,76" fill="none" stroke="#94a3b8" stroke-width="26" stroke-linecap="round"/>
            <path d="M90,24 L46,24 C22,24 22,76 46,76 L90,76" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="5 5"/>
            <rect x="26" y="37" width="38" height="24" rx="4" fill="#ffffff" stroke="#33691e" stroke-width="2"/>
            <text x="45" y="53" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="10.5" fill="#33691e">START</text>
            <polygon points="72,44 82,50 72,56" fill="#fef08a"/>
          `)
        }
      }
    },

    // ==================== 2. 基地卡 (2×1 雙格卡) ====================
    {
      id: 'map_base_red',
      name: '紅色函式基地卡',
      category: 'base',
      width: 2,
      height: 1,
      role: 'base_red',
      funcColor: 'red',
      description: '印有紅色星星光學識別圖案的雙格基地卡。當機器人掃描到此基地卡的紅色星星格時，會自動執行「紅色函式」程式，執行完畢後回到基地卡繼續執行主程式。',
      sides: {
        front: {
          label: '前面（紅色基地工廠）',
          role: 'base_red',
          funcColor: 'red',
          svg: baseFrontSvg('#ef4444', 'factory')
        },
        back: {
          label: '背面（紅色基地圓盤）',
          role: 'base_red',
          funcColor: 'red',
          svg: baseBackSvg('#ef4444', 'red_back')
        }
      }
    },
    {
      id: 'map_base_green',
      name: '綠色函式基地卡',
      category: 'base',
      width: 2,
      height: 1,
      role: 'base_green',
      funcColor: 'green',
      description: '印有綠色星星光學識別圖案的雙格基地卡。當機器人掃描到此基地卡的綠色星星格時，會自動執行「綠色函式」程式，執行完畢後回到基地卡繼續執行主程式。',
      sides: {
        front: {
          label: '前面（綠色基地工廠）',
          role: 'base_green',
          funcColor: 'green',
          svg: baseFrontSvg('#22c55e', 'factory')
        },
        back: {
          label: '背面（綠色基地控制台）',
          role: 'base_green',
          funcColor: 'green',
          svg: baseBackSvg('#22c55e', 'green_back')
        }
      }
    },
    {
      id: 'map_base_blue',
      name: '藍色函式基地卡',
      category: 'base',
      width: 2,
      height: 1,
      role: 'base_blue',
      funcColor: 'blue',
      description: '印有藍色星星光學識別圖案的雙格基地卡。當機器人掃描到此基地卡的藍色星星格時，會自動執行「藍色函式」程式，執行完畢後回到基地卡繼續執行主程式。',
      sides: {
        front: {
          label: '前面（藍色基地草地）',
          role: 'base_blue',
          funcColor: 'blue',
          svg: baseFrontSvg('#3b82f6', 'grass')
        },
        back: {
          label: '背面（藍色基地平台）',
          role: 'base_blue',
          funcColor: 'blue',
          svg: baseBackSvg('#3b82f6', 'blue_back')
        }
      }
    },

    // ==================== 3. 事件地圖卡 (2張雙面 = 4個事件) ====================
    {
      id: 'map_event_2_4',
      name: '事件地圖卡（事件2／事件4）',
      category: 'event',
      width: 1,
      height: 1,
      role: 'event',
      description: '雙面事件地圖卡：前面為「事件2卡（閃電火花）」，背面為「事件4卡（愛心）」。當機器人掃描到事件地圖卡時，會檢查條件語句程式；若無對應程式則執行預設行為。',
      sides: {
        front: {
          label: '事件 2 卡（前面・火花）',
          role: 'event',
          eventId: 'event_2',
          eventName: '事件2（閃電火花）',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            <polygon points="50,12 58,34 80,25 66,46 86,58 63,61 68,84 50,68 32,84 37,61 14,58 34,46 20,25 42,34"
                     fill="#fef08a" stroke="#ffffff" stroke-width="2.5"/>
            <polygon points="50,25 55,40 69,34 60,48 71,56 57,58 60,71 50,61 40,71 43,58 29,56 40,48 31,34 45,40"
                     fill="#f97316"/>
            <rect x="6" y="6" width="38" height="17" rx="4" fill="rgba(192,38,211,0.9)"/>
            <text x="25" y="18" text-anchor="middle" font-size="10" font-weight="900" fill="#ffffff">事件2</text>
          `)
        },
        back: {
          label: '事件 4 卡（背面・愛心）',
          role: 'event',
          eventId: 'event_4',
          eventName: '事件4（愛心）',
          svg: tileWrap(`
            <rect width="100" height="100" fill="#bae6fd"/>
            <circle cx="50" cy="52" r="34" fill="#e0f2fe" opacity="0.9"/>
            ${cornerBrackets('#64748b')}
            <path d="M50,74 C50,74 22,56 22,38 C22,28 30,22 38,22 C44,22 48,26 50,31 C52,26 56,22 62,22 C70,22 78,28 78,38 C78,56 50,74 50,74 Z"
                  fill="#ffffff" stroke="#ec4899" stroke-width="3"/>
            <rect x="6" y="6" width="38" height="17" rx="4" fill="rgba(192,38,211,0.9)"/>
            <text x="25" y="18" text-anchor="middle" font-size="10" font-weight="900" fill="#ffffff">事件4</text>
          `)
        }
      }
    },
    {
      id: 'map_event_3_1',
      name: '事件地圖卡（事件3／事件1）',
      category: 'event',
      width: 1,
      height: 1,
      role: 'event',
      description: '雙面事件地圖卡：前面為「事件3卡（漩渦）」，背面為「事件1卡（五角星）」。當機器人掃描到事件地圖卡時，會檢查條件語句程式；若無對應程式則執行預設行為。',
      sides: {
        front: {
          label: '事件 3 卡（前面・漩渦）',
          role: 'event',
          eventId: 'event_3',
          eventName: '事件3（漩渦）',
          svg: tileWrap(`
            <rect width="100" height="100" fill="#e2e8f0"/>
            ${hazardBorder(100, 100)}
            <circle cx="50" cy="52" r="29" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>
            <path d="M50,52 C50,45 59,45 59,52 C59,62 41,62 41,50 C41,36 66,36 66,52 C66,70 33,70 33,50 C33,28 73,28 73,52"
                  fill="none" stroke="#7c3aed" stroke-width="4.5" stroke-linecap="round"/>
            ${cone(80, 26)}
            <rect x="6" y="6" width="38" height="17" rx="4" fill="rgba(192,38,211,0.9)"/>
            <text x="25" y="18" text-anchor="middle" font-size="10" font-weight="900" fill="#ffffff">事件3</text>
          `)
        },
        back: {
          label: '事件 1 卡（背面・五角星）',
          role: 'event',
          eventId: 'event_1',
          eventName: '事件1（五角星）',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            <circle cx="50" cy="52" r="34" fill="#94a3b8" stroke="#e2e8f0" stroke-width="3"/>
            <circle cx="50" cy="52" r="24" fill="#ffffff" stroke="#c026d3" stroke-width="3"/>
            <path d="${starPath(50, 52, 18, 8)}" fill="#c026d3"/>
            <rect x="6" y="6" width="38" height="17" rx="4" fill="rgba(192,38,211,0.9)"/>
            <text x="25" y="18" text-anchor="middle" font-size="10" font-weight="900" fill="#ffffff">事件1</text>
          `)
        }
      }
    },

    // ==================== 4. 一般地圖卡 — 左欄 (A1 ~ A5) ====================
    {
      id: 'map_gen_a1',
      name: '一般地圖卡 A-1',
      category: 'general',
      width: 1,
      height: 1,
      role: 'general',
      description: '一般地圖卡（左欄第1張）：前面為草地路邊（編號1），背面為灰白棋盤格地板與小盆栽。',
      sides: {
        front: {
          label: '前面（草地邊緣 1）',
          role: 'general',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            <rect x="0" y="0" width="24" height="100" fill="#57534e"/>
            <line x1="24" y1="0" x2="24" y2="100" stroke="#d6d3d1" stroke-width="3"/>
            ${numberBadge(1)}
          `)
        },
        back: {
          label: '背面（棋盤地磚）',
          role: 'general',
          svg: tileWrap(`
            <defs>
              <pattern id="chk_a1" width="25" height="25" patternUnits="userSpaceOnUse">
                <rect width="25" height="25" fill="#f1f5f9"/>
                <rect width="12.5" height="12.5" fill="#cbd5e1"/>
                <rect x="12.5" y="12.5" width="12.5" height="12.5" fill="#cbd5e1"/>
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#chk_a1)"/>
            ${cornerBrackets('#64748b')}
            <circle cx="78" cy="78" r="10" fill="#22c55e" stroke="#15803d" stroke-width="2"/>
            <circle cx="78" cy="78" r="4" fill="#86efac"/>
          `)
        }
      }
    },
    {
      id: 'map_gen_a2',
      name: '一般地圖卡 A-2',
      category: 'general',
      width: 1,
      height: 1,
      role: 'general',
      description: '一般地圖卡（左欄第2張）：前面為草地路邊（編號2），背面為淺藍浴室地磚與白色浴缸。',
      sides: {
        front: {
          label: '前面（草地邊緣 2）',
          role: 'general',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            <rect x="0" y="0" width="24" height="100" fill="#57534e"/>
            <line x1="24" y1="0" x2="24" y2="100" stroke="#d6d3d1" stroke-width="3"/>
            ${numberBadge(2)}
          `)
        },
        back: {
          label: '背面（淺藍浴室）',
          role: 'general',
          svg: tileWrap(`
            <rect width="100" height="100" fill="#bae6fd"/>
            ${cornerBrackets('#64748b')}
            <rect x="20" y="14" width="60" height="26" rx="12" fill="#ffffff" stroke="#7dd3fc" stroke-width="2.5"/>
            <rect x="27" y="19" width="46" height="16" rx="8" fill="#e0f2fe"/>
            <circle cx="70" cy="27" r="3" fill="#94a3b8"/>
          `)
        }
      }
    },
    {
      id: 'map_gen_a3',
      name: '一般地圖卡 A-3',
      category: 'general',
      width: 1,
      height: 1,
      role: 'general',
      description: '一般地圖卡（左欄第3張）：前面為草地路邊（編號3），背面為淺藍水池／冰面方格。',
      sides: {
        front: {
          label: '前面（草地邊緣 3）',
          role: 'general',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            <rect x="0" y="0" width="24" height="100" fill="#57534e"/>
            <line x1="24" y1="0" x2="24" y2="100" stroke="#d6d3d1" stroke-width="3"/>
            ${numberBadge(3)}
          `)
        },
        back: {
          label: '背面（淺藍冰面）',
          role: 'general',
          svg: tileWrap(`
            <rect width="100" height="100" fill="#bae6fd"/>
            <rect x="14" y="14" width="72" height="72" rx="6" fill="#e0f2fe" opacity="0.5"/>
            <line x1="24" y1="30" x2="46" y2="30" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
            <line x1="56" y1="68" x2="76" y2="68" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
            ${cornerBrackets('#64748b')}
          `)
        }
      }
    },
    {
      id: 'map_gen_a4',
      name: '一般地圖卡 A-4',
      category: 'general',
      width: 1,
      height: 1,
      role: 'general',
      description: '一般地圖卡（左欄第4張）：前面為草地運動場中圈（編號4），背面為溫馨臥室木地板與紅棉被床鋪。',
      sides: {
        front: {
          label: '前面（草地球場 4）',
          role: 'general',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            <line x1="50" y1="0" x2="50" y2="100" stroke="#ffffff" stroke-width="2" opacity="0.75"/>
            <circle cx="50" cy="50" r="24" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.75"/>
            <circle cx="50" cy="50" r="3" fill="#ffffff"/>
            ${numberBadge(4)}
          `)
        },
        back: {
          label: '背面（臥室床鋪）',
          role: 'general',
          svg: tileWrap(`
            <rect width="100" height="100" fill="#fef3c7"/>
            <g stroke="#fde68a" stroke-width="1.5"><line x1="0" y1="25" x2="100" y2="25"/><line x1="0" y1="50" x2="100" y2="50"/><line x1="0" y1="75" x2="100" y2="75"/></g>
            ${cornerBrackets('#92400e')}
            <rect x="26" y="20" width="48" height="58" rx="5" fill="#92400e"/>
            <rect x="30" y="24" width="18" height="12" rx="3" fill="#ffffff"/>
            <rect x="52" y="24" width="18" height="12" rx="3" fill="#ffffff"/>
            <rect x="30" y="38" width="40" height="36" rx="3" fill="#dc2626"/>
            <rect x="30" y="38" width="40" height="7" fill="#fca5a5"/>
          `)
        }
      }
    },
    {
      id: 'map_gen_a5',
      name: '一般地圖卡 A-5',
      category: 'general',
      width: 1,
      height: 1,
      role: 'general',
      description: '一般地圖卡（左欄第5張）：前面為純綠色草地（編號5），背面為淺黃色室內木地板。',
      sides: {
        front: {
          label: '前面（綠色草地 5）',
          role: 'general',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            ${numberBadge(5)}
          `)
        },
        back: {
          label: '背面（木紋地板）',
          role: 'general',
          svg: tileWrap(`
            <rect width="100" height="100" fill="#fef3c7"/>
            <g stroke="#fde68a" stroke-width="2">
              <line x1="0" y1="20" x2="100" y2="20"/>
              <line x1="0" y1="40" x2="100" y2="40"/>
              <line x1="0" y1="60" x2="100" y2="60"/>
              <line x1="0" y1="80" x2="100" y2="80"/>
            </g>
            ${cornerBrackets('#b45309')}
          `)
        }
      }
    },

    // ==================== 4. 一般地圖卡 — 中欄 (B1 ~ B5) ====================
    {
      id: 'map_gen_b1',
      name: '一般地圖卡 B-1',
      category: 'general',
      width: 1,
      height: 1,
      role: 'general',
      description: '一般地圖卡（中欄第1張）：前面為草地（編號1），背面為灰色十字路口道路。',
      sides: {
        front: {
          label: '前面（草地 1）',
          role: 'general',
          svg: tileWrap(`${grassBg(100, 100)}${numberBadge(1)}`)
        },
        back: {
          label: '背面（十字路口）',
          role: 'general',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            <rect x="24" y="0" width="52" height="100" fill="#94a3b8"/>
            <rect x="0" y="24" width="100" height="52" fill="#94a3b8"/>
            <line x1="50" y1="0" x2="50" y2="100" stroke="#f8fafc" stroke-width="2" stroke-dasharray="6 6"/>
            <line x1="0" y1="50" x2="100" y2="50" stroke="#f8fafc" stroke-width="2" stroke-dasharray="6 6"/>
          `)
        }
      }
    },
    {
      id: 'map_gen_b2',
      name: '一般地圖卡 B-2',
      category: 'general',
      width: 1,
      height: 1,
      role: 'general',
      description: '一般地圖卡（中欄第2張）：前面為草地（編號2），背面為灰色橫向直線道路。',
      sides: {
        front: {
          label: '前面（草地 2）',
          role: 'general',
          svg: tileWrap(`${grassBg(100, 100)}${numberBadge(2)}`)
        },
        back: {
          label: '背面（直線道路・橫）',
          role: 'general',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            <rect x="0" y="22" width="100" height="56" fill="#94a3b8"/>
            <line x1="0" y1="22" x2="100" y2="22" stroke="#e2e8f0" stroke-width="2"/>
            <line x1="0" y1="78" x2="100" y2="78" stroke="#e2e8f0" stroke-width="2"/>
            <line x1="0" y1="50" x2="100" y2="50" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="8 6"/>
          `)
        }
      }
    },
    {
      id: 'map_gen_b3',
      name: '一般地圖卡 B-3',
      category: 'general',
      width: 1,
      height: 1,
      role: 'general',
      description: '一般地圖卡（中欄第3張）：前面為草地（編號3），背面為灰色縱向直線道路。',
      sides: {
        front: {
          label: '前面（草地 3）',
          role: 'general',
          svg: tileWrap(`${grassBg(100, 100)}${numberBadge(3)}`)
        },
        back: {
          label: '背面（直線道路・直）',
          role: 'general',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            <rect x="22" y="0" width="56" height="100" fill="#94a3b8"/>
            <line x1="22" y1="0" x2="22" y2="100" stroke="#e2e8f0" stroke-width="2"/>
            <line x1="78" y1="0" x2="78" y2="100" stroke="#e2e8f0" stroke-width="2"/>
            <line x1="50" y1="0" x2="50" y2="100" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="8 6"/>
          `)
        }
      }
    },
    {
      id: 'map_gen_b4',
      name: '一般地圖卡 B-4',
      category: 'general',
      width: 1,
      height: 1,
      role: 'general',
      description: '一般地圖卡（中欄第4張）：前面為草地（編號4），背面為灰色 T 字路口道路。',
      sides: {
        front: {
          label: '前面（草地 4）',
          role: 'general',
          svg: tileWrap(`${grassBg(100, 100)}${numberBadge(4)}`)
        },
        back: {
          label: '背面（T 字路口）',
          role: 'general',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            <rect x="0" y="24" width="100" height="52" fill="#94a3b8"/>
            <rect x="24" y="50" width="52" height="50" fill="#94a3b8"/>
            <line x1="0" y1="50" x2="100" y2="50" stroke="#ffffff" stroke-width="2" stroke-dasharray="7 6"/>
            <line x1="50" y1="50" x2="50" y2="100" stroke="#ffffff" stroke-width="2" stroke-dasharray="7 6"/>
          `)
        }
      }
    },
    {
      id: 'map_gen_b5',
      name: '一般地圖卡 B-5',
      category: 'general',
      width: 1,
      height: 1,
      role: 'general',
      description: '一般地圖卡（中欄第5張）：前面為草地（編號5），背面為廚房／實驗室雙圓盤地磚。',
      sides: {
        front: {
          label: '前面（草地 5）',
          role: 'general',
          svg: tileWrap(`${grassBg(100, 100)}${numberBadge(5)}`)
        },
        back: {
          label: '背面（實驗室雙盤）',
          role: 'general',
          svg: tileWrap(`
            <rect width="100" height="100" fill="#e2e8f0"/>
            <rect x="10" y="58" width="80" height="32" rx="4" fill="#94a3b8"/>
            <circle cx="32" cy="74" r="10" fill="#ffffff" stroke="#475569" stroke-width="2"/>
            <circle cx="68" cy="74" r="10" fill="#ffffff" stroke="#475569" stroke-width="2"/>
            <circle cx="50" cy="74" r="3" fill="#ef4444"/>
            ${cornerBrackets('#64748b')}
          `)
        }
      }
    },

    // ==================== 4. 一般地圖卡 — 右欄 (C1 ~ C3 工廠與深色道路) ====================
    {
      id: 'map_gen_c1',
      name: '一般地圖卡 C-1',
      category: 'general',
      width: 1,
      height: 1,
      role: 'general',
      description: '一般地圖卡（右欄第1張）：前面為工廠中央警戒區，背面為深灰寬敞草地道路。',
      sides: {
        front: {
          label: '前面（工廠警戒區）',
          role: 'general',
          svg: tileWrap(`
            <rect width="100" height="100" fill="#e2e8f0"/>
            ${hazardBorder(100, 100)}
            <rect x="26" y="26" width="48" height="48" rx="4" fill="#1e293b" stroke="#facc15" stroke-width="3"/>
            <rect x="36" y="36" width="28" height="28" rx="2" fill="#334155"/>
            ${cone(18, 22)}
            ${cone(82, 78)}
          `)
        },
        back: {
          label: '背面（深灰大道）',
          role: 'general',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            <rect x="14" y="0" width="72" height="84" fill="#475569"/>
            <line x1="50" y1="0" x2="50" y2="80" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="6 6"/>
          `)
        }
      }
    },
    {
      id: 'map_gen_c2',
      name: '一般地圖卡 C-2',
      category: 'general',
      width: 1,
      height: 1,
      role: 'general',
      description: '一般地圖卡（右欄第2張）：前面為工廠白色作業區與三角錐，背面為深灰直通道路。',
      sides: {
        front: {
          label: '前面（工廠作業區）',
          role: 'general',
          svg: tileWrap(`
            <rect width="100" height="100" fill="#f8fafc"/>
            ${hazardBorder(100, 100)}
            <rect x="18" y="18" width="64" height="64" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
            ${cone(24, 74)}
            ${cone(76, 26)}
          `)
        },
        back: {
          label: '背面（深灰直路）',
          role: 'general',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            <rect x="18" y="0" width="64" height="100" fill="#475569"/>
            <line x1="50" y1="0" x2="50" y2="100" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="7 6"/>
          `)
        }
      }
    },
    {
      id: 'map_gen_c3',
      name: '一般地圖卡 C-3',
      category: 'general',
      width: 1,
      height: 1,
      role: 'general',
      description: '一般地圖卡（右欄第3張）：前面為工廠開放通道與三角錐，背面為深灰彎道。',
      sides: {
        front: {
          label: '前面（工廠通道）',
          role: 'general',
          svg: tileWrap(`
            <rect width="100" height="100" fill="#f8fafc"/>
            ${hazardBorder(100, 100)}
            <line x1="20" y1="50" x2="80" y2="50" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="5 5"/>
            ${cone(74, 72)}
          `)
        },
        back: {
          label: '背面（深灰彎道）',
          role: 'general',
          svg: tileWrap(`
            ${grassBg(100, 100)}
            <path d="M50,0 L50,50 L100,50" fill="none" stroke="#475569" stroke-width="54" stroke-linejoin="round"/>
            <path d="M50,0 L50,50 L100,50" fill="none" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 6"/>
          `)
        }
      }
    }
  ];

  const MAP_BY_ID = {};
  MAP_CARDS.forEach(m => { MAP_BY_ID[m.id] = m; });

  // 建置「自然保育區」(16×8，A~P × 1~8) 任務地圖的所有格子
  function buildNatureReserveTiles() {
    const tiles = [];
    // 雙格基地卡佔位集合（避免重複鋪底層一般卡）
    const occupied = new Set([
      '1,1', '2,1',   // B2-C2 Green Base
      '5,3', '6,3',   // F4-G4 Red Base
      '13,1', '13,0'  // N2-N1 Blue Base
    ]);

    // 1. 三座功能基地卡（真實觸發紅／綠／藍函式）
    tiles.push({
      col: 1, row: 1, cardId: 'map_base_green', side: 'front', rotation: 0,
      customTag: 'Green Base'
    });
    tiles.push({
      col: 5, row: 3, cardId: 'map_base_red', side: 'front', rotation: 0,
      customTag: 'Red Base'
    });
    tiles.push({
      col: 13, row: 1, cardId: 'map_base_blue', side: 'front', rotation: 270,
      customTag: 'Blue Base'
    });

    // 2. 起點卡 START (H8-I8，以 H8 為起點卡，I8 為起點延伸區)
    occupied.add('7,7');
    tiles.push({
      col: 7, row: 7, cardId: 'map_start', side: 'front', rotation: 270,
      customLabel: 'ST', customTheme: 'zone-start', mergeDir: 'right'
    });

    // 3. 特殊地標與任務區域對照表 (key: "col,row")
    const landmarks = {
      // Row 1 (row 0)
      '3,0':  { label: '看 守', theme: 'zone-facility', mergeDir: 'right' },
      '4,0':  { label: '所',   theme: 'zone-facility', mergeDir: 'left' },
      '7,0':  { label: '森 林', theme: 'zone-fire',     mergeDir: 'right' },
      '8,0':  { label: '大 火', theme: 'zone-fire',     mergeDir: 'left' },
      '11,0': { label: '保 育', theme: 'zone-facility', mergeDir: 'right' },
      '12,0': { label: '所',   theme: 'zone-facility', mergeDir: 'left' },
      // Row 2 (row 1)
      '9,1':  { label: '原民部落\nA', theme: 'zone-village' },
      // Row 3 (row 2)
      '10,2': { label: '植物配置', theme: 'zone-task' },
      // Row 4 (row 3)
      '0,3':  { label: '設立\n保護區', theme: 'zone-task' },
      // Row 5 (row 4)
      '2,4':  { label: '原民部落\nB', theme: 'zone-village' },
      '5,4':  { label: '生', theme: 'zone-corridor-char' },
      '7,4':  { label: '態', theme: 'zone-corridor-char' },
      '9,4':  { label: '廊', theme: 'zone-corridor-char' },
      '11,4': { label: '道', theme: 'zone-corridor-char' },
      '14,4': { label: '水源管理', theme: 'zone-task' },
      // Row 7 (row 6)
      '0,6':  { label: '水 源\n補 給', theme: 'zone-water', mergeDir: 'down' },
      '3,6':  { label: '保 育', theme: 'zone-facility', mergeDir: 'right' },
      '4,6':  { label: '所',   theme: 'zone-facility', mergeDir: 'left' },
      '11,6': { label: '看 守', theme: 'zone-facility', mergeDir: 'right' },
      '12,6': { label: '所',   theme: 'zone-facility', mergeDir: 'left' },
      '14,6': { label: '水源', theme: 'zone-water', mergeDir: 'down' },
      '15,6': { label: '原民部落\nC', theme: 'zone-village' },
      // Row 8 (row 7)
      '0,7':  { label: '處',   theme: 'zone-water', mergeDir: 'up' },
      '5,7':  { label: '棲地營造', theme: 'zone-task' },
      '8,7':  { label: 'ART',  theme: 'zone-start', mergeDir: 'left' },
      '14,7': { label: '補給處', theme: 'zone-water', mergeDir: 'up' }
    };

    // 4. 鋪滿其餘 16×8 網格，使機器人可自由通行於整個自然保育區
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 16; c++) {
        const key = `${c},${r}`;
        if (occupied.has(key)) continue;
        const lm = landmarks[key];
        const inCorridor = (c >= 2 && c <= 13 && r >= 2 && r <= 5);
        tiles.push({
          col: c,
          row: r,
          cardId: 'map_gen_a5',
          side: 'back',
          rotation: 0,
          customLabel: lm ? lm.label : '',
          customTheme: lm ? lm.theme : (inCorridor ? 'zone-corridor-bg' : 'zone-plain'),
          mergeDir: lm ? (lm.mergeDir || '') : ''
        });
      }
    }

    return tiles;
  }

  // 預設範例關卡地圖（方便老師和學生一鍵載入與體驗）
  const PRESET_MAPS = [
    {
      id: 'nature_reserve',
      name: '🌿 自然保育區 (16×8)',
      desc: 'A~P × 1~8 完整自然保育區任務地圖：含 START、紅／綠／藍基地、森林大火、原民部落 A/B/C、保育所、看守所、水源補給處與生態廊道',
      cols: 16,
      rows: 8,
      defaultDir: 3, // 預設面向「上」(北方)
      corridorBox: { colStart: 2, colEnd: 13, rowStart: 2, rowEnd: 5 },
      tiles: buildNatureReserveTiles(),
      sampleProgram: {
        main: ['start', 'forward', 'num_4', 'turn_left', 'forward', 'num_2', 'sound_cheer', 'end'],
        func_red: ['func_red', 'light_red', 'gear_cw', 'num_2', 'sound_firehose', 'end'],
        func_green: ['func_green', 'light_green', 'gear_ccw', 'num_2', 'sound_hi', 'end'],
        func_blue: ['func_blue', 'light_blue', 'gear_cw', 'num_2', 'sound_siren', 'end'],
        condition: []
      }
    },
    {
      id: 'starter_park',
      name: '🌱 基礎草地與函式練習場',
      desc: '包含起點、紅／藍函式基地與事件卡，適合體驗完整功能',
      cols: 6,
      rows: 5,
      defaultDir: 0,
      tiles: [
        { col: 0, row: 2, cardId: 'map_start', side: 'front', rotation: 0 },
        { col: 1, row: 2, cardId: 'map_gen_b2', side: 'back', rotation: 0 },
        { col: 2, row: 2, cardId: 'map_event_2_4', side: 'front', rotation: 0 }, // 事件2
        { col: 3, row: 2, cardId: 'map_gen_b1', side: 'back', rotation: 0 },
        { col: 4, row: 2, cardId: 'map_base_red', side: 'front', rotation: 0 }, // 佔 (4,2) & (5,2)
        { col: 3, row: 1, cardId: 'map_gen_b3', side: 'back', rotation: 0 },
        { col: 3, row: 0, cardId: 'map_event_3_1', side: 'back', rotation: 0 }, // 事件1
        { col: 3, row: 3, cardId: 'map_gen_b3', side: 'back', rotation: 0 },
        { col: 3, row: 4, cardId: 'map_base_blue', side: 'front', rotation: 0 } // 佔 (3,4) & (4,4)
      ],
      sampleProgram: {
        main: ['start', 'forward', 'num_2', 'forward', 'num_2', 'sound_cheer', 'end'],
        func_red: ['func_red', 'light_red', 'gear_cw', 'num_2', 'sound_factory', 'end'],
        func_green: ['func_green', 'light_green', 'gear_ccw', 'num_2', 'end'],
        func_blue: ['func_blue', 'fx_disco', 'sound_penguin', 'end'],
        condition: ['if', 'event_2', 'do', 'light_yellow', 'sound_hi', 'else', 'sound_huh', 'end']
      }
    },
    {
      id: 'event_adventure',
      name: '⚡ 四大事件條件冒險圖',
      desc: '走過事件1～事件4地圖卡，練習 IF / AND / OR / DO / ELSE',
      cols: 6,
      rows: 5,
      tiles: [
        { col: 0, row: 1, cardId: 'map_start', side: 'front', rotation: 0 },
        { col: 1, row: 1, cardId: 'map_event_3_1', side: 'back', rotation: 0 }, // 事件1
        { col: 2, row: 1, cardId: 'map_gen_a4', side: 'front', rotation: 0 },
        { col: 3, row: 1, cardId: 'map_event_2_4', side: 'front', rotation: 0 }, // 事件2
        { col: 3, row: 2, cardId: 'map_event_3_1', side: 'front', rotation: 0 }, // 事件3
        { col: 3, row: 3, cardId: 'map_event_2_4', side: 'back', rotation: 0 },  // 事件4
        { col: 2, row: 3, cardId: 'map_gen_a2', side: 'back', rotation: 0 },
        { col: 1, row: 3, cardId: 'map_gen_a4', side: 'back', rotation: 0 }
      ],
      sampleProgram: {
        main: ['start', 'forward', 'num_3', 'turn_right', 'forward', 'num_2', 'end'],
        func_red: [],
        func_green: [],
        func_blue: [],
        condition: ['if', 'event_1', 'and', 'event_2', 'do', 'light_rainbow', 'sound_cheer', 'else', 'light_purple', 'sound_ah', 'end']
      }
    },
    {
      id: 'factory_loop',
      name: '🏭 工廠迴圈與三色基地挑戰',
      desc: '利用迴圈指令卡巡迴紅、綠、藍三大基地執行齒輪與燈光任務',
      cols: 6,
      rows: 5,
      tiles: [
        { col: 0, row: 0, cardId: 'map_start', side: 'front', rotation: 0 },
        { col: 1, row: 0, cardId: 'map_gen_c2', side: 'front', rotation: 0 },
        { col: 2, row: 0, cardId: 'map_base_red', side: 'front', rotation: 0 },
        { col: 2, row: 1, cardId: 'map_gen_c1', side: 'front', rotation: 0 },
        { col: 2, row: 2, cardId: 'map_base_green', side: 'front', rotation: 0 },
        { col: 1, row: 2, cardId: 'map_gen_c3', side: 'front', rotation: 0 },
        { col: 0, row: 2, cardId: 'map_gen_a1', side: 'back', rotation: 0 },
        { col: 0, row: 1, cardId: 'map_gen_b5', side: 'back', rotation: 0 }
      ],
      sampleProgram: {
        main: ['start', 'loop_green_start', 'num_2', 'forward', 'num_2', 'turn_right', 'loop_green_end', 'sound_cheer', 'end'],
        func_red: ['func_red', 'light_red', 'gear_cw', 'num_2', 'sound_firehose', 'end'],
        func_green: ['func_green', 'fx_emergency', 'gear_ccw', 'num_2', 'sound_siren', 'end'],
        func_blue: [],
        condition: []
      }
    }
  ];

  global.MapCardsModule = {
    CATEGORIES: MAP_CATEGORIES,
    CARDS: MAP_CARDS,
    PRESETS: PRESET_MAPS,
    getById(id) { return MAP_BY_ID[id] || null; },
    getByCategory(catId) {
      if (!catId || catId === 'all') return MAP_CARDS;
      return MAP_CARDS.filter(m => m.category === catId);
    }
  };
})(window);
