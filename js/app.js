/**
 * 主介面互動控制器 (App Controller)
 * 整合：自由排列地圖編輯器、拖拉指令卡編程、多軌程式管理、機器人視覺執行、圖鑑總覽與 JSON 存取
 */
(function (global) {
  'use strict';

  const CmdMod = global.CommandCardsModule;
  const MapMod = global.MapCardsModule;
  const Engine = global.RobotEngine;
  const Audio = global.AudioEngine;
  const TouchDnd = global.TouchDnd;

  const STORAGE_KEY = 'kids_coding_robot_workspace_v2';

  // ==================== 應用程式狀態 ====================
  const state = {
    view: 'workspace', // workspace | cmd-catalog | map-catalog
    enforceStock: false,
    mapZoom: 'auto', // 'auto' | 數值倍率 (0.75 ~ 1.5)
    // 地圖狀態
    map: {
      cols: 6,
      rows: 5,
      corridorBox: null,
      tiles: [] // { uid, col, row, cardId, side: 'front'|'back', rotation: 0|90|180|270, customLabel?, customTheme?, customTag?, mergeDir? }
    },
    initialDir: 3, // 機器人初始方向：0=右, 1=下, 2=左, 3=上
    mapCat: 'all',
    mapPaletteSide: 'front',
    pickedMapCardId: null,
    selectedTileUid: null,
    // 指令卡庫狀態
    cmdCat: 'all',
    cmdSearch: '',
    // 多軌程式狀態
    activeTrack: 'main',
    programs: {
      main: [],
      func_red: [],
      func_green: [],
      func_blue: [],
      condition: []
    },
    // 圖鑑篩選
    catalogCmdCat: 'all',
    catalogMapCat: 'all',
    // 執行器狀態
    runner: null,
    robotVisual: {
      col: 0,
      row: 2,
      dir: 0,
      lightColor: null,
      lightFx: null,
      gearState: 'idle',
      bubbleText: '',
      status: 'ready'
    },
    highlight: { trackId: null, cardIndex: -1, numIndex: -1 }
  };

  let uidCounter = 1;
  function nextUid() { return 'tile_' + (uidCounter++); }

  const TRACK_HINTS = {
    main: '🚀 主程式：必須以「起點」開頭、「終點」結尾。可使用移動、轉向、暫停、迴圈、音效、燈光與數字卡；不可放輸出齒輪卡。',
    func_red: '🔴 紅色函式：必須以「紅色函式起點卡」開頭、「終點」結尾。踩到紅色基地卡（紅星）時觸發，可使用輸出齒輪、轉向、音效、燈光與迴圈。',
    func_green: '🟢 綠色函式：必須以「綠色函式起點卡」開頭、「終點」結尾。踩到綠色基地卡（綠星）時觸發，執行完自動回到基地卡繼續主程式。',
    func_blue: '🔵 藍色函式：必須以「藍色函式起點卡」開頭、「終點」結尾。踩到藍色基地卡（藍星）時觸發，執行完自動回到基地卡繼續主程式。',
    condition: '🔀 條件語句：結構為「如果(IF) → 事件卡 [以及/或者 事件卡] → 執行(DO) → 指令 [否則(ELSE) → 指令] → 終點」。注意：前進/後退/轉向/暫停不可放在「否則」後面！'
  };

  // ==================== DOM 參照 ====================
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const dom = {
    stageWrapper: $('.stage-wrapper'),
    mapGrid: $('#mapGrid'),
    colHeaders: $('#colHeaders'),
    rowHeaders: $('#rowHeaders'),
    initialDirPicker: $('#initialDirPicker'),
    mapCatPills: $('#mapCatPills'),
    mapPalette: $('#mapPalette'),
    presetSelect: $('#presetSelect'),
    gridSizeSelect: $('#gridSizeSelect'),
    selectedTileBar: $('#selectedTileBar'),
    selTileTitle: $('#selTileTitle'),
    selTileSide: $('#selTileSide'),
    selTileCoord: $('#selTileCoord'),
    cmdCatPills: $('#cmdCatPills'),
    cmdPalette: $('#cmdPalette'),
    cmdSearch: $('#cmdSearch'),
    trackTabs: $('#trackTabs'),
    trackRuleHint: $('#trackRuleHint'),
    programTrack: $('#programTrack'),
    validationBox: $('#validationBox'),
    execLog: $('#execLog'),
    robotStatusPill: $('#robotStatusPill'),
    btnRun: $('#btnRun'),
    btnPause: $('#btnPause'),
    btnStep: $('#btnStep'),
    btnReset: $('#btnReset'),
    speedSelect: $('#speedSelect'),
    btnMute: $('#btnMute'),
    btnToggleStock: $('#btnToggleStock'),
    stockModeText: $('#stockModeText'),
    catalogCmdCatPills: $('#catalogCmdCatPills'),
    catalogCmdGrid: $('#catalogCmdGrid'),
    catalogMapCatPills: $('#catalogMapCatPills'),
    catalogMapGrid: $('#catalogMapGrid'),
    cardModal: $('#cardModal'),
    modalBody: $('#modalBody')
  };

  // ==================== 自動暫存（防止 iPad Safari 背景重載遺失進度） ====================
  function serializeWorkspace() {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      initialDir: state.initialDir,
      enforceStock: state.enforceStock,
      map: {
        cols: state.map.cols,
        rows: state.map.rows,
        corridorBox: state.map.corridorBox || null,
        tiles: state.map.tiles.map(({ col, row, cardId, side, rotation, customLabel, customTheme, customTag, mergeDir }) => ({
          col, row, cardId, side, rotation,
          ...(customLabel ? { customLabel } : {}),
          ...(customTheme ? { customTheme } : {}),
          ...(customTag ? { customTag } : {}),
          ...(mergeDir ? { mergeDir } : {})
        }))
      },
      programs: state.programs
    };
  }

  function saveSessionState() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeWorkspace()));
    } catch (_) {
      // Safari 無痕模式或儲存空間受限時靜默略過
    }
  }

  function loadSessionState() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.map || !Array.isArray(parsed.map.tiles)) return false;

      state.map.cols = parsed.map.cols || 6;
      state.map.rows = parsed.map.rows || 5;
      state.map.corridorBox = parsed.map.corridorBox || null;
      state.map.tiles = parsed.map.tiles.map(t => Object.assign({ uid: nextUid() }, t));
      dom.gridSizeSelect.value = `${state.map.cols}x${state.map.rows}`;

      if (typeof parsed.initialDir === 'number') {
        state.initialDir = parsed.initialDir;
      }
      if (typeof parsed.enforceStock === 'boolean') {
        state.enforceStock = parsed.enforceStock;
        dom.stockModeText.textContent = state.enforceStock ? '嚴格盒裝數量' : '自由模式';
      }
      if (parsed.programs) {
        ['main', 'func_red', 'func_green', 'func_blue', 'condition'].forEach(k => {
          state.programs[k] = Array.isArray(parsed.programs[k]) ? parsed.programs[k] : [];
        });
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  // ==================== 日誌輔助 ====================
  function appendLog(msg, level) {
    const line = document.createElement('div');
    line.className = 'log-line ' + (level || 'info');
    const now = new Date();
    const ts = now.toTimeString().slice(0, 8);
    line.textContent = `[${ts}] ${msg}`;
    dom.execLog.appendChild(line);
    dom.execLog.scrollTop = dom.execLog.scrollHeight;
  }

  // ==================== 卡片使用數量統計 ====================
  function getCardUsageMap() {
    const usage = {};
    Object.values(state.programs).forEach(arr => {
      arr.forEach(id => { usage[id] = (usage[id] || 0) + 1; });
    });
    return usage;
  }

  // ==================== 地圖幾何與佔位工具 ====================
  function getTileOccupiedCells(col, row, width, rotation) {
    const cells = [{ col, row }];
    if (width === 2) {
      const rot = ((rotation || 0) % 360 + 360) % 360;
      const vec = Engine.DIR_VECTORS[(rot / 90) % 4];
      cells.push({ col: col + vec.dx, row: row + vec.dy });
    }
    return cells;
  }

  function canPlaceTile(col, row, cardId, rotation, ignoreUid) {
    const def = MapMod.getById(cardId);
    if (!def) return false;
    const needed = getTileOccupiedCells(col, row, def.width, rotation);

    // 1. 不可超出地圖邊界
    for (const c of needed) {
      if (c.col < 0 || c.col >= state.map.cols || c.row < 0 || c.row >= state.map.rows) {
        return false;
      }
    }

    // 2. 檢查是否與其他已放置的地圖卡重疊
    for (const existing of state.map.tiles) {
      if (existing.uid === ignoreUid) continue;
      const exDef = MapMod.getById(existing.cardId);
      if (!exDef) continue;
      const exCells = getTileOccupiedCells(existing.col, existing.row, exDef.width, existing.rotation);
      for (const nc of needed) {
        if (exCells.some(ec => ec.col === nc.col && ec.row === nc.row)) {
          return false;
        }
      }
    }
    return true;
  }

  function placeOrMoveTile(col, row, cardId, side, rotation, movingUid) {
    const def = MapMod.getById(cardId);
    if (!def) return false;

    // 若放置「起點地圖卡」，確保全地圖只有一張起點卡（移動既有或替換舊起點）
    if (def.role === 'start' && !movingUid) {
      state.map.tiles = state.map.tiles.filter(t => {
        const d = MapMod.getById(t.cardId);
        return !d || d.role !== 'start';
      });
    }

    // 若目標格已被單張卡佔用且不是雙格衝突，從卡庫放入時允許覆蓋該格（友善操作）
    if (!movingUid && !canPlaceTile(col, row, cardId, rotation, null)) {
      const needed = getTileOccupiedCells(col, row, def.width, rotation);
      const inBounds = needed.every(c => c.col >= 0 && c.col < state.map.cols && c.row >= 0 && c.row < state.map.rows);
      if (!inBounds) {
        appendLog('⚠️ 此位置超出地圖邊界（雙格基地卡需保留相鄰一格空間）！', 'warn');
        Audio.play('error');
        return false;
      }
      // 移除被覆蓋的舊卡
      state.map.tiles = state.map.tiles.filter(existing => {
        const exDef = MapMod.getById(existing.cardId);
        const exCells = getTileOccupiedCells(existing.col, existing.row, exDef ? exDef.width : 1, existing.rotation);
        return !exCells.some(ec => needed.some(nc => nc.col === ec.col && nc.row === ec.row));
      });
    }

    if (movingUid) {
      if (!canPlaceTile(col, row, cardId, rotation, movingUid)) {
        appendLog('⚠️ 目標位置已有其他地圖卡或超出邊界！', 'warn');
        Audio.play('error');
        return false;
      }
      const target = state.map.tiles.find(t => t.uid === movingUid);
      if (target) {
        target.col = col;
        target.row = row;
        state.selectedTileUid = target.uid;
      }
    } else {
      const newTile = {
        uid: nextUid(),
        col,
        row,
        cardId,
        side: side || state.mapPaletteSide,
        rotation: rotation || 0
      };
      state.map.tiles.push(newTile);
      state.selectedTileUid = newTile.uid;
    }

    Audio.play('click');
    syncRobotToStartIfIdle();
    renderMapStage();
    renderSelectedTileBar();
    saveSessionState();
    return true;
  }

  function syncRobotToStartIfIdle() {
    if (state.runner && state.runner.isRunning()) return;
    const startTile = Engine.findStartTile(state.map);
    if (startTile) {
      state.robotVisual.col = startTile.col;
      state.robotVisual.row = startTile.row;
      state.robotVisual.dir = state.initialDir;
    }
  }

  function renderInitialDirPicker() {
    if (!dom.initialDirPicker) return;
    dom.initialDirPicker.querySelectorAll('.dir-btn').forEach(btn => {
      const d = parseInt(btn.dataset.dir, 10);
      btn.classList.toggle('active', d === state.initialDir);
    });
  }

  function setInitialDir(dir) {
    state.initialDir = dir;
    renderInitialDirPicker();
    if (!state.runner || !state.runner.isRunning()) {
      state.robotVisual.dir = dir;
      renderRobotLayer();
    }
    Audio.play('click');
    const dirName = Engine.DIR_VECTORS[dir]?.name || '';
    appendLog(`🧭 已設定機器人初始方向為：${dirName}`);
    saveSessionState();
  }

  // ==================== 渲染：地圖舞台與機器人 ====================
  function getCellMetrics() {
    const cols = state.map.cols;
    const gap = cols >= 12 ? 2 : 4;
    const wrapW = (dom.stageWrapper && dom.stageWrapper.clientWidth) ? dom.stageWrapper.clientWidth : window.innerWidth;
    // 扣除左右內距、列標寬度(28px)與棋盤邊框(22px)
    const availW = Math.max(260, wrapW - 76);
    const maxCellByWidth = Math.floor((availW - (cols - 1) * gap) / cols);

    let baseSize;
    if (cols >= 12) {
      // 16×8 自然保育區：自動符合容器寬度，並保持 36px~52px 的清晰觸控比例
      baseSize = Math.max(36, Math.min(52, maxCellByWidth));
    } else if (cols >= 7) {
      baseSize = Math.max(48, Math.min(76, maxCellByWidth));
    } else {
      baseSize = Math.max(54, Math.min(86, maxCellByWidth));
    }

    const scale = state.mapZoom === 'auto' ? 1 : state.mapZoom;
    const size = Math.max(32, Math.min(96, Math.round(baseSize * scale)));
    return { size, gap };
  }

  function renderMapStage() {
    const { cols, rows } = state.map;
    const { size, gap } = getCellMetrics();

    dom.mapGrid.style.setProperty('--cols', cols);
    dom.mapGrid.style.setProperty('--rows', rows);
    dom.mapGrid.style.setProperty('--cell-size', size + 'px');
    dom.mapGrid.style.setProperty('--cell-gap', gap + 'px');
    dom.mapGrid.classList.toggle('compact-grid', cols >= 12);
    dom.mapGrid.innerHTML = '';

    // 渲染上方 A~P 欄標與左側 1~8 列標
    if (dom.colHeaders) {
      dom.colHeaders.style.setProperty('--cols', cols);
      dom.colHeaders.style.setProperty('--cell-size', size + 'px');
      dom.colHeaders.style.setProperty('--cell-gap', gap + 'px');
      dom.colHeaders.innerHTML = '';
      for (let c = 0; c < cols; c++) {
        const h = document.createElement('div');
        h.className = 'col-header-item';
        h.textContent = Engine.colToLetter(c);
        dom.colHeaders.appendChild(h);
      }
    }
    if (dom.rowHeaders) {
      dom.rowHeaders.style.setProperty('--rows', rows);
      dom.rowHeaders.style.setProperty('--cell-size', size + 'px');
      dom.rowHeaders.style.setProperty('--cell-gap', gap + 'px');
      dom.rowHeaders.innerHTML = '';
      for (let r = 0; r < rows; r++) {
        const h = document.createElement('div');
        h.className = 'row-header-item';
        h.textContent = String(r + 1);
        dom.rowHeaders.appendChild(h);
      }
    }

    // 1. 建立空白網格底層
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.col = c;
        cell.dataset.row = r;
        cell.dataset.coord = Engine.formatCoord(c, r);

        cell.addEventListener('dragover', e => {
          e.preventDefault();
          cell.classList.add('drag-over');
        });
        cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
        cell.addEventListener('drop', e => {
          e.preventDefault();
          cell.classList.remove('drag-over');
          const raw = e.dataTransfer.getData('application/x-map-tile');
          if (!raw) return;
          try {
            const payload = JSON.parse(raw);
            if (payload.type === 'palette') {
              placeOrMoveTile(c, r, payload.cardId, payload.side, 0, null);
            } else if (payload.type === 'placed') {
              const existing = state.map.tiles.find(t => t.uid === payload.uid);
              if (existing) {
                placeOrMoveTile(c, r, existing.cardId, existing.side, existing.rotation, existing.uid);
              }
            }
          } catch (_) {}
        });

        cell.addEventListener('click', () => {
          if (state.pickedMapCardId) {
            placeOrMoveTile(c, r, state.pickedMapCardId, state.mapPaletteSide, 0, null);
          } else {
            state.selectedTileUid = null;
            renderMapStage();
            renderSelectedTileBar();
          }
        });

        dom.mapGrid.appendChild(cell);
      }
    }

    // 2. 繪製已放置的地圖卡
    const pad = 8;
    state.map.tiles.forEach(tile => {
      const def = MapMod.getById(tile.cardId);
      if (!def) return;
      const sideDef = def.sides[tile.side || 'front'];
      const el = document.createElement('div');
      el.className = 'placed-tile'
        + (state.selectedTileUid === tile.uid ? ' selected' : '')
        + (tile.customTheme ? ' has-custom-zone' : '');
      el.draggable = true;
      el.dataset.dndType = 'placed-tile';
      el.dataset.tileUid = tile.uid;
      const customName = tile.customLabel ? ` [${tile.customLabel.replace(/\n/g, '')}]` : (tile.customTag ? ` [${tile.customTag}]` : '');
      el.title = `${Engine.formatCoord(tile.col, tile.row)} ${def.name}${customName} - ${sideDef.label}（點擊選取，拖曳可移動）`;

      const rot = ((tile.rotation || 0) % 360 + 360) % 360;
      const step = size + gap;

      // 定位外框（考量 2×1 雙格卡的 4 種旋轉方向）
      let boxCol = tile.col;
      let boxRow = tile.row;
      let boxW = size;
      let boxH = size;

      if (def.width === 2) {
        if (rot === 0) {
          boxW = size * 2 + gap;
          boxH = size;
        } else if (rot === 90) {
          boxW = size;
          boxH = size * 2 + gap;
        } else if (rot === 180) {
          boxCol = tile.col - 1;
          boxW = size * 2 + gap;
          boxH = size;
        } else if (rot === 270) {
          boxRow = tile.row - 1;
          boxW = size;
          boxH = size * 2 + gap;
        }
      }

      el.style.left = (pad + boxCol * step) + 'px';
      el.style.top = (pad + boxRow * step) + 'px';
      el.style.width = boxW + 'px';
      el.style.height = boxH + 'px';

      const inner = document.createElement('div');
      inner.className = 'placed-tile-inner';

      if (tile.customTheme) {
        const zoneDiv = document.createElement('div');
        zoneDiv.className = 'custom-zone-layer ' + tile.customTheme + (tile.mergeDir ? ' merge-' + tile.mergeDir : '');
        zoneDiv.textContent = tile.customLabel || '';
        inner.appendChild(zoneDiv);
      } else if (def.width === 2 && (rot === 90 || rot === 270)) {
        // 讓 200x100 SVG 旋轉後完美填滿 1x2 縱向空間
        const rotWrap = document.createElement('div');
        rotWrap.style.width = (size * 2 + gap) + 'px';
        rotWrap.style.height = size + 'px';
        rotWrap.style.transformOrigin = 'top left';
        if (rot === 90) {
          rotWrap.style.transform = `translate(${size}px, 0px) rotate(90deg)`;
        } else {
          rotWrap.style.transform = `translate(0px, ${size * 2 + gap}px) rotate(270deg)`;
        }
        rotWrap.innerHTML = sideDef.svg;
        inner.appendChild(rotWrap);
      } else {
        inner.style.transform = `rotate(${rot}deg)`;
        inner.innerHTML = sideDef.svg;
      }

      el.appendChild(inner);

      if (tile.customTag) {
        const tagEl = document.createElement('div');
        tagEl.className = 'base-custom-badge' + (rot === 270 ? ' badge-top' : '');
        tagEl.textContent = tile.customTag;
        el.appendChild(tagEl);
      }

      el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('application/x-map-tile', JSON.stringify({ type: 'placed', uid: tile.uid }));
      });

      el.addEventListener('click', e => {
        e.stopPropagation();
        if (TouchDnd && TouchDnd.wasJustDragged()) return;
        if (state.pickedMapCardId) {
          // 若目前有從卡庫選取地圖卡，點在舊卡上直接替換
          placeOrMoveTile(tile.col, tile.row, state.pickedMapCardId, state.mapPaletteSide, 0, null);
          return;
        }
        state.selectedTileUid = tile.uid;
        renderMapStage();
        renderSelectedTileBar();
      });

      dom.mapGrid.appendChild(el);
    });

    // 2.5 若地圖帶有生態廊道等特殊區域框線（如自然保育區 C3:N6），繪製於地圖卡上方
    if (state.map.corridorBox) {
      const cb = state.map.corridorBox;
      const step = size + gap;
      const box = document.createElement('div');
      box.className = 'corridor-box-overlay';
      box.style.left = (pad + cb.colStart * step - 1) + 'px';
      box.style.top = (pad + cb.rowStart * step - 1) + 'px';
      box.style.width = ((cb.colEnd - cb.colStart + 1) * step - gap + 2) + 'px';
      box.style.height = ((cb.rowEnd - cb.rowStart + 1) * step - gap + 2) + 'px';
      dom.mapGrid.appendChild(box);
    }

    // 3. 繪製機器人覆蓋層
    renderRobotLayer();
  }

  function renderRobotLayer() {
    let layer = dom.mapGrid.querySelector('.robot-layer');
    const startTile = Engine.findStartTile(state.map);
    if (!startTile) {
      if (layer) layer.remove();
      return;
    }

    const { size, gap } = getCellMetrics();
    const step = size + gap;
    const rv = state.robotVisual;

    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'robot-layer';
      layer.innerHTML = `
        <div class="robot-bubble" id="robotBubble"></div>
        <div class="robot-body" id="robotBody">
          <div class="robot-wheel top"></div>
          <div class="robot-wheel bottom"></div>
          <div class="robot-chassis">
            <div class="robot-gear-hub" id="robotGearHub">
              <div class="robot-gear-core"></div>
            </div>
            <div class="robot-eyes">
              <div class="robot-eye"></div>
              <div class="robot-eye"></div>
            </div>
            <div class="robot-front-arrow"></div>
          </div>
        </div>
      `;
      dom.mapGrid.appendChild(layer);
    }

    layer.style.transform = `translate(${rv.col * step}px, ${rv.row * step}px)`;

    const body = layer.querySelector('#robotBody');
    body.style.transform = `rotate(${rv.dir * 90}deg)`;

    const gear = layer.querySelector('#robotGearHub');
    gear.className = 'robot-gear-hub';
    if (rv.gearState === 'cw') gear.classList.add('spin-cw');
    else if (rv.gearState === 'ccw') gear.classList.add('spin-ccw');

    if (rv.lightColor) {
      gear.style.backgroundColor = rv.lightColor;
      gear.style.boxShadow = `0 0 18px 6px ${rv.lightColor}`;
    } else {
      gear.style.backgroundColor = '#94a3b8';
      gear.style.boxShadow = 'none';
    }
    if (rv.lightFx) {
      gear.classList.add('fx-' + rv.lightFx);
    }

    const bubble = layer.querySelector('#robotBubble');
    if (rv.bubbleText) {
      bubble.textContent = rv.bubbleText;
      bubble.classList.add('show');
    } else {
      bubble.classList.remove('show');
    }
  }

  function renderSelectedTileBar() {
    const tile = state.map.tiles.find(t => t.uid === state.selectedTileUid);
    if (!tile) {
      dom.selectedTileBar.classList.add('hidden');
      return;
    }
    const def = MapMod.getById(tile.cardId);
    const sideDef = def.sides[tile.side || 'front'];
    const extra = tile.customLabel ? `（${tile.customLabel.replace(/\n/g, '')}）` : (tile.customTag ? `（${tile.customTag}）` : '');
    dom.selTileTitle.textContent = def.name + extra;
    dom.selTileSide.textContent = sideDef.label;
    dom.selTileCoord.textContent = `${Engine.formatCoord(tile.col, tile.row)}・旋轉 ${tile.rotation || 0}°`;
    dom.selectedTileBar.classList.remove('hidden');
  }

  // ==================== 渲染：地圖卡庫 ====================
  function renderMapPalette() {
    // 分類標籤
    dom.mapCatPills.innerHTML = '';
    MapMod.CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-pill' + (state.mapCat === cat.id ? ' active' : '');
      btn.textContent = `${cat.icon} ${cat.name}`;
      btn.addEventListener('click', () => {
        state.mapCat = cat.id;
        renderMapPalette();
      });
      dom.mapCatPills.appendChild(btn);
    });

    // 地圖卡清單
    dom.mapPalette.innerHTML = '';
    const cards = MapMod.getByCategory(state.mapCat);
    cards.forEach(card => {
      const sideDef = card.sides[state.mapPaletteSide];
      const item = document.createElement('div');
      item.className = 'map-palette-item' + (state.pickedMapCardId === card.id ? ' active-pick' : '');
      item.draggable = true;
      item.dataset.dndType = 'map-palette';
      item.dataset.cardId = card.id;
      item.title = `${card.name}（${sideDef.label}）— 拖曳至地圖或點選後再點格子`;

      item.innerHTML = `
        <button class="card-info-btn" title="檢視地圖卡說明">i</button>
        <div class="map-thumb ${card.width === 2 ? 'wide' : ''}">${sideDef.svg}</div>
        <div class="map-palette-label">${card.width === 2 ? '2格 ' : ''}${sideDef.label}</div>
      `;

      item.querySelector('.card-info-btn').addEventListener('click', e => {
        e.stopPropagation();
        openMapCardModal(card);
      });

      item.addEventListener('dragstart', e => {
        e.dataTransfer.setData('application/x-map-tile', JSON.stringify({
          type: 'palette',
          cardId: card.id,
          side: state.mapPaletteSide
        }));
      });

      item.addEventListener('click', () => {
        if (TouchDnd && TouchDnd.wasJustDragged()) return;
        state.pickedMapCardId = (state.pickedMapCardId === card.id) ? null : card.id;
        renderMapPalette();
      });

      dom.mapPalette.appendChild(item);
    });
  }

  // ==================== 渲染：指令卡工具箱 ====================
  function renderCmdPalette() {
    dom.cmdCatPills.innerHTML = '';
    CmdMod.CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-pill' + (state.cmdCat === cat.id ? ' active' : '');
      btn.textContent = `${cat.icon} ${cat.name}`;
      btn.addEventListener('click', () => {
        state.cmdCat = cat.id;
        renderCmdPalette();
      });
      dom.cmdCatPills.appendChild(btn);
    });

    const usage = getCardUsageMap();
    const keyword = state.cmdSearch.trim().toLowerCase();
    const cards = CmdMod.getByCategory(state.cmdCat).filter(c => {
      if (!keyword) return true;
      return c.name.toLowerCase().includes(keyword) ||
             c.shortName.toLowerCase().includes(keyword) ||
             c.description.toLowerCase().includes(keyword);
    });

    dom.cmdPalette.innerHTML = '';
    cards.forEach(card => {
      const used = usage[card.id] || 0;
      const remain = card.qty - used;
      const isDepleted = state.enforceStock && remain <= 0;

      const el = document.createElement('div');
      el.className = 'cmd-card-tile' + (isDepleted ? ' depleted' : '');
      el.draggable = true;
      el.dataset.dndType = 'cmd-palette';
      el.dataset.cardId = card.id;
      el.title = `${card.name}（套件數量：${card.qty}）\n${card.description}`;

      const qtyText = state.enforceStock ? `${remain}/${card.qty}` : `×${card.qty}`;
      el.innerHTML = `
        <span class="card-qty-tag ${remain < 0 ? 'over' : ''}">${qtyText}</span>
        <button class="card-info-btn" title="檢視指令卡說明與試聽">i</button>
        ${card.svg}
        <div class="cmd-card-name">${card.shortName}</div>
      `;

      el.querySelector('.card-info-btn').addEventListener('click', e => {
        e.stopPropagation();
        openCmdCardModal(card);
      });

      el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('application/x-cmd-card', JSON.stringify({
          source: 'palette',
          cardId: card.id
        }));
      });

      el.addEventListener('click', () => {
        if (TouchDnd && TouchDnd.wasJustDragged()) return;
        addCardToTrack(state.activeTrack, card.id);
      });

      dom.cmdPalette.appendChild(el);
    });
  }

  // ==================== 程式軌道操作與渲染 ====================
  function addCardToTrack(trackId, cardId, insertIndex) {
    const card = CmdMod.getById(cardId);
    if (!card) return;

    if (state.enforceStock) {
      const usage = getCardUsageMap();
      if ((usage[cardId] || 0) >= card.qty) {
        appendLog(`📦 套件數量提醒：「${card.name}」原盒裝僅有 ${card.qty} 張（可於上方切換自由模式解除限制）。`, 'warn');
        Audio.play('error');
        return;
      }
    }

    const list = state.programs[trackId];
    if (typeof insertIndex === 'number' && insertIndex >= 0 && insertIndex <= list.length) {
      list.splice(insertIndex, 0, cardId);
    } else {
      // 貼心體驗：若軌道最後一張已經是「終點」，點擊新增指令卡時自動插入在「終點」前面！
      if (cardId !== 'end' && list.length > 0 && list[list.length - 1] === 'end') {
        list.splice(list.length - 1, 0, cardId);
      } else {
        list.push(cardId);
      }
    }

    Audio.play('click');
    renderProgramTrack();
    renderCmdPalette();
    runValidationPreview(false);
    saveSessionState();
  }

  function removeCardFromTrack(trackId, index) {
    state.programs[trackId].splice(index, 1);
    Audio.play('click');
    renderProgramTrack();
    renderCmdPalette();
    runValidationPreview(false);
    saveSessionState();
  }

  function moveCardInTrack(trackId, fromIdx, toIdx) {
    const list = state.programs[trackId];
    if (fromIdx < 0 || fromIdx >= list.length || fromIdx === toIdx) return;
    const [item] = list.splice(fromIdx, 1);
    const adjusted = toIdx > fromIdx ? toIdx - 1 : toIdx;
    list.splice(adjusted, 0, item);
    Audio.play('click');
    renderProgramTrack();
    runValidationPreview(false);
    saveSessionState();
  }

  function renderProgramTrack() {
    // 更新軌道數量徽章
    Object.keys(state.programs).forEach(tid => {
      const badge = $('#badge-' + tid);
      if (badge) badge.textContent = state.programs[tid].length;
    });

    $$('.track-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.track === state.activeTrack);
    });

    dom.trackRuleHint.textContent = TRACK_HINTS[state.activeTrack] || '';

    const list = state.programs[state.activeTrack];
    dom.programTrack.innerHTML = '';

    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'track-empty';
      empty.innerHTML = `將上方指令卡<strong>拖曳到這裡</strong>，或直接<strong>點擊指令卡</strong>加入「${Engine.TRACK_LABELS[state.activeTrack]}」<br/><small>也可以點右上角「✨ 補起終點」快速建立架構</small>`;
      dom.programTrack.appendChild(empty);
      return;
    }

    list.forEach((cardId, idx) => {
      const card = CmdMod.getById(cardId);
      if (!card) return;

      const slot = document.createElement('div');
      slot.className = 'prog-card-slot';

      const isExecuting =
        state.highlight.trackId === state.activeTrack &&
        (state.highlight.cardIndex === idx || state.highlight.numIndex === idx);

      const cardEl = document.createElement('div');
      cardEl.className = 'prog-card' + (isExecuting ? ' executing' : '');
      cardEl.draggable = true;
      cardEl.dataset.dndType = 'prog-card';
      cardEl.dataset.trackIndex = String(idx);
      cardEl.title = `${card.name}\n拖曳可調整順序，點右上角 × 可移除`;
      cardEl.innerHTML = `
        <span class="prog-card-index">${idx + 1}</span>
        <button class="prog-card-del" title="移除此張卡">×</button>
        ${card.svg}
        <div class="cmd-card-name">${card.shortName}</div>
      `;

      cardEl.querySelector('.prog-card-del').addEventListener('click', e => {
        e.stopPropagation();
        removeCardFromTrack(state.activeTrack, idx);
      });

      cardEl.addEventListener('dblclick', () => openCmdCardModal(card));

      cardEl.addEventListener('dragstart', e => {
        e.dataTransfer.setData('application/x-cmd-card', JSON.stringify({
          source: 'track',
          fromIdx: idx
        }));
      });

      cardEl.addEventListener('dragover', e => {
        e.preventDefault();
        e.stopPropagation();
        cardEl.classList.add('drag-insert-before');
      });

      cardEl.addEventListener('dragleave', () => {
        cardEl.classList.remove('drag-insert-before');
      });

      cardEl.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        cardEl.classList.remove('drag-insert-before');
        const raw = e.dataTransfer.getData('application/x-cmd-card');
        if (!raw) return;
        try {
          const data = JSON.parse(raw);
          if (data.source === 'palette') {
            addCardToTrack(state.activeTrack, data.cardId, idx);
          } else if (data.source === 'track') {
            moveCardInTrack(state.activeTrack, data.fromIdx, idx);
          }
        } catch (_) {}
      });

      slot.appendChild(cardEl);

      if (idx < list.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'prog-arrow';
        arrow.textContent = '→';
        slot.appendChild(arrow);
      }

      dom.programTrack.appendChild(slot);
    });
  }

  function runValidationPreview(showOkBanner) {
    const res = Engine.validateAll(state.programs, state.enforceStock);
    if (res.errors.length === 0 && res.warnings.length === 0) {
      if (showOkBanner) {
        dom.validationBox.className = 'validation-box ok';
        dom.validationBox.innerHTML = '✅ 語法檢查全部通過！可以按下「▶ 執行程式」讓機器人出發！';
      } else {
        dom.validationBox.className = 'validation-box hidden';
      }
    } else {
      dom.validationBox.className = 'validation-box';
      const html = [
        ...res.errors.map(e => `<div class="val-err">❌ ${e}</div>`),
        ...res.warnings.map(w => `<div class="val-warn">⚠️ ${w}</div>`)
      ].join('');
      dom.validationBox.innerHTML = html;
    }
    return res;
  }

  // ==================== 執行控制 ====================
  function updateStatusPill(status) {
    const mapText = {
      ready: '就緒',
      running: '執行中…',
      paused: '已暫停',
      finished: '已完成',
      error: '發生錯誤'
    };
    dom.robotStatusPill.textContent = mapText[status] || status;
    dom.robotStatusPill.className = 'robot-status-pill ' + status;
  }

  function resetRunner() {
    if (state.runner) {
      state.runner.stop();
      state.runner = null;
    }
    state.highlight = { trackId: null, cardIndex: -1, numIndex: -1 };
    const startTile = Engine.findStartTile(state.map);
    state.robotVisual = {
      col: startTile ? startTile.col : 0,
      row: startTile ? startTile.row : 0,
      dir: state.initialDir,
      lightColor: null,
      lightFx: null,
      gearState: 'idle',
      bubbleText: '',
      status: 'ready'
    };
    dom.btnRun.disabled = false;
    dom.btnRun.textContent = '▶ 執行程式';
    dom.btnPause.disabled = true;
    dom.btnPause.textContent = '⏸ 暫停';
    updateStatusPill('ready');
    renderRobotLayer();
    renderProgramTrack();
  }

  function startExecution(singleStep) {
    // 若正在暫停中且按單步，直接走下一步
    if (state.runner && state.runner.isRunning() && singleStep) {
      state.runner.stepNext();
      return;
    }
    // 若正在暫停中且按執行，繼續執行
    if (state.runner && state.runner.isRunning() && state.runner.isPaused() && !singleStep) {
      state.runner.resume();
      dom.btnPause.textContent = '⏸ 暫停';
      return;
    }

    const val = runValidationPreview(false);
    if (!val.ok) {
      Audio.play('error');
      appendLog('❌ 程式語法尚未通過檢查，請先修正紅色錯誤提示再執行。', 'error');
      return;
    }

    resetRunner();

    state.runner = Engine.createRunner({
      mapState: state.map,
      programs: state.programs,
      initialDir: state.initialDir,
      getSpeedMultiplier: () => parseFloat(dom.speedSelect.value) || 1,
      onStateChange(st) {
        state.robotVisual = st;
        updateStatusPill(st.status);
        renderRobotLayer();
      },
      onLog(msg, lvl) {
        appendLog(msg, lvl);
      },
      onHighlight(trackId, cardIndex, numIndex) {
        state.highlight = { trackId, cardIndex, numIndex };
        // 若正在執行函式或條件語句，自動切換檢視該軌道方便觀察！
        if (trackId && trackId !== state.activeTrack) {
          state.activeTrack = trackId;
        }
        renderProgramTrack();
      },
      onFinish(finalStatus) {
        dom.btnRun.disabled = false;
        dom.btnRun.textContent = '▶ 執行程式';
        dom.btnPause.disabled = true;
        dom.btnPause.textContent = '⏸ 暫停';
        updateStatusPill(finalStatus);
      }
    });

    dom.btnPause.disabled = false;
    if (singleStep) {
      dom.btnPause.textContent = '▶ 繼續連跑';
      state.runner.startSingleStep();
    } else {
      dom.btnRun.disabled = true;
      state.runner.start();
    }
  }

  // ==================== 載入預設範本 ====================
  function loadPreset(presetId, includeProgram) {
    const preset = MapMod.PRESETS.find(p => p.id === presetId) || MapMod.PRESETS[0];
    if (!preset) return;

    resetRunner();
    state.map.cols = preset.cols;
    state.map.rows = preset.rows;
    state.map.corridorBox = preset.corridorBox ? Object.assign({}, preset.corridorBox) : null;
    dom.gridSizeSelect.value = `${preset.cols}x${preset.rows}`;

    if (typeof preset.defaultDir === 'number') {
      state.initialDir = preset.defaultDir;
    } else {
      state.initialDir = 0;
    }
    renderInitialDirPicker();

    state.map.tiles = preset.tiles.map(t => ({
      uid: nextUid(),
      col: t.col,
      row: t.row,
      cardId: t.cardId,
      side: t.side || 'front',
      rotation: t.rotation || 0,
      customLabel: t.customLabel || '',
      customTheme: t.customTheme || '',
      customTag: t.customTag || '',
      mergeDir: t.mergeDir || ''
    }));
    state.selectedTileUid = null;

    if (includeProgram && preset.sampleProgram) {
      state.programs = {
        main: [...(preset.sampleProgram.main || [])],
        func_red: [...(preset.sampleProgram.func_red || [])],
        func_green: [...(preset.sampleProgram.func_green || [])],
        func_blue: [...(preset.sampleProgram.func_blue || [])],
        condition: [...(preset.sampleProgram.condition || [])]
      };
      state.activeTrack = 'main';
    }

    syncRobotToStartIfIdle();
    renderMapStage();
    renderSelectedTileBar();
    renderProgramTrack();
    renderCmdPalette();
    runValidationPreview(false);
    saveSessionState();
    appendLog(`🗺️ 已載入範本「${preset.name}」${includeProgram ? '（含範例程式）' : ''}。`, 'highlight');
  }

  // ==================== 圖鑑總覽視圖 ====================
  function renderCmdCatalog() {
    dom.catalogCmdCatPills.innerHTML = '';
    CmdMod.CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-pill' + (state.catalogCmdCat === cat.id ? ' active' : '');
      btn.textContent = `${cat.icon} ${cat.name}`;
      btn.addEventListener('click', () => {
        state.catalogCmdCat = cat.id;
        renderCmdCatalog();
      });
      dom.catalogCmdCatPills.appendChild(btn);
    });

    const cards = CmdMod.getByCategory(state.catalogCmdCat);
    dom.catalogCmdGrid.innerHTML = '';
    cards.forEach(card => {
      const el = document.createElement('article');
      el.className = 'catalog-card';
      const allowedNames = (card.allowedIn || []).map(t => Engine.TRACK_LABELS[t] || t).join('、');

      let previewBtnHtml = '';
      if (card.category === 'sound') {
        previewBtnHtml = `<button class="btn btn-xs btn-info btn-test-sound">🔊 試聽音效</button>`;
      } else if (card.category === 'light_color' || card.category === 'light_fx') {
        previewBtnHtml = `<button class="btn btn-xs btn-warning btn-test-light">💡 預覽燈光</button>`;
      }

      el.innerHTML = `
        <div class="catalog-card-icon">${card.svg}</div>
        <div class="catalog-card-body">
          <div class="catalog-card-top">
            <h3>${card.name}</h3>
            <span class="qty-pill">盒裝數量：${card.pairTotalQty ? `成對共 ${card.pairTotalQty} 張` : `${card.qty} 張`}</span>
          </div>
          <p class="catalog-card-desc">${card.description}</p>
          <div class="catalog-card-tags">
            <span class="meta-tag">適用：${allowedNames}</span>
            ${card.acceptsNumber ? '<span class="meta-tag num-ok">✓ 可接數字卡 1-9</span>' : ''}
            ${card.forbiddenAfterElse ? '<span class="meta-tag" style="background:#fee2e2;color:#b91c1c;">不可置於 ELSE 後</span>' : ''}
            ${previewBtnHtml}
          </div>
        </div>
      `;

      const soundBtn = el.querySelector('.btn-test-sound');
      if (soundBtn) {
        soundBtn.addEventListener('click', () => Audio.play(card.soundId));
      }
      const lightBtn = el.querySelector('.btn-test-light');
      if (lightBtn) {
        lightBtn.addEventListener('click', () => openCmdCardModal(card));
      }

      dom.catalogCmdGrid.appendChild(el);
    });
  }

  function renderMapCatalog() {
    dom.catalogMapCatPills.innerHTML = '';
    MapMod.CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-pill' + (state.catalogMapCat === cat.id ? ' active' : '');
      btn.textContent = `${cat.icon} ${cat.name}`;
      btn.addEventListener('click', () => {
        state.catalogMapCat = cat.id;
        renderMapCatalog();
      });
      dom.catalogMapCatPills.appendChild(btn);
    });

    const cards = MapMod.getByCategory(state.catalogMapCat);
    dom.catalogMapGrid.innerHTML = '';
    cards.forEach(card => {
      const el = document.createElement('article');
      el.className = 'map-catalog-card';
      const isWide = card.width === 2;
      el.innerHTML = `
        <div class="catalog-card-top">
          <h3>${card.name}</h3>
          <span class="qty-pill">${isWide ? '雙格 2×1 雙面卡' : '單格 1×1 雙面卡'}</span>
        </div>
        <div class="map-sides-row">
          <div class="map-side-box">
            <div class="map-side-preview ${isWide ? 'wide' : ''}">${card.sides.front.svg}</div>
            <span class="map-side-caption">前面：${card.sides.front.label}</span>
          </div>
          <div class="map-side-box">
            <div class="map-side-preview ${isWide ? 'wide' : ''}">${card.sides.back.svg}</div>
            <span class="map-side-caption">背面：${card.sides.back.label}</span>
          </div>
        </div>
        <p class="catalog-card-desc">${card.description}</p>
      `;
      dom.catalogMapGrid.appendChild(el);
    });
  }

  // ==================== 詳情彈窗 (指令卡 / 地圖卡) ====================
  function openCmdCardModal(card) {
    const allowedNames = (card.allowedIn || []).map(t => Engine.TRACK_LABELS[t] || t).join('、');
    let extraHtml = '';
    if (card.category === 'sound') {
      extraHtml = `<div style="margin-top:14px;"><button id="modalSoundBtn" class="btn btn-info">🔊 試聽「${card.shortName}」音效</button></div>`;
    } else if (card.category === 'light_color' || card.category === 'light_fx') {
      extraHtml = `
        <div style="margin-top:14px; text-align:center; background:#0f172a; padding:14px; border-radius:12px;">
          <div id="modalLamp" class="modal-preview-lamp"></div>
          <div style="color:#cbd5e1; font-size:0.78rem; margin-top:8px;">機器人輸出齒輪內部燈光預覽</div>
        </div>
      `;
    }

    dom.modalBody.innerHTML = `
      <div style="display:flex; gap:14px; align-items:center; margin-bottom:12px;">
        <div style="width:76px; height:76px; flex-shrink:0;">${card.svg}</div>
        <div>
          <h3 style="font-size:1.15rem; font-weight:900; margin-bottom:4px;">${card.name}</h3>
          <span class="qty-pill">盒裝標準數量：${card.pairTotalQty ? `成對共 ${card.pairTotalQty} 張` : `${card.qty} 張`}</span>
        </div>
      </div>
      <p style="font-size:0.9rem; line-height:1.65; color:#334155; background:#f8fafc; padding:12px; border-radius:10px; border:1px solid #e2e8f0;">
        ${card.description}
      </p>
      <div class="catalog-card-tags" style="margin-top:10px;">
        <span class="meta-tag">適用軌道：${allowedNames}</span>
        ${card.acceptsNumber ? '<span class="meta-tag num-ok">✓ 後方可接數字卡 1-9 重複執行</span>' : '<span class="meta-tag">後方不可接數字卡</span>'}
      </div>
      ${extraHtml}
    `;

    dom.cardModal.classList.remove('hidden');

    const soundBtn = $('#modalSoundBtn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => Audio.play(card.soundId));
      Audio.play(card.soundId);
    }

    const lamp = $('#modalLamp');
    if (lamp) {
      if (card.category === 'light_color') {
        if (card.lightColor === 'rainbow') {
          const cols = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#6366f1', '#a855f7'];
          let idx = 0;
          const tick = () => {
            if (dom.cardModal.classList.contains('hidden')) return;
            const c = cols[idx % cols.length];
            lamp.style.backgroundColor = c;
            lamp.style.boxShadow = `0 0 22px 8px ${c}`;
            idx++;
            setTimeout(tick, 450);
          };
          tick();
        } else {
          lamp.style.backgroundColor = card.lightColor;
          lamp.style.boxShadow = `0 0 22px 8px ${card.lightColor}`;
        }
      } else if (card.category === 'light_fx') {
        lamp.style.backgroundColor = '#a855f7';
        lamp.style.boxShadow = '0 0 22px 8px #a855f7';
        lamp.classList.add('fx-' + card.fxType);
      }
    }
  }

  function openMapCardModal(card) {
    const isWide = card.width === 2;
    dom.modalBody.innerHTML = `
      <h3 style="font-size:1.15rem; font-weight:900; margin-bottom:10px;">${card.name}</h3>
      <div class="map-sides-row" style="margin-bottom:12px;">
        <div class="map-side-box">
          <div class="map-side-preview ${isWide ? 'wide' : ''}">${card.sides.front.svg}</div>
          <span class="map-side-caption">前面：${card.sides.front.label}</span>
        </div>
        <div class="map-side-box">
          <div class="map-side-preview ${isWide ? 'wide' : ''}">${card.sides.back.svg}</div>
          <span class="map-side-caption">背面：${card.sides.back.label}</span>
        </div>
      </div>
      <p style="font-size:0.9rem; line-height:1.65; color:#334155; background:#f8fafc; padding:12px; border-radius:10px; border:1px solid #e2e8f0;">
        ${card.description}
      </p>
    `;
    dom.cardModal.classList.remove('hidden');
  }

  function closeModal() {
    dom.cardModal.classList.add('hidden');
  }

  // ==================== 綁定事件 ====================
  function bindEvents() {
    // 頂部主分頁切換
    $$('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        state.view = view;
        $$('.nav-tab').forEach(t => {
          t.classList.toggle('active', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        $('#view-workspace').classList.toggle('active', view === 'workspace');
        $('#view-cmd-catalog').classList.toggle('active', view === 'cmd-catalog');
        $('#view-map-catalog').classList.toggle('active', view === 'map-catalog');
        if (view === 'cmd-catalog') renderCmdCatalog();
        if (view === 'map-catalog') renderMapCatalog();
        window.scrollTo({ top: 0 });
      });
    });

    // 靜音切換
    dom.btnMute.addEventListener('click', () => {
      const next = !Audio.isMuted();
      Audio.setMuted(next);
      dom.btnMute.textContent = next ? '🔇 已靜音' : '🔊 音效開';
    });

    // 套件數量模式切換
    dom.btnToggleStock.addEventListener('click', () => {
      state.enforceStock = !state.enforceStock;
      dom.stockModeText.textContent = state.enforceStock ? '嚴格盒裝數量' : '自由模式';
      renderCmdPalette();
      runValidationPreview(false);
    });

    // 載入範本
    $('#btnLoadPreset').addEventListener('click', () => {
      loadPreset(dom.presetSelect.value, true);
    });

    // 地圖尺寸切換
    dom.gridSizeSelect.addEventListener('change', () => {
      const [c, r] = dom.gridSizeSelect.value.split('x').map(Number);
      state.map.cols = c;
      state.map.rows = r;
      if (c !== 16 || r !== 8) state.map.corridorBox = null;
      // 移除超出新邊界的卡片
      state.map.tiles = state.map.tiles.filter(t => {
        const def = MapMod.getById(t.cardId);
        const cells = getTileOccupiedCells(t.col, t.row, def ? def.width : 1, t.rotation);
        return cells.every(cell => cell.col >= 0 && cell.col < c && cell.row >= 0 && cell.row < r);
      });
      resetRunner();
      renderMapStage();
    });

    // 地圖縮放（自動／放大／縮小，方便 iPad 與不同尺寸螢幕檢視 16×8 地圖）
    $('#btnZoomOut').addEventListener('click', () => {
      const cur = state.mapZoom === 'auto' ? 1 : state.mapZoom;
      state.mapZoom = Math.max(0.75, Math.round((cur - 0.15) * 100) / 100);
      renderMapStage();
    });
    $('#btnZoomAuto').addEventListener('click', () => {
      state.mapZoom = 'auto';
      renderMapStage();
    });
    $('#btnZoomIn').addEventListener('click', () => {
      const cur = state.mapZoom === 'auto' ? 1 : state.mapZoom;
      state.mapZoom = Math.min(1.5, Math.round((cur + 0.15) * 100) / 100);
      renderMapStage();
    });

    // 清空地圖
    $('#btnClearMap').addEventListener('click', () => {
      state.map.tiles = [];
      state.map.corridorBox = null;
      state.selectedTileUid = null;
      resetRunner();
      renderMapStage();
      renderSelectedTileBar();
      saveSessionState();
      appendLog('🧹 已清空地圖，請從下方拖曳「起點地圖卡」與其他地圖卡自由排布。');
    });

    // 機器人初始方向選擇（上 / 下 / 左 / 右）
    if (dom.initialDirPicker) {
      dom.initialDirPicker.querySelectorAll('.dir-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          setInitialDir(parseInt(btn.dataset.dir, 10));
        });
      });
    }

    // 已選取地圖卡的快捷操作：翻面 / 旋轉 / 說明 / 移除
    $('#btnTileFlip').addEventListener('click', () => {
      const tile = state.map.tiles.find(t => t.uid === state.selectedTileUid);
      if (!tile) return;
      tile.side = tile.side === 'front' ? 'back' : 'front';
      Audio.play('click');
      renderMapStage();
      renderSelectedTileBar();
      saveSessionState();
    });

    $('#btnTileRotate').addEventListener('click', () => {
      const tile = state.map.tiles.find(t => t.uid === state.selectedTileUid);
      if (!tile) return;
      const nextRot = ((tile.rotation || 0) + 90) % 360;
      if (!canPlaceTile(tile.col, tile.row, tile.cardId, nextRot, tile.uid)) {
        appendLog('⚠️ 旋轉 90° 後會超出邊界或與其他地圖卡重疊，請先騰出旁邊格子！', 'warn');
        Audio.play('error');
        return;
      }
      tile.rotation = nextRot;
      Audio.play('click');
      syncRobotToStartIfIdle();
      renderMapStage();
      renderSelectedTileBar();
      saveSessionState();
    });

    $('#btnTileInfo').addEventListener('click', () => {
      const tile = state.map.tiles.find(t => t.uid === state.selectedTileUid);
      if (!tile) return;
      const def = MapMod.getById(tile.cardId);
      if (def) openMapCardModal(def);
    });

    $('#btnTileRemove').addEventListener('click', () => {
      state.map.tiles = state.map.tiles.filter(t => t.uid !== state.selectedTileUid);
      state.selectedTileUid = null;
      Audio.play('click');
      resetRunner();
      renderMapStage();
      renderSelectedTileBar();
      saveSessionState();
    });

    // 地圖卡庫前後面預覽切換
    $('#btnPaletteSideFront').addEventListener('click', () => {
      state.mapPaletteSide = 'front';
      $('#btnPaletteSideFront').classList.add('active');
      $('#btnPaletteSideBack').classList.remove('active');
      renderMapPalette();
    });
    $('#btnPaletteSideBack').addEventListener('click', () => {
      state.mapPaletteSide = 'back';
      $('#btnPaletteSideBack').classList.add('active');
      $('#btnPaletteSideFront').classList.remove('active');
      renderMapPalette();
    });

    // 搜尋指令卡
    dom.cmdSearch.addEventListener('input', () => {
      state.cmdSearch = dom.cmdSearch.value;
      renderCmdPalette();
    });

    // 程式軌道切換
    $$('.track-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeTrack = btn.dataset.track;
        renderProgramTrack();
      });
    });

    // 程式軌道放置區（放到尾端）
    dom.programTrack.addEventListener('dragover', e => {
      e.preventDefault();
      dom.programTrack.classList.add('drag-over');
    });
    dom.programTrack.addEventListener('dragleave', () => {
      dom.programTrack.classList.remove('drag-over');
    });
    dom.programTrack.addEventListener('drop', e => {
      e.preventDefault();
      dom.programTrack.classList.remove('drag-over');
      const raw = e.dataTransfer.getData('application/x-cmd-card');
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (data.source === 'palette') {
          addCardToTrack(state.activeTrack, data.cardId, state.programs[state.activeTrack].length);
        } else if (data.source === 'track') {
          moveCardInTrack(state.activeTrack, data.fromIdx, state.programs[state.activeTrack].length);
        }
      } catch (_) {}
    });

    // 自動補起點與終點
    $('#btnAutoWrap').addEventListener('click', () => {
      const tid = state.activeTrack;
      const list = state.programs[tid];
      const startMap = {
        main: 'start',
        func_red: 'func_red',
        func_green: 'func_green',
        func_blue: 'func_blue',
        condition: 'if'
      };
      const expectedStart = startMap[tid];
      if (list[0] !== expectedStart) list.unshift(expectedStart);
      if (tid === 'condition' && !list.includes('do')) {
        if (!list.some(id => id.startsWith('event_'))) list.splice(1, 0, 'event_1');
        list.splice(2, 0, 'do');
      }
      if (list[list.length - 1] !== 'end') list.push('end');
      Audio.play('click');
      renderProgramTrack();
      renderCmdPalette();
      runValidationPreview(false);
      saveSessionState();
    });

    // 檢查語法
    $('#btnValidate').addEventListener('click', () => {
      const res = runValidationPreview(true);
      if (res.ok) {
        Audio.play('scan');
        appendLog('✅ 所有程式軌道語法檢查通過！', 'success');
      } else {
        Audio.play('error');
        appendLog(`❌ 發現 ${res.errors.length} 項語法錯誤，請檢視上方提示。`, 'error');
      }
    });

    // 清空目前軌道
    $('#btnClearTrack').addEventListener('click', () => {
      state.programs[state.activeTrack] = [];
      Audio.play('click');
      renderProgramTrack();
      renderCmdPalette();
      runValidationPreview(false);
      saveSessionState();
    });

    // 清除日誌
    $('#btnClearLog').addEventListener('click', () => {
      dom.execLog.innerHTML = '';
    });

    // 執行控制列
    dom.btnRun.addEventListener('click', () => startExecution(false));
    dom.btnStep.addEventListener('click', () => startExecution(true));
    dom.btnPause.addEventListener('click', () => {
      if (!state.runner || !state.runner.isRunning()) return;
      if (state.runner.isPaused()) {
        state.runner.resume();
        dom.btnPause.textContent = '⏸ 暫停';
      } else {
        state.runner.pause();
        dom.btnPause.textContent = '▶ 繼續';
      }
    });
    dom.btnReset.addEventListener('click', () => {
      resetRunner();
      appendLog('⏹ 已重置機器人回到起點。');
    });

    // 匯出 JSON
    $('#btnExport').addEventListener('click', () => {
      const data = serializeWorkspace();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kids-coding-robot-project.json';
      a.click();
      URL.revokeObjectURL(url);
      appendLog('💾 已匯出地圖與程式設定檔 (kids-coding-robot-project.json)。', 'success');
    });

    // 匯入 JSON
    $('#inputImport').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (typeof parsed.initialDir === 'number') {
            state.initialDir = parsed.initialDir;
            renderInitialDirPicker();
          }
          if (parsed.map && Array.isArray(parsed.map.tiles)) {
            state.map.cols = parsed.map.cols || 6;
            state.map.rows = parsed.map.rows || 5;
            state.map.corridorBox = parsed.map.corridorBox || null;
            dom.gridSizeSelect.value = `${state.map.cols}x${state.map.rows}`;
            state.map.tiles = parsed.map.tiles.map(t => Object.assign({ uid: nextUid() }, t));
          }
          if (parsed.programs) {
            ['main', 'func_red', 'func_green', 'func_blue', 'condition'].forEach(k => {
              state.programs[k] = Array.isArray(parsed.programs[k]) ? parsed.programs[k] : [];
            });
          }
          resetRunner();
          renderMapStage();
          renderProgramTrack();
          renderCmdPalette();
          runValidationPreview(false);
          saveSessionState();
          appendLog(`📂 成功匯入專案檔：${file.name}`, 'success');
        } catch (err) {
          Audio.play('error');
          appendLog('❌ 匯入失敗：檔案格式不正確。', 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // 關閉彈窗
    $('#btnCloseModal').addEventListener('click', closeModal);
    dom.cardModal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });

    let resizeTimer = null;
    const handleViewportChange = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (state.view === 'workspace') renderMapStage();
      }, 90);
    };
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
  }

  // ==================== 初始化 ====================
  function init() {
    $('#cmdTotalCount').textContent = CmdMod.CARDS.length;
    $('#mapTotalCount').textContent = MapMod.CARDS.length;

    // 填入預設範本下拉選單
    MapMod.PRESETS.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      dom.presetSelect.appendChild(opt);
    });

    bindEvents();

    // 初始化 iPad / 平板觸控拖曳模組
    if (TouchDnd) {
      TouchDnd.init({
        onDropMapFromPalette(cardId, col, row) {
          placeOrMoveTile(col, row, cardId, state.mapPaletteSide, 0, null);
        },
        onMovePlacedTile(uid, col, row) {
          const existing = state.map.tiles.find(t => t.uid === uid);
          if (existing) {
            placeOrMoveTile(col, row, existing.cardId, existing.side, existing.rotation, existing.uid);
          }
        },
        onDropCmdFromPalette(cardId, insertIdx) {
          const idx = typeof insertIdx === 'number' ? insertIdx : state.programs[state.activeTrack].length;
          addCardToTrack(state.activeTrack, cardId, idx);
        },
        onMoveProgCard(fromIdx, toIdx) {
          const idx = typeof toIdx === 'number' ? toIdx : state.programs[state.activeTrack].length;
          moveCardInTrack(state.activeTrack, fromIdx, idx);
        }
      });

      if (TouchDnd.isTouchDevice()) {
        const tip = $('.palette-tip');
        if (tip) {
          tip.textContent = '👆 輕點地圖卡再點格子可快速放置，或「長按地圖卡／已放卡片」拖曳到指定位置！';
        }
      }
    }

    renderMapPalette();
    renderCmdPalette();

    // 若瀏覽器有先前自動暫存的進度則還原，否則載入預設「自然保育區」範本
    const restored = loadSessionState();
    if (restored) {
      renderInitialDirPicker();
      syncRobotToStartIfIdle();
      renderMapStage();
      renderSelectedTileBar();
      renderProgramTrack();
      renderCmdPalette();
      runValidationPreview(false);
      appendLog('🔄 已自動還原上次的地圖與程式進度！若要重新開始可於上方切換範本並點「載入範本」。', 'highlight');
    } else {
      loadPreset(MapMod.PRESETS[0].id, true);
      appendLog(`👋 歡迎來到兒童互動編程機器人模組！已預載「${MapMod.PRESETS[0].name}」，可自由設定機器人初始方向（上／下／左／右）並按「▶ 執行程式」試跑！`, 'info');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
