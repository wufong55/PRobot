/**
 * 機器人編程語法檢查與模擬執行引擎 (Robot Interpreter & Execution Engine)
 * 嚴格實作手冊第 9、10、11 頁的所有指令卡與地圖卡邏輯：
 * - 主程式 (起點 ~ 終點)
 * - 紅/綠/藍 函式 (踩到對應基地卡星星格時觸發，結束後返回主程式)
 * - IF / AND / OR / DO / ELSE 條件語句 (踩到事件地圖卡 1~4 時觸發；無對應程式則執行預設行為)
 * - 綠/紅 簡單迴圈 (支援巢狀迴圈與緊接數字卡 1~9)
 * - 數字卡 1~9 (不可連續放置，僅對特定指令生效)
 * - 移動、轉向、暫停、輸出齒輪旋轉/暫停、10 種音效、8 種燈光顏色、10 種燈光閃爍效果
 */
(function (global) {
  'use strict';

  const TRACK_LABELS = {
    main: '主程式',
    func_red: '紅色函式',
    func_green: '綠色函式',
    func_blue: '藍色函式',
    condition: '條件語句 (IF)'
  };

  // 4 個方向：0=右(東), 1=下(南), 2=左(西), 3=上(北)
  const DIR_VECTORS = [
    { dx: 1, dy: 0, name: '右 (→)' },
    { dx: 0, dy: 1, name: '下 (↓)' },
    { dx: -1, dy: 0, name: '左 (←)' },
    { dx: 0, dy: -1, name: '上 (↑)' }
  ];

  function colToLetter(col) {
    let n = col;
    let s = '';
    do {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return s;
  }

  function formatCoord(col, row) {
    if (col < 0 || row < 0) return `(${col + 1}, ${row + 1})`;
    return `${colToLetter(col)}${row + 1}`;
  }

  // 踩到事件卡但未撰寫對應條件程式時的預設行為（手冊第 11 頁備註）
  const DEFAULT_EVENT_BEHAVIOR = {
    event_1: { light: '#facc15', sound: 'cheer', bubble: '⭐ 偵測到事件1（預設行為）' },
    event_2: { light: '#f97316', sound: 'ah', bubble: '⚡ 偵測到事件2（預設行為）' },
    event_3: { light: '#a855f7', sound: 'huh', bubble: '🌀 偵測到事件3（預設行為）' },
    event_4: { light: '#ec4899', sound: 'hi', bubble: '💖 偵測到事件4（預設行為）' }
  };

  /**
   * 驗證單一軌道語法並回傳 { errors: [], warnings: [] }
   */
  function validateTrack(trackId, cardIds) {
    const errors = [];
    const warnings = [];
    const label = TRACK_LABELS[trackId] || trackId;
    const Cards = global.CommandCardsModule;

    if (!cardIds || cardIds.length === 0) {
      if (trackId === 'main') {
        errors.push(`【${label}】還沒有放入任何指令卡！請先放入「起點」與「終點」。`);
      }
      return { errors, warnings };
    }

    // 1. 起點與終點規則
    const first = cardIds[0];
    const last = cardIds[cardIds.length - 1];

    if (trackId === 'main') {
      if (first !== 'start') {
        errors.push(`【${label}】第一張卡必須是「起點」指令卡。`);
      }
      if (last !== 'end') {
        errors.push(`【${label}】最後一張卡必須是「終點」指令卡。`);
      }
    } else if (trackId === 'func_red' || trackId === 'func_green' || trackId === 'func_blue') {
      if (first !== trackId) {
        const expected = Cards.getById(trackId)?.name || trackId;
        errors.push(`【${label}】第一張卡必須是「${expected}」。`);
      }
      if (last !== 'end') {
        errors.push(`【${label}】最後一張卡必須是「終點」指令卡。`);
      }
    } else if (trackId === 'condition') {
      if (first !== 'if') {
        errors.push(`【${label}】第一張卡必須是「如果 (IF)」指令卡。`);
      }
      if (last !== 'end') {
        errors.push(`【${label}】最後一張卡必須是「終點」指令卡。`);
      }
    }

    // 2. 逐張檢查規則、數字卡、迴圈配對、ELSE 限制
    const loopStack = [];
    let inElseBranch = false;
    let seenDo = false;
    let seenElse = false;

    for (let i = 0; i < cardIds.length; i++) {
      const id = cardIds[i];
      const card = Cards.getById(id);
      if (!card) continue;

      // 軌道權限檢查
      if (card.allowedIn && !card.allowedIn.includes(trackId)) {
        errors.push(`【${label}】第 ${i + 1} 張「${card.name}」不能放在${label}中。`);
      }

      // 起點/終點不能出現在中間
      if (i > 0 && (id === 'start' || id === 'func_red' || id === 'func_green' || id === 'func_blue' || id === 'if')) {
        errors.push(`【${label}】第 ${i + 1} 張「${card.name}」只能放在程式最開頭。`);
      }
      if (i < cardIds.length - 1 && id === 'end') {
        errors.push(`【${label}】第 ${i + 1} 張「終點」必須放在程式最尾端。`);
      }

      // 數字卡規則檢查
      if (card.category === 'number') {
        if (i === 0) {
          errors.push(`【${label}】第 1 張不能直接放「${card.name}」。`);
        } else {
          const prev = Cards.getById(cardIds[i - 1]);
          if (prev && prev.category === 'number') {
            errors.push(`【${label}】第 ${i}、${i + 1} 張連續放置了多張數字卡！機器人無法判讀，每個指令卡後方只能放一張數字卡。`);
          } else if (prev && !prev.acceptsNumber) {
            errors.push(`【${label}】第 ${i + 1} 張「${card.name}」不能接在「${prev.name}」後面（此指令不支援重複次數）。`);
          }
        }
      }

      // 迴圈配對檢查
      if (card.loopRole === 'start') {
        loopStack.push({ color: card.loopColor, index: i, name: card.name });
      } else if (card.loopRole === 'end') {
        if (loopStack.length === 0) {
          errors.push(`【${label}】第 ${i + 1} 張「${card.name}」缺少對應的迴圈起點卡。`);
        } else {
          const top = loopStack.pop();
          if (top.color !== card.loopColor) {
            errors.push(`【${label}】第 ${i + 1} 張「${card.name}」與第 ${top.index + 1} 張「${top.name}」顏色不配對！`);
          }
        }
      }

      // 條件語句結構檢查
      if (trackId === 'condition') {
        if (id === 'do') {
          if (seenDo) errors.push(`【${label}】不能出現兩張「執行 (DO)」卡。`);
          seenDo = true;
        }
        if (id === 'else') {
          if (!seenDo) errors.push(`【${label}】「否則 (ELSE)」必須放在「執行 (DO)」之後。`);
          if (seenElse) errors.push(`【${label}】不能出現兩張「否則 (ELSE)」卡。`);
          seenElse = true;
          inElseBranch = true;
        }
        if (inElseBranch && card.forbiddenAfterElse) {
          errors.push(`【${label}】第 ${i + 1} 張「${card.name}」不能放在「否則 (ELSE)」的後面！（依手冊規定：前進、後退、右轉、左轉與暫停不可放在否則後面）`);
        }
      }
    }

    if (loopStack.length > 0) {
      loopStack.forEach(unclosed => {
        errors.push(`【${label}】第 ${unclosed.index + 1} 張「${unclosed.name}」缺少對應的迴圈終點卡。`);
      });
    }

    // 細部檢查條件語句的條件表達式 (IF ... DO)
    if (trackId === 'condition' && errors.length === 0) {
      const doIdx = cardIds.indexOf('do');
      if (doIdx === -1) {
        errors.push(`【${label}】條件語句缺少「執行 (DO)」指令卡。`);
      } else {
        const condSlice = cardIds.slice(1, doIdx);
        const isEvent = cid => cid && cid.startsWith('event_');
        const validSingle = condSlice.length === 1 && isEvent(condSlice[0]);
        const validCompound =
          condSlice.length === 3 &&
          isEvent(condSlice[0]) &&
          (condSlice[1] === 'and' || condSlice[1] === 'or') &&
          isEvent(condSlice[2]);
        if (!validSingle && !validCompound) {
          errors.push(`【${label}】「如果 (IF)」與「執行 (DO)」之間必須放置 1 張事件卡，或「事件卡 + 以及/或者 + 事件卡」。`);
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * 驗證全部軌道 + 檢查卡片數量限制（若開啟實體套件數量限制）
   */
  function validateAll(programs, enforceStock) {
    const allErrors = [];
    const allWarnings = [];

    ['main', 'func_red', 'func_green', 'func_blue', 'condition'].forEach(trackId => {
      const res = validateTrack(trackId, programs[trackId] || []);
      allErrors.push(...res.errors);
      allWarnings.push(...res.warnings);
    });

    if (enforceStock) {
      const usage = {};
      Object.values(programs).forEach(list => {
        (list || []).forEach(id => { usage[id] = (usage[id] || 0) + 1; });
      });
      Object.keys(usage).forEach(id => {
        const card = global.CommandCardsModule.getById(id);
        if (card && usage[id] > card.qty) {
          allWarnings.push(`「${card.name}」已使用 ${usage[id]} 張，超過實體盒裝標準數量（${card.qty} 張）。`);
        }
      });
    }

    return { ok: allErrors.length === 0, errors: allErrors, warnings: allWarnings };
  }

  /**
   * 將一段指令卡序列編譯成線性操作指令（自動展開數字卡與綠/紅迴圈）
   */
  function compileSequence(trackId, cardIds, startOffset) {
    const Cards = global.CommandCardsModule;
    const offset = startOffset || 0;

    function parseRange(fromIdx, toIdx) {
      const steps = [];
      let i = fromIdx;
      while (i < toIdx) {
        const id = cardIds[i];
        const card = Cards.getById(id);
        if (!card) { i++; continue; }

        // 跳過純結構卡
        if (id === 'start' || id === 'end' || id === 'func_red' || id === 'func_green' || id === 'func_blue') {
          i++;
          continue;
        }

        // 迴圈展開
        if (card.loopRole === 'start') {
          let repeat = 1;
          let bodyStart = i + 1;
          if (bodyStart < toIdx) {
            const nextCard = Cards.getById(cardIds[bodyStart]);
            if (nextCard && nextCard.category === 'number') {
              repeat = nextCard.numberValue;
              bodyStart++;
            }
          }
          // 找配對的同色迴圈終點
          let depth = 1;
          let endIdx = bodyStart;
          while (endIdx < toIdx && depth > 0) {
            const c = Cards.getById(cardIds[endIdx]);
            if (c && c.loopColor === card.loopColor) {
              if (c.loopRole === 'start') depth++;
              else if (c.loopRole === 'end') depth--;
            }
            if (depth > 0) endIdx++;
          }
          const bodySteps = parseRange(bodyStart, endIdx);
          for (let r = 0; r < repeat; r++) {
            bodySteps.forEach(st => {
              steps.push(Object.assign({}, st, {
                loopInfo: `${card.loopColor === 'green' ? '綠' : '紅'}迴圈 ${r + 1}/${repeat}`
              }));
            });
          }
          i = endIdx + 1;
          continue;
        }

        if (card.loopRole === 'end' || card.category === 'number') {
          i++;
          continue;
        }

        // 一般可重複指令：看後面有沒有接數字卡
        let count = 1;
        let numIndex = -1;
        if (card.acceptsNumber && i + 1 < toIdx) {
          const nextCard = Cards.getById(cardIds[i + 1]);
          if (nextCard && nextCard.category === 'number') {
            count = nextCard.numberValue;
            numIndex = i + 1;
          }
        }

        // 對於「暫停 / 齒輪旋轉 / 齒輪暫停」，數字卡代表秒數；其他動作（前進/轉向/音效/燈光）代表重複次數
        if (id === 'wait' || id === 'gear_cw' || id === 'gear_ccw' || id === 'gear_wait') {
          steps.push({
            trackId,
            cardIndex: offset + i,
            numIndex: numIndex >= 0 ? offset + numIndex : -1,
            cardId: id,
            durationSec: count,
            repeatIndex: 1,
            repeatTotal: 1
          });
        } else {
          for (let r = 0; r < count; r++) {
            steps.push({
              trackId,
              cardIndex: offset + i,
              numIndex: numIndex >= 0 ? offset + numIndex : -1,
              cardId: id,
              repeatIndex: r + 1,
              repeatTotal: count
            });
          }
        }

        i = numIndex >= 0 ? i + 2 : i + 1;
      }
      return steps;
    }

    return parseRange(0, cardIds.length);
  }

  /**
   * 編譯條件語句軌道
   */
  function compileCondition(cardIds) {
    if (!cardIds || cardIds.length === 0) return null;
    const doIdx = cardIds.indexOf('do');
    if (doIdx === -1) return null;
    const elseIdx = cardIds.indexOf('else');
    const endIdx = cardIds.length - 1;

    const condSlice = cardIds.slice(1, doIdx);
    let cond = null;
    if (condSlice.length === 1) {
      cond = { op: 'single', events: [condSlice[0]] };
    } else if (condSlice.length === 3) {
      cond = { op: condSlice[1], events: [condSlice[0], condSlice[2]] };
    }

    const doEnd = elseIdx >= 0 ? elseIdx : endIdx;
    const doSteps = compileSequence('condition', cardIds.slice(doIdx + 1, doEnd), doIdx + 1);
    const elseSteps = elseIdx >= 0 ? compileSequence('condition', cardIds.slice(elseIdx + 1, endIdx), elseIdx + 1) : [];

    return { cond, doSteps, elseSteps };
  }

  /**
   * 取得地圖上指定座標 (col, row) 的格子資訊（考量 2×1 基地卡旋轉與佔位）
   */
  function getCellInfo(mapState, col, row) {
    const Maps = global.MapCardsModule;
    for (let i = 0; i < mapState.tiles.length; i++) {
      const t = mapState.tiles[i];
      const def = Maps.getById(t.cardId);
      if (!def) continue;
      const sideDef = def.sides[t.side || 'front'];

      if (t.col === col && t.row === row) {
        return {
          tile: t,
          def,
          sideDef,
          isTriggerCell: true // 單格卡本身，或是雙格基地卡的「星星識別格」
        };
      }
      // 檢查 2×1 雙格卡的第二格（延伸區）
      if (def.width === 2) {
        const rot = ((t.rotation || 0) % 360 + 360) % 360;
        const vec = DIR_VECTORS[(rot / 90) % 4];
        if (t.col + vec.dx === col && t.row + vec.dy === row) {
          return {
            tile: t,
            def,
            sideDef,
            isTriggerCell: false // 基地延伸格（可通行，不重複觸發星星）
          };
        }
      }
    }
    return null;
  }

  /**
   * 尋找起點地圖卡
   */
  function findStartTile(mapState) {
    for (const t of mapState.tiles) {
      const def = global.MapCardsModule.getById(t.cardId);
      if (def && def.role === 'start') {
        return t;
      }
    }
    return null;
  }

  /**
   * 建立機器人執行控制器
   */
  function createRunner(options) {
    const {
      mapState,
      programs,
      initialDir,
      initialPos,
      onStateChange,
      onLog,
      onHighlight,
      onFinish,
      getSpeedMultiplier
    } = options;

    let running = false;
    let paused = false;
    let aborted = false;
    let stepResolver = null;
    let singleStepMode = false;

    const startTile = findStartTile(mapState);
    const hasCustomStart =
      initialPos &&
      typeof initialPos.col === 'number' &&
      typeof initialPos.row === 'number' &&
      !!getCellInfo(mapState, initialPos.col, initialPos.row);

    const resolvedStartCol = hasCustomStart ? initialPos.col : (startTile ? startTile.col : null);
    const resolvedStartRow = hasCustomStart ? initialPos.row : (startTile ? startTile.row : null);

    const fallbackDir = startTile ? ((((startTile.rotation || 0) % 360) + 360) % 360) / 90 : 0;
    const initDir = (typeof initialDir === 'number' && initialDir >= 0 && initialDir <= 3)
      ? initialDir
      : fallbackDir;

    const robotState = {
      col: resolvedStartCol !== null ? resolvedStartCol : 0,
      row: resolvedStartRow !== null ? resolvedStartRow : 0,
      dir: initDir, // 0:右, 1:下, 2:左, 3:上
      lightColor: null,
      lightFx: null,
      gearState: 'idle', // idle | cw | ccw | wait
      bubbleText: '',
      scannedEvents: [],
      trail: [], // [{ col, row, kind: 'start'|'move'|'base_in'|'base_out' }]
      status: 'ready' // ready | running | paused | finished | error
    };

    function emitState() {
      if (onStateChange) {
        onStateChange(Object.assign({}, robotState, {
          trail: robotState.trail.slice()
        }));
      }
    }

    function log(msg, level) {
      if (onLog) onLog(msg, level || 'info');
    }

    function sleep(ms) {
      const mult = getSpeedMultiplier ? getSpeedMultiplier() : 1;
      const actualMs = Math.max(60, Math.round(ms / mult));
      return new Promise(resolve => {
        const start = performance.now();
        function check() {
          if (aborted) return resolve();
          if (paused) {
            setTimeout(check, 60);
            return;
          }
          if (performance.now() - start >= actualMs) {
            resolve();
          } else {
            setTimeout(check, 30);
          }
        }
        check();
      });
    }

    async function waitGate() {
      if (aborted) return;
      if (singleStepMode) {
        paused = true;
        robotState.status = 'paused';
        emitState();
        await new Promise(res => { stepResolver = res; });
        paused = false;
        if (!aborted) {
          robotState.status = 'running';
          emitState();
        }
      } else {
        while (paused && !aborted) {
          await new Promise(res => setTimeout(res, 60));
        }
      }
    }

    // 編譯各軌道
    const compiledMain = compileSequence('main', programs.main || []);
    const compiledFuncs = {
      red: compileSequence('func_red', programs.func_red || []),
      green: compileSequence('func_green', programs.func_green || []),
      blue: compileSequence('func_blue', programs.func_blue || [])
    };
    const compiledCond = compileCondition(programs.condition || []);

    // 執行單步指令
    async function executeStep(step, allowMapTriggers) {
      if (aborted) return;
      await waitGate();
      if (aborted) return;

      const card = global.CommandCardsModule.getById(step.cardId);
      if (!card) return;

      if (onHighlight) onHighlight(step.trackId, step.cardIndex, step.numIndex);

      const repeatTag = step.repeatTotal > 1 ? ` (${step.repeatIndex}/${step.repeatTotal})` : '';
      const loopTag = step.loopInfo ? `[${step.loopInfo}] ` : '';

      // 1. 移動指令
      if (step.cardId === 'forward' || step.cardId === 'backward') {
        const dirVec = DIR_VECTORS[robotState.dir];
        const sign = step.cardId === 'forward' ? 1 : -1;
        const nextCol = robotState.col + dirVec.dx * sign;
        const nextRow = robotState.row + dirVec.dy * sign;
        const cell = getCellInfo(mapState, nextCol, nextRow);

        if (!cell) {
          global.AudioEngine.play('error');
          robotState.bubbleText = '⚠️ 前方沒有地圖卡！';
          robotState.status = 'error';
          emitState();
          log(`${loopTag}${card.name}${repeatTag} → 目標格 ${formatCoord(nextCol, nextRow)} 沒有放置地圖卡，機器人安全停止！`, 'error');
          aborted = true;
          return;
        }

        robotState.col = nextCol;
        robotState.row = nextRow;
        robotState.trail.push({ col: nextCol, row: nextRow, kind: 'move' });
        robotState.bubbleText = '';
        global.AudioEngine.play('step');
        emitState();
        const tileTag = cell.tile.customLabel ? cell.tile.customLabel.replace(/\n/g, '') : cell.sideDef.label;
        log(`${loopTag}${card.name}${repeatTag} → 移動至 ${formatCoord(nextCol, nextRow)}【${tileTag}】`);
        await sleep(520);

        if (allowMapTriggers && !aborted) {
          await checkCellTrigger(cell);
        }
        return;
      }

      // 2. 轉向指令
      if (step.cardId === 'turn_right' || step.cardId === 'turn_left') {
        robotState.dir = step.cardId === 'turn_right'
          ? (robotState.dir + 1) % 4
          : (robotState.dir + 3) % 4;
        robotState.bubbleText = '';
        global.AudioEngine.play('turn');
        emitState();
        log(`${loopTag}${card.name}${repeatTag} → 面向 ${DIR_VECTORS[robotState.dir].name}`);
        await sleep(420);

        // 若轉向後機器人正位於基地卡星星格，且面向與基地卡箭頭方向一致，自動進入基地執行函式
        if (allowMapTriggers && !aborted) {
          const curCell = getCellInfo(mapState, robotState.col, robotState.row);
          if (curCell && curCell.isTriggerCell && curCell.sideDef.funcColor) {
            const baseDir = ((((curCell.tile.rotation || 0) % 360) + 360) % 360) / 90;
            if (robotState.dir === baseDir) {
              await checkCellTrigger(curCell, true);
            }
          }
        }
        return;
      }

      // 3. 暫停指令
      if (step.cardId === 'wait') {
        const sec = step.durationSec || 1;
        robotState.bubbleText = `⏳ 暫停 ${sec} 秒`;
        emitState();
        log(`${loopTag}暫停 ${sec} 秒鐘`);
        await sleep(sec * 1000);
        robotState.bubbleText = '';
        emitState();
        return;
      }

      // 4. 輸出齒輪指令
      if (step.cardId === 'gear_cw' || step.cardId === 'gear_ccw' || step.cardId === 'gear_wait') {
        const sec = step.durationSec || 1;
        robotState.gearState = step.cardId === 'gear_cw' ? 'cw' : (step.cardId === 'gear_ccw' ? 'ccw' : 'wait');
        robotState.bubbleText = step.cardId === 'gear_cw'
          ? `⚙️ 齒輪順轉 ${sec}秒`
          : (step.cardId === 'gear_ccw' ? `⚙️ 齒輪逆轉 ${sec}秒` : `⏸ 齒輪暫停 ${sec}秒`);
        if (step.cardId !== 'gear_wait') global.AudioEngine.play('gear');
        emitState();
        log(`${loopTag}${card.name} ${sec} 秒`);
        await sleep(sec * 1000);
        robotState.gearState = 'idle';
        robotState.bubbleText = '';
        emitState();
        return;
      }

      // 5. 播放音效
      if (card.category === 'sound') {
        robotState.bubbleText = card.bubbleText || card.shortName;
        emitState();
        log(`${loopTag}${card.name}${repeatTag}`);
        const dur = global.AudioEngine.play(card.soundId);
        await sleep(Math.max(550, dur + 120));
        robotState.bubbleText = '';
        emitState();
        return;
      }

      // 6. 燈光顏色
      if (card.category === 'light_color') {
        if (card.lightColor === 'rainbow') {
          const rainbowColors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#6366f1', '#a855f7'];
          robotState.bubbleText = '🌈 彩虹燈光';
          log(`${loopTag}燈光顏色：彩虹（七色各 0.5 秒）${repeatTag}`);
          for (const c of rainbowColors) {
            if (aborted) break;
            robotState.lightColor = c;
            robotState.lightFx = null;
            emitState();
            await sleep(500);
          }
          robotState.lightColor = null;
          robotState.bubbleText = '';
          emitState();
        } else {
          robotState.lightColor = card.lightColor;
          robotState.lightFx = null;
          robotState.bubbleText = `💡 ${card.lightName}燈光`;
          emitState();
          log(`${loopTag}${card.name}（1 秒）${repeatTag}`);
          await sleep(1000);
          robotState.lightColor = null;
          robotState.bubbleText = '';
          emitState();
        }
        return;
      }

      // 7. 燈光效果（依手冊：預設發出紫色燈光效果，持續 3 秒鐘）
      if (card.category === 'light_fx') {
        robotState.lightColor = '#a855f7';
        robotState.lightFx = card.fxType;
        robotState.bubbleText = `✨ ${card.shortName} (3秒)`;
        emitState();
        log(`${loopTag}${card.name}（預設紫色燈光，持續 3 秒）${repeatTag}`);
        await sleep(3000);
        robotState.lightColor = null;
        robotState.lightFx = null;
        robotState.bubbleText = '';
        emitState();
        return;
      }
    }

    // 掃描地圖卡觸發（基地卡函式 & 事件卡條件語句）
    // onlyBase=true 時僅檢查基地卡（用於在星星格原地轉向或起點即面向箭頭時）
    async function checkCellTrigger(cell, onlyBase) {
      if (!cell || !cell.isTriggerCell) return;
      const side = cell.sideDef;

      // A. 基地卡觸發對應函式
      // 規則：只要機器人位於基地卡星星記號格且面向與基地卡內箭頭方向相同，
      // 就會自動前進一步進入基地本體格、執行對應函式，執行結束後自動退回星星記號處，繼續主程式。
      if (side.funcColor) {
        const colorName = side.funcColor === 'red' ? '紅色' : (side.funcColor === 'green' ? '綠色' : '藍色');
        const baseDir = ((((cell.tile.rotation || 0) % 360) + 360) % 360) / 90;

        if (robotState.dir !== baseDir) {
          if (!onlyBase) {
            log(
              `ℹ️ 機器人位於【${colorName}函式基地卡】星星格，但目前面向 ${DIR_VECTORS[robotState.dir].name} 與基地箭頭方向 ${DIR_VECTORS[baseDir].name} 不同，未啟動基地函式。`,
              'warn'
            );
          }
          return;
        }

        const starCol = robotState.col;
        const starRow = robotState.row;
        const dirVec = DIR_VECTORS[baseDir];
        const baseCol = starCol + dirVec.dx;
        const baseRow = starRow + dirVec.dy;
        const funcSteps = compiledFuncs[side.funcColor] || [];

        global.AudioEngine.play('scan');
        log(
          `⭐ 方向與【${colorName}函式基地卡】箭頭一致（${dirVec.name}）→ 自動前進一步進入基地 ${formatCoord(baseCol, baseRow)}！`,
          'highlight'
        );

        // 自動前進一步進入基地本體格
        const enteredBase = !!getCellInfo(mapState, baseCol, baseRow);
        if (enteredBase) {
          robotState.col = baseCol;
          robotState.row = baseRow;
          robotState.trail.push({ col: baseCol, row: baseRow, kind: 'base_in' });
          robotState.bubbleText = `⭐ 進入${colorName}基地`;
          global.AudioEngine.play('step');
          emitState();
          await sleep(500);
        }

        if (aborted) return;

        if (funcSteps.length > 0) {
          log(`▶️ 開始執行「${colorName}函式」！`, 'highlight');
          robotState.bubbleText = `⭐ 執行${colorName}函式`;
          emitState();
          await sleep(260);

          for (const fStep of funcSteps) {
            if (aborted) return;
            await executeStep(fStep, false);
          }
        } else {
          log(`⚠️ 已進入【${colorName}函式基地卡】，但尚未編寫「${colorName}函式」。`, 'warn');
        }

        if (aborted) return;

        // 執行完函式後自動退回星星記號格，再繼續走主程式
        if (enteredBase) {
          robotState.col = starCol;
          robotState.row = starRow;
          robotState.trail.push({ col: starCol, row: starRow, kind: 'base_out' });
          robotState.bubbleText = `↩️ 退回星星格 ${formatCoord(starCol, starRow)}`;
          global.AudioEngine.play('step');
          emitState();
          log(`↩️ 「${colorName}函式」執行結束，自動退回星星記號處 ${formatCoord(starCol, starRow)}，繼續主程式。`, 'highlight');
          await sleep(500);
          robotState.bubbleText = '';
          emitState();
        }
        return;
      }

      // B. 事件地圖卡觸發條件語句（或預設行為）
      if (!onlyBase && side.role === 'event' && side.eventId) {
        const evId = side.eventId;
        if (!robotState.scannedEvents.includes(evId)) {
          robotState.scannedEvents.push(evId);
        }
        global.AudioEngine.play('scan');
        log(`⚡ 掃描到事件地圖卡【${side.eventName}】`, 'highlight');

        if (compiledCond && compiledCond.cond) {
          const { op, events } = compiledCond.cond;
          let matched = false;
          if (op === 'single') {
            matched = evId === events[0];
          } else if (op === 'or') {
            matched = evId === events[0] || evId === events[1];
          } else if (op === 'and') {
            matched = robotState.scannedEvents.includes(events[0]) && robotState.scannedEvents.includes(events[1]);
          }

          if (matched) {
            log(`✅ 條件語句（IF）成立！開始執行 DO 指令序列。`, 'success');
            for (const cStep of compiledCond.doSteps) {
              if (aborted) return;
              await executeStep(cStep, false);
            }
          } else if (compiledCond.elseSteps.length > 0) {
            log(`🔀 條件未滿足 → 執行 ELSE（否則）指令序列。`, 'warn');
            for (const eStep of compiledCond.elseSteps) {
              if (aborted) return;
              await executeStep(eStep, false);
            }
          } else {
            log(`ℹ️ 條件語句未滿足（且未設定 ELSE），繼續執行主程式。`);
          }
        } else {
          // 依手冊第 11 頁備註：若未設定對應條件程式，執行預設行為
          const defBeh = DEFAULT_EVENT_BEHAVIOR[evId];
          if (defBeh) {
            log(`✨ 未設定條件程式，執行【${side.eventName}】預設行為！`, 'info');
            robotState.lightColor = defBeh.light;
            robotState.bubbleText = defBeh.bubble;
            emitState();
            global.AudioEngine.play(defBeh.sound);
            await sleep(800);
            robotState.lightColor = null;
            robotState.bubbleText = '';
            emitState();
          }
        }
      }
    }

    async function start(isSingleStep) {
      if (running) return;
      if (resolvedStartCol === null || resolvedStartRow === null) {
        log('❌ 地圖上還沒有可出發的起始位置！請先放置「起點地圖卡」或點選「📍 起點位置」指定出發格。', 'error');
        robotState.status = 'error';
        emitState();
        if (onFinish) onFinish('error');
        return;
      }

      running = true;
      aborted = false;
      singleStepMode = !!isSingleStep;
      paused = false;
      robotState.trail = [{ col: robotState.col, row: robotState.row, kind: 'start' }];
      robotState.status = 'running';
      emitState();
      log(`🚀 開始執行主程式！起點位置 ${formatCoord(robotState.col, robotState.row)}，初始面向 ${DIR_VECTORS[robotState.dir].name}`, 'success');

      // 若起始位置本身就在基地卡星星格且初始方向與基地箭頭相同，立即觸發進入基地與函式
      const startCell = getCellInfo(mapState, robotState.col, robotState.row);
      if (startCell && startCell.isTriggerCell && startCell.sideDef.funcColor) {
        const baseDir = ((((startCell.tile.rotation || 0) % 360) + 360) % 360) / 90;
        if (robotState.dir === baseDir && !aborted) {
          await waitGate();
          if (!aborted) await checkCellTrigger(startCell, true);
        }
      }

      for (const step of compiledMain) {
        if (aborted) break;
        await executeStep(step, true);
      }

      running = false;
      if (onHighlight) onHighlight(null, -1, -1);

      if (!aborted) {
        robotState.status = 'finished';
        robotState.bubbleText = '🏁 程式完成！';
        emitState();
        log('🏁 主程式執行完畢！', 'success');
        if (onFinish) onFinish('finished');
      } else {
        if (onFinish) onFinish(robotState.status);
      }
    }

    return {
      getState() { return Object.assign({}, robotState); },
      start() { start(false); },
      startSingleStep() { start(true); },
      stepNext() {
        singleStepMode = true;
        if (stepResolver) {
          const r = stepResolver;
          stepResolver = null;
          r();
        }
      },
      pause() {
        paused = true;
        robotState.status = 'paused';
        emitState();
      },
      resume() {
        singleStepMode = false;
        paused = false;
        robotState.status = 'running';
        emitState();
        if (stepResolver) {
          const r = stepResolver;
          stepResolver = null;
          r();
        }
      },
      stop() {
        aborted = true;
        paused = false;
        running = false;
        if (stepResolver) {
          const r = stepResolver;
          stepResolver = null;
          r();
        }
        robotState.status = 'ready';
        robotState.lightColor = null;
        robotState.lightFx = null;
        robotState.gearState = 'idle';
        robotState.bubbleText = '';
        emitState();
      },
      isRunning() { return running; },
      isPaused() { return paused; }
    };
  }

  global.RobotEngine = {
    TRACK_LABELS,
    DIR_VECTORS,
    colToLetter,
    formatCoord,
    validateTrack,
    validateAll,
    getCellInfo,
    findStartTile,
    createRunner
  };
})(window);
