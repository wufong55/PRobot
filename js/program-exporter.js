/**
 * 指令集圖片匯出模組 (Program Image Exporter)
 * 將「主程式」與所有已編寫的「紅／綠／藍函式」、「條件語句 (IF)」繪製為高解析 PNG 圖片。
 * 完全使用原生 Canvas + data:image/svg+xml，支援離線 file://、GitHub Pages、電腦與 iPad Safari。
 */
(function (global) {
  'use strict';

  const TRACK_META = [
    { id: 'main',       title: '主程式',          badge: 'MAIN', accent: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    { id: 'func_red',   title: '紅色函式',        badge: 'RED',  accent: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    { id: 'func_green', title: '綠色函式',        badge: 'GRN',  accent: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    { id: 'func_blue',  title: '藍色函式',        badge: 'BLU',  accent: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
    { id: 'condition',  title: '條件語句 (IF)',   badge: 'IF',   accent: '#c026d3', bg: '#fdf4ff', border: '#f5d0fe' }
  ];

  const FONT_FAMILY = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif';

  // 將單張指令卡的 SVG 字串轉為可繪製於 Canvas 的 Image（附快取，並補上明確寬高相容 iPad Safari）
  const svgImgCache = new Map();

  function loadSvgAsImage(cardId, svgString) {
    if (svgImgCache.has(cardId)) return svgImgCache.get(cardId);
    const p = new Promise((resolve, reject) => {
      const normalized = svgString.replace(
        '<svg ',
        '<svg width="160" height="160" '
      );
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = err => reject(err);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(normalized);
    });
    svgImgCache.set(cardId, p);
    return p;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  /**
   * 產生主程式與函式指令集 PNG（回傳 { dataUrl, blob, width, height, trackCount, totalCards }）
   */
  async function generateProgramImage(options) {
    const {
      programs,
      startCoordText,
      initialDirText,
      mapTitle
    } = options;

    const CmdMod = global.CommandCardsModule;
    const activeTracks = TRACK_META
      .map(meta => ({
        meta,
        cards: (programs[meta.id] || []).map(id => CmdMod.getById(id)).filter(Boolean)
      }))
      .filter(t => t.cards.length > 0);

    if (activeTracks.length === 0) {
      throw new Error('目前尚未編排任何指令卡，請先在主程式或函式放入指令卡再匯出圖片！');
    }

    // 預載所有使用到的指令卡 SVG 圖示
    const uniqueMap = new Map();
    activeTracks.forEach(t => t.cards.forEach(c => uniqueMap.set(c.id, c.svg)));
    const loadedImgs = new Map();
    await Promise.all(
      Array.from(uniqueMap.entries()).map(async ([id, svg]) => {
        try {
          loadedImgs.set(id, await loadSvgAsImage(id, svg));
        } catch (_) {
          loadedImgs.set(id, null);
        }
      })
    );

    // 版面幾何參數（邏輯像素，輸出 2× Retina）
    const CARDS_PER_ROW = 10;
    const CARD_W = 84;
    const CARD_H = 100;
    const ARROW_W = 20;
    const SLOT_STEP = CARD_W + ARROW_W;
    const ROW_GAP = 16;
    const PAD_X = 28;
    const SECTION_PAD_X = 20;
    const SECTION_HEADER_H = 44;
    const SECTION_PAD_BOTTOM = 18;
    const SECTION_GAP = 18;
    const HEADER_H = 88;
    const FOOTER_H = 34;

    const maxColsUsed = Math.min(
      CARDS_PER_ROW,
      Math.max(6, ...activeTracks.map(t => Math.min(CARDS_PER_ROW, t.cards.length)))
    );

    const innerContentW = maxColsUsed * CARD_W + (maxColsUsed - 1) * ARROW_W;
    const canvasW = Math.max(760, PAD_X * 2 + SECTION_PAD_X * 2 + innerContentW);

    // 計算每個軌道區塊高度與總高度
    let totalH = HEADER_H + 22;
    const sectionLayouts = activeTracks.map(t => {
      const rows = Math.ceil(t.cards.length / CARDS_PER_ROW);
      const secH = SECTION_HEADER_H + rows * CARD_H + (rows - 1) * ROW_GAP + SECTION_PAD_BOTTOM;
      const layout = { track: t, rows, y: totalH, height: secH };
      totalH += secH + SECTION_GAP;
      return layout;
    });
    totalH += FOOTER_H;

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(canvasW * scale);
    canvas.height = Math.round(totalH * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // 背景
    ctx.fillStyle = '#f0f5fa';
    ctx.fillRect(0, 0, canvasW, totalH);

    // 頂部標題橫幅
    const headerGrad = ctx.createLinearGradient(0, 0, canvasW, HEADER_H);
    headerGrad.addColorStop(0, '#1e3a8a');
    headerGrad.addColorStop(0.55, '#2563eb');
    headerGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, canvasW, HEADER_H);

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 24px ${FONT_FAMILY}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('兒童互動編程機器人｜程式指令集', PAD_X, 34);

    const metaLine = [
      mapTitle ? `地圖：${mapTitle}` : '',
      startCoordText ? `起點：${startCoordText}` : '',
      initialDirText ? `初始方向：${initialDirText}` : ''
    ].filter(Boolean).join('　｜　');

    ctx.fillStyle = '#dbeafe';
    ctx.font = `600 13px ${FONT_FAMILY}`;
    ctx.fillText(metaLine, PAD_X, 64);

    // 右上角總卡數與日期
    const totalCards = activeTracks.reduce((sum, t) => sum + t.cards.length, 0);
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 14px ${FONT_FAMILY}`;
    ctx.fillText(`共 ${activeTracks.length} 個軌道・${totalCards} 張指令卡`, canvasW - PAD_X, 34);
    ctx.fillStyle = '#bfdbfe';
    ctx.font = `500 12px ${FONT_FAMILY}`;
    ctx.fillText(dateStr, canvasW - PAD_X, 64);
    ctx.textAlign = 'left';

    // 繪製各個軌道區塊
    sectionLayouts.forEach(sec => {
      const { track, y, height } = sec;
      const { meta, cards } = track;
      const boxX = PAD_X;
      const boxW = canvasW - PAD_X * 2;

      // 區塊白色卡片底框
      roundRectPath(ctx, boxX, y, boxW, height, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = meta.border;
      ctx.stroke();

      // 區塊標題列底色
      ctx.save();
      roundRectPath(ctx, boxX, y, boxW, SECTION_HEADER_H, 14);
      ctx.clip();
      ctx.fillStyle = meta.bg;
      ctx.fillRect(boxX, y, boxW, SECTION_HEADER_H);
      ctx.restore();

      // 左側色條
      roundRectPath(ctx, boxX + 12, y + 10, 6, 24, 3);
      ctx.fillStyle = meta.accent;
      ctx.fill();

      // 軌道名稱
      ctx.fillStyle = '#0f172a';
      ctx.font = `800 16px ${FONT_FAMILY}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(`${meta.title}`, boxX + 26, y + 22);

      // 張數膠囊
      const countText = `${cards.length} 張指令卡`;
      ctx.font = `700 12px ${FONT_FAMILY}`;
      const pillW = ctx.measureText(countText).width + 20;
      const pillX = boxX + boxW - pillW - 14;
      roundRectPath(ctx, pillX, y + 10, pillW, 24, 12);
      ctx.fillStyle = meta.accent;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(countText, pillX + pillW / 2, y + 22);
      ctx.textAlign = 'left';

      // 繪製該軌道內所有指令卡
      cards.forEach((card, idx) => {
        const row = Math.floor(idx / CARDS_PER_ROW);
        const col = idx % CARDS_PER_ROW;
        const cx = boxX + SECTION_PAD_X + col * SLOT_STEP;
        const cy = y + SECTION_HEADER_H + 10 + row * (CARD_H + ROW_GAP);

        // 外框
        roundRectPath(ctx, cx, cy, CARD_W, CARD_H, 10);
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();

        // SVG 圖示
        const img = loadedImgs.get(card.id);
        if (img) {
          ctx.drawImage(img, cx + 10, cy + 8, 64, 64);
        } else {
          roundRectPath(ctx, cx + 10, cy + 8, 64, 64, 8);
          ctx.fillStyle = card.color || '#94a3b8';
          ctx.fill();
        }

        // 步驟編號圓標
        ctx.beginPath();
        ctx.arc(cx + 8, cy + 8, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#334155';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 10px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(idx + 1), cx + 8, cy + 8.5);

        // 指令短名稱
        ctx.fillStyle = '#1e293b';
        ctx.font = `700 11px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText(card.shortName, cx + CARD_W / 2, cy + 86, CARD_W - 8);

        // 連接箭頭（同一列非最後一張且非全軌最後一張）
        if (idx < cards.length - 1 && col < CARDS_PER_ROW - 1) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = `900 15px ${FONT_FAMILY}`;
          ctx.textAlign = 'center';
          ctx.fillText('→', cx + CARD_W + ARROW_W / 2, cy + CARD_H / 2 - 4);
        }
      });
    });

    // 底部頁尾標示
    ctx.fillStyle = '#64748b';
    ctx.font = `600 11px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('兒童互動編程機器人網頁模組・自動匯出指令集圖片', canvasW / 2, totalH - FOOTER_H / 2);

    const dataUrl = canvas.toDataURL('image/png');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

    return {
      dataUrl,
      blob,
      width: canvasW,
      height: totalH,
      trackCount: activeTracks.length,
      totalCards
    };
  }

  global.ProgramExporter = {
    TRACK_META,
    generateProgramImage
  };
})(window);
