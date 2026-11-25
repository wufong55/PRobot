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
  const ProgramExporter = global.ProgramExporter;

  const STORAGE_KEY = 'kids_coding_robot_workspace_v3';

  // ==================== 應用程式狀態 ====================
  const state = {
    view: 'workspace', // workspace | cmd-catalog | map-catalog
    focusMode: false, // 專注瀏覽模式（只顯示地圖與全部程式集）
    enforceStock: true, // 預設為嚴格盒裝數量
    showTrail: true, // 是否顯示機器人執行時的移動軌跡路線
    trailPoints: [], // [{ col, row, kind: 'start'|'move'|'base_in'|'base_out' }]
    mapZoom: 'auto', // 'auto' | 數值倍率 (0.75 ~ 1.5)
    // 地圖狀態
    map: {
      cols: 6,
      rows: 5,
      corridorBox: null,
      tiles: [] // { uid, col, row, cardId, side: 'front'|'back', rotation: 0|90|180|270, customLabel?, customTheme?, customTag?, mergeDir? }
    },
    initialDir: 3, // 機器人初始方向：0=右, 1=下, 2=左, 3=上
    startPos: null, // 機器人自訂起始位置：{ col, row } 或 null（跟隨起點地圖卡）
    pickingStartPos: false, // 是否正處於「點選地圖設定起點」模式
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
    func_red: '🔴 紅色函式：必須以「紅色函式起點卡」開頭、「終點」結尾。機器人面向與紅基地箭頭一致進入紅星格時，自動前進一步進基地並執行，結束後自動退回紅星格繼續主程式。',
    func_green: '🟢 綠色函式：必須以「綠色函式起點卡」開頭、「終點」結尾。機器人面向與綠基地箭頭一致進入綠星格時，自動前進一步進基地並執行，結束後自動退回綠星格繼續主程式。',
    func_blue: '🔵 藍色函式：必須以「藍色函式起點卡」開頭、「終點」結尾。機器人面向與藍基地箭頭一致進入藍星格時，自動前進一步進基地並執行，結束後自動退回藍星格繼續主程式。',
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
    btnPickStartPos: $('#btnPickStartPos'),
    startPosCoordText: $('#startPosCoordText'),
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
    focusProgramsList: $('#focusProgramsList'),
    btnFocusMode: $('#btnFocusMode'),
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
    btnToggleTrail: $('#btnToggleTrail'),
    trailStateText: $('#trailStateText'),
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
      version: 3,
      exportedAt: new Date().toISOString(),
      initialDir: state.initialDir,
      startPos: state.startPos ? { col: state.startPos.col, row: state.startPos.row } : null,
      enforceStock: state.enforceStock,
      showTrail: state.showTrail,
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
      if (parsed.startPos && typeof parsed.startPos.col === 'number' && typeof parsed.startPos.row === 'number') {
        state.startPos = { col: parsed.startPos.col, row: parsed.startPos.row };
      } else {
        state.startPos = null;
      }
      if (typeof parsed.enforceStock === 'boolean') {
        state.enforceStock = parsed.enforceStock;
      }
      dom.stockModeText.textContent = state.enforceStock ? '嚴格盒裝數量' : '自由模式';
      if (typeof parsed.showTrail === 'boolean') {
        state.showTrail = parsed.showTrail;
      }
      renderTrailToggle();
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

  function getEffectiveStartPos() {
    if (
      state.startPos &&
      Engine.getCellInfo(state.map, state.startPos.col, state.startPos.row)
    ) {
      return { col: state.startPos.col, row: state.startPos.row };
    }
    const startTile = Engine.findStartTile(state.map);
    if (startTile) {
      return { col: startTile.col, row: startTile.row };
    }
    return null;
  }

  function renderStartPosControl() {
    if (!dom.btnPickStartPos) return;
    const pos = getEffectiveStartPos();
    const coordLabel = pos ? Engine.formatCoord(pos.col, pos.row) : '未設定';
    dom.btnPickStartPos.classList.toggle('picking', state.pickingStartPos);
    if (state.pickingStartPos) {
      dom.btnPickStartPos.innerHTML = `📍 請點選地圖任一格…（再點取消）`;
    } else {
      dom.btnPickStartPos.innerHTML = `📍 起點：<span id="startPosCoordText">${coordLabel}</span>（點擊調整）`;
    }
    if (dom.mapGrid) {
      dom.mapGrid.classList.toggle('picking-start', state.pickingStartPos);
    }
  }

  function setCustomStartPos(col, row) {
    if (!Engine.getCellInfo(state.map, col, row)) {
      Audio.play('error');
      appendLog(`⚠️ ${Engine.formatCoord(col, row)} 尚未放置地圖卡，請選擇有地圖卡的格子作為起始位置！`, 'warn');
      return false;
    }
    state.startPos = { col, row };
    state.pickingStartPos = false;
    Audio.play('scan');
    if (!state.runner || !state.runner.isRunning()) {
      state.robotVisual.col = col;
      state.robotVisual.row = row;
      state.robotVisual.dir = state.initialDir;
    }
    renderStartPosControl();
    renderRobotLayer();
    saveSessionState();
    appendLog(`📍 已將機器人起始位置調整至 ${Engine.formatCoord(col, row)}！`, 'highlight');
    return true;
  }

  function syncRobotToStartIfIdle() {
    renderStartPosControl();
    if (state.runner && state.runner.isRunning()) return;
    const pos = getEffectiveStartPos();
    if (pos) {
      state.robotVisual.col = pos.col;
      state.robotVisual.row = pos.row;
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
    dom.mapGrid.classList.toggle('picking-start', state.pickingStartPos);
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
          if (state.pickingStartPos) {
            setCustomStartPos(c, r);
            return;
          }
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

    // 3. 繪製移動軌跡層與機器人覆蓋層
    renderTrailLayer();
    renderRobotLayer();
  }

  function renderTrailToggle() {
    if (!dom.btnToggleTrail) return;
    dom.btnToggleTrail.classList.toggle('active', state.showTrail);
    if (dom.trailStateText) {
      dom.trailStateText.textContent = state.showTrail ? '開' : '關';
    }
  }

  function renderTrailLayer() {
    let svg = dom.mapGrid.querySelector('.trail-svg-layer');
    if (!state.showTrail || !state.trailPoints || state.trailPoints.length < 1) {
      if (svg) svg.remove();
      return;
    }

    const { size, gap } = getCellMetrics();
    const step = size + gap;
    const pad = 8;
    const totalW = pad * 2 + state.map.cols * size + (state.map.cols - 1) * gap;
    const totalH = pad * 2 + state.map.rows * size + (state.map.rows - 1) * gap;

    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'trail-svg-layer');
      dom.mapGrid.appendChild(svg);
    }

    svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);

    const cx = col => pad + col * step + size / 2;
    const cy = row => pad + row * step + size / 2;

    const parts = [];
    const pts = state.trailPoints;
    const strokeW = Math.max(3, Math.round(size * 0.095));

    // 繪製每一段移動線段與方向箭頭
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      let x1 = cx(a.col);
      let y1 = cy(a.row);
      let x2 = cx(b.col);
      let y2 = cy(b.row);

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;

      const isBase = b.kind === 'base_in' || b.kind === 'base_out';
      // 進基地與退回基地略微錯開，讓往返雙線都清晰可見
      if (isBase) {
        const nx = -dy / len;
        const ny = dx / len;
        const offset = b.kind === 'base_in' ? 3.5 : -3.5;
        x1 += nx * offset;
        y1 += ny * offset;
        x2 += nx * offset;
        y2 += ny * offset;
      }

      const color = isBase ? '#f59e0b' : '#2563eb';
      const dash = isBase ? 'stroke-dasharray="5 3.5"' : '';

      // 白色外描邊讓軌跡在任何深淺地圖卡上都清晰醒目
      parts.push(
        `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(255,255,255,0.85)" stroke-width="${strokeW + 2.5}" stroke-linecap="round"/>`
      );
      parts.push(
        `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" ${dash} opacity="0.9"/>`
      );

      // 線段中點方向小箭頭
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      const ah = Math.max(4.5, strokeW * 1.15);
      parts.push(
        `<polygon points="${ah},0 ${-ah * 0.75},${-ah * 0.72} ${-ah * 0.75},${ah * 0.72}" fill="${color}" stroke="#ffffff" stroke-width="1" transform="translate(${mx.toFixed(1)},${my.toFixed(1)}) rotate(${angle.toFixed(1)})"/>`
      );
    }

    // 繪製節點圓點（起點為醒目綠色圓圈，其餘為路徑節點）
    pts.forEach((p, idx) => {
      const px = cx(p.col);
      const py = cy(p.row);
      if (idx === 0) {
        const r = Math.max(5, Math.round(size * 0.14));
        parts.push(
          `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r}" fill="#16a34a" stroke="#ffffff" stroke-width="2.2"/>`
        );
      } else {
        const r = Math.max(3, Math.round(size * 0.08));
        const fill = (p.kind === 'base_in' || p.kind === 'base_out') ? '#f59e0b' : '#2563eb';
        parts.push(
          `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r}" fill="${fill}" stroke="#ffffff" stroke-width="1.5"/>`
        );
      }
    });

    svg.innerHTML = parts.join('');
  }

  function renderRobotLayer() {
    let layer = dom.mapGrid.querySelector('.robot-layer');
    const startPos = getEffectiveStartPos();
    if (!startPos) {
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
      renderFocusPrograms();
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

    renderFocusPrograms();
  }

  // ==================== 專注瀏覽模式：一次渲染主程式與所有函式 ====================
  function renderFocusPrograms() {
    if (!dom.focusProgramsList || !ProgramExporter) return;
    dom.focusProgramsList.innerHTML = '';

    const activeTracks = ProgramExporter.TRACK_META
      .map(meta => ({ meta, ids: state.programs[meta.id] || [] }))
      .filter(t => t.ids.length > 0);

    if (activeTracks.length === 0) {
      dom.focusProgramsList.innerHTML = `<div class="track-empty">目前尚未編寫任何指令卡，請點右上角「✏️ 返回編輯」加入指令卡。</div>`;
      return;
    }

    let activeChipEl = null;

    activeTracks.forEach(({ meta, ids }) => {
      const cardBox = document.createElement('div');
      cardBox.className = 'focus-track-card';
      cardBox.style.borderColor = meta.border;

      const head = document.createElement('div');
      head.className = 'focus-track-head';
      head.style.background = meta.bg;
      head.style.color = meta.accent;
      head.innerHTML = `<span>${meta.title}</span><span class="qty-pill" style="background:${meta.accent};color:#fff;">${ids.length} 張</span>`;
      cardBox.appendChild(head);

      const seq = document.createElement('div');
      seq.className = 'focus-track-seq';

      ids.forEach((cid, idx) => {
        const card = CmdMod.getById(cid);
        if (!card) return;
        const isExec =
          state.highlight.trackId === meta.id &&
          (state.highlight.cardIndex === idx || state.highlight.numIndex === idx);

        const chip = document.createElement('div');
        chip.className = 'focus-card-chip' + (isExec ? ' executing' : '');
        chip.title = `${card.name}`;
        chip.innerHTML = `
          <span class="prog-card-index">${idx + 1}</span>
          ${card.svg}
          <div class="cmd-card-name">${card.shortName}</div>
        `;
        chip.addEventListener('click', () => openCmdCardModal(card));
        seq.appendChild(chip);

        if (isExec) activeChipEl = chip;

        if (idx < ids.length - 1) {
          const arrow = document.createElement('span');
          arrow.className = 'prog-arrow';
          arrow.textContent = '→';
          seq.appendChild(arrow);
        }
      });

      cardBox.appendChild(seq);
      dom.focusProgramsList.appendChild(cardBox);
    });

    if (state.focusMode && activeChipEl) {
      try {
        activeChipEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (_) {}
    }
  }

  function setFocusMode(enabled) {
    state.focusMode = !!enabled;
    document.body.classList.toggle('focus-run-mode', state.focusMode);

    if (state.focusMode && state.view !== 'workspace') {
      const wsTab = $('.nav-tab[data-view="workspace"]');
      if (wsTab) wsTab.click();
    }

    if (dom.btnFocusMode) {
      dom.btnFocusMode.classList.toggle('active', state.focusMode);
      dom.btnFocusMode.textContent = state.focusMode ? '✏️ 返回編輯' : '📺 專注瀏覽';
    }

    renderFocusPrograms();
    // 等 CSS 欄位寬度切換完成後重新計算最佳地圖格大小
    requestAnimationFrame(() => renderMapStage());
    Audio.play('click');
    appendLog(
      state.focusMode
        ? '📺 已切換為「專注瀏覽模式」：僅顯示地圖與全部程式集，讓執行過程更清楚！'
        : '✏️ 已返回完整編輯模式。',
      'highlight'
    );
  }

  // ==================== 匯出主程式與函式指令集 PNG 圖片 ====================
  async function handleExportProgramImage() {
    if (!ProgramExporter) return;
    const pos = getEffectiveStartPos();
    const startCoordText = pos ? Engine.formatCoord(pos.col, pos.row) : '未設定';
    const initialDirText = Engine.DIR_VECTORS[state.initialDir]?.name || '';
    const mapTitle = dom.presetSelect.options[dom.presetSelect.selectedIndex]?.textContent || `${state.map.cols}×${state.map.rows} 地圖`;

    try {
      const result = await ProgramExporter.generateProgramImage({
        programs: state.programs,
        startCoordText,
        initialDirText,
        mapTitle
      });

      const fileName = `coding-robot-programs-${new Date().toISOString().slice(0, 10)}.png`;
      const modalContent = dom.cardModal.querySelector('.modal-content');
      if (modalContent) modalContent.classList.add('modal-wide');

      // 檢查是否支援系統原生分享圖片（iPad Safari 可一鍵存進「照片」相簿）
      let canShareFile = false;
      let shareFile = null;
      if (result.blob && navigator.canShare && typeof File !== 'undefined') {
        try {
          shareFile = new File([result.blob], fileName, { type: 'image/png' });
          canShareFile = navigator.canShare({ files: [shareFile] });
        } catch (_) {
          canShareFile = false;
        }
      }

      dom.modalBody.innerHTML = `
        <h3 style="font-size:1.15rem; font-weight:900; margin-bottom:4px;">🖼️ 匯出程式指令集圖片</h3>
        <div style="font-size:0.84rem; color:#475569;">
          已產生高解析 PNG（共 ${result.trackCount} 個軌道・${result.totalCards} 張指令卡，含起點 ${startCoordText} 與初始方向 ${initialDirText}）
        </div>
        <div class="export-img-actions">
          <a id="btnDownloadProgramPng" class="btn btn-primary btn-sm" href="${result.dataUrl}" download="${fileName}">⬇️ 下載 PNG 圖片</a>
          ${canShareFile ? '<button type="button" id="btnShareProgramPng" class="btn btn-info btn-sm">📤 分享／存到 iPad 相簿</button>' : ''}
        </div>
        <div class="export-preview-wrap">
          <img src="${result.dataUrl}" alt="主程式與函式指令集圖片預覽" class="export-preview-img" />
        </div>
        <p class="export-tip">💡 電腦可按「⬇️ 下載 PNG 圖片」直接存檔；iPad 也可按「分享」或直接<strong>長按上方圖片 → 儲存到照片</strong>。</p>
      `;

      dom.cardModal.classList.remove('hidden');
      Audio.play('scan');
      appendLog(`🖼️ 已產生主程式與函式指令集圖片（${result.trackCount} 個軌道・${result.totalCards} 張卡）。`, 'success');

      const shareBtn = $('#btnShareProgramPng');
      if (shareBtn && shareFile) {
        shareBtn.addEventListener('click', async () => {
          try {
            await navigator.share({
              title: '兒童互動編程機器人・程式指令集',
              files: [shareFile]
            });
          } catch (_) {}
        });
      }
    } catch (err) {
      Audio.play('error');
      appendLog(`❌ 無法匯出圖片：${err.message || err}`, 'error');
    }
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
    state.pickingStartPos = false;
    state.trailPoints = [];
    state.highlight = { trackId: null, cardIndex: -1, numIndex: -1 };
    renderStartPosControl();
    renderTrailLayer();
    const startPos = getEffectiveStartPos();
    state.robotVisual = {
      col: startPos ? startPos.col : 0,
      row: startPos ? startPos.row : 0,
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
      initialPos: getEffectiveStartPos(),
      getSpeedMultiplier: () => parseFloat(dom.speedSelect.value) || 1,
      onStateChange(st) {
        state.robotVisual = st;
        if (Array.isArray(st.trail)) {
          state.trailPoints = st.trail;
        }
        updateStatusPill(st.status);
        renderTrailLayer();
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
    state.startPos = null;
    state.pickingStartPos = false;
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
    const modalContent = dom.cardModal.querySelector('.modal-content');
    if (modalContent) modalContent.classList.remove('modal-wide');
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

    // 專注瀏覽模式切換（只顯示地圖＋全部程式集）
    if (dom.btnFocusMode) {
      dom.btnFocusMode.addEventListener('click', () => setFocusMode(!state.focusMode));
    }
    const btnExitFocus = $('#btnExitFocusMode');
    if (btnExitFocus) {
      btnExitFocus.addEventListener('click', () => setFocusMode(false));
    }

    // 匯出主程式與函式指令集圖片
    ['#btnExportImg', '#btnTrackExportImg', '#btnFocusExportImg'].forEach(sel => {
      const b = $(sel);
      if (b) b.addEventListener('click', handleExportProgramImage);
    });

    // 套件數量模式切換
    dom.btnToggleStock.addEventListener('click', () => {
      state.enforceStock = !state.enforceStock;
      dom.stockModeText.textContent = state.enforceStock ? '嚴格盒裝數量' : '自由模式';
      renderCmdPalette();
      runValidationPreview(false);
      saveSessionState();
    });

    // 機器人移動軌跡顯示開關
    if (dom.btnToggleTrail) {
      dom.btnToggleTrail.addEventListener('click', () => {
        state.showTrail = !state.showTrail;
        renderTrailToggle();
        renderTrailLayer();
        saveSessionState();
        Audio.play('click');
        appendLog(state.showTrail ? '🛤️ 已開啟「機器人移動軌跡路線」顯示。' : '🛤️ 已關閉「機器人移動軌跡路線」顯示。');
      });
    }

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
      state.startPos = null;
      state.pickingStartPos = false;
      state.selectedTileUid = null;
      resetRunner();
      renderMapStage();
      renderSelectedTileBar();
      renderStartPosControl();
      saveSessionState();
      appendLog('🧹 已清空地圖，請從下方拖曳「起點地圖卡」與其他地圖卡自由排布。');
    });

    // 自由調整機器人起點位置（點擊按鈕切換「點選起點模式」）
    if (dom.btnPickStartPos) {
      dom.btnPickStartPos.addEventListener('click', () => {
        if (state.runner && state.runner.isRunning()) {
          appendLog('⚠️ 請先停止或重置程式，再調整機器人起始位置。', 'warn');
          return;
        }
        state.pickingStartPos = !state.pickingStartPos;
        if (state.pickingStartPos) {
          state.pickedMapCardId = null;
          renderMapPalette();
          appendLog('📍 請直接點選地圖上任一格，將機器人起始位置移至該格！', 'highlight');
        }
        renderStartPosControl();
      });
    }

    // 機器人初始方向選擇（上 / 下 / 左 / 右）
    if (dom.initialDirPicker) {
      dom.initialDirPicker.querySelectorAll('.dir-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          setInitialDir(parseInt(btn.dataset.dir, 10));
        });
      });
    }

    // 已選取地圖卡的快捷操作：設為起點 / 翻面 / 旋轉 / 說明 / 移除
    $('#btnTileSetStart').addEventListener('click', () => {
      const tile = state.map.tiles.find(t => t.uid === state.selectedTileUid);
      if (!tile) return;
      setCustomStartPos(tile.col, tile.row);
    });

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
          if (parsed.startPos && typeof parsed.startPos.col === 'number' && typeof parsed.startPos.row === 'number') {
            state.startPos = { col: parsed.startPos.col, row: parsed.startPos.row };
          } else {
            state.startPos = null;
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
    renderTrailToggle();
    dom.stockModeText.textContent = state.enforceStock ? '嚴格盒裝數量' : '自由模式';

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
