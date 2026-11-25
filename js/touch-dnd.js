/**
 * 跨裝置觸控拖曳模組 (Touch / Apple Pencil Drag-and-Drop Module)
 * 解決 iPadOS Safari 不支援原生 HTML5 touch drag-and-drop 的問題。
 *
 * 設計原則（兼顧捲動流暢度、輕點快捷與長按拖曳）：
 * - 電腦滑鼠 (pointerType === 'mouse')：繼續使用零延遲原生 HTML5 Drag-and-Drop。
 * - iPad 觸控 / Apple Pencil (touch / pen)：
 *   1. 短按輕點 (< 160ms)：正常觸發點擊事件（指令卡直接加入軌道、地圖卡點選放置）。
 *   2. 長按 (~160ms) 啟動拖曳：產生浮動卡片預覽跟隨手指移動，並即時高亮目標格子或插入位置。
 *   3. 長按期間若手指大幅移動 (> 10px)：自動取消長按判定，保留容器原生捲動，絕不卡住頁面滑動。
 */
(function (global) {
  'use strict';

  const HOLD_DELAY_MS = 160;
  const SCROLL_CANCEL_PX = 10;

  let handlers = null;
  let activeDrag = null;
  let holdTimer = null;
  let pendingStart = null;
  let justDraggedUntil = 0;

  function clearHoldTimer() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  function clearDropHighlights() {
    document.querySelectorAll('.grid-cell.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.querySelectorAll('.program-track.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.querySelectorAll('.prog-card.drag-insert-before').forEach(el => el.classList.remove('drag-insert-before'));
  }

  function createGhost(sourceEl, clientX, clientY) {
    const rect = sourceEl.getBoundingClientRect();
    const ghost = sourceEl.cloneNode(true);
    ghost.classList.add('touch-dnd-ghost');
    ghost.removeAttribute('id');
    ghost.style.width = Math.max(56, Math.min(rect.width, 140)) + 'px';
    ghost.style.height = Math.max(56, Math.min(rect.height, 110)) + 'px';
    ghost.style.left = clientX + 'px';
    ghost.style.top = clientY + 'px';
    document.body.appendChild(ghost);
    return ghost;
  }

  function startTouchDrag(info) {
    if (!info || !info.sourceEl) return;
    info.sourceEl.classList.add('touch-dragging-source');
    const ghost = createGhost(info.sourceEl, info.x, info.y);
    activeDrag = {
      type: info.type,
      payload: info.payload,
      sourceEl: info.sourceEl,
      ghost,
      pointerId: info.pointerId,
      lastTarget: null
    };

    // 輕微觸覺回饋（支援的裝置會震動一下）
    if (navigator.vibrate) {
      try { navigator.vibrate(18); } catch (_) {}
    }

    updateDropPreview(info.x, info.y);
  }

  function findDropTarget(type, x, y) {
    // 暫時隱藏 ghost 以便 elementFromPoint 精準命中下層元素
    if (activeDrag && activeDrag.ghost) {
      activeDrag.ghost.style.visibility = 'hidden';
    }
    const el = document.elementFromPoint(x, y);
    if (activeDrag && activeDrag.ghost) {
      activeDrag.ghost.style.visibility = 'visible';
    }
    if (!el) return null;

    if (type === 'map-palette' || type === 'placed-tile') {
      const cell = el.closest('.grid-cell');
      if (cell) {
        return {
          kind: 'grid-cell',
          el: cell,
          col: parseInt(cell.dataset.col, 10),
          row: parseInt(cell.dataset.row, 10)
        };
      }
      // 若手指停在已放置的地圖卡上，推算底下對應的 grid-cell 座標
      const grid = el.closest('#mapGrid');
      if (grid) {
        const rect = grid.getBoundingClientRect();
        const cells = grid.querySelectorAll('.grid-cell');
        for (let i = 0; i < cells.length; i++) {
          const r = cells[i].getBoundingClientRect();
          if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
            return {
              kind: 'grid-cell',
              el: cells[i],
              col: parseInt(cells[i].dataset.col, 10),
              row: parseInt(cells[i].dataset.row, 10)
            };
          }
        }
        void rect;
      }
      return null;
    }

    if (type === 'cmd-palette' || type === 'prog-card') {
      const progCard = el.closest('.prog-card');
      if (progCard && progCard.dataset.trackIndex !== undefined) {
        return {
          kind: 'prog-card',
          el: progCard,
          index: parseInt(progCard.dataset.trackIndex, 10)
        };
      }
      const track = el.closest('#programTrack');
      if (track) {
        return { kind: 'program-track', el: track };
      }
      return null;
    }

    return null;
  }

  function updateDropPreview(x, y) {
    if (!activeDrag) return;
    clearDropHighlights();
    const target = findDropTarget(activeDrag.type, x, y);
    activeDrag.lastTarget = target;
    if (!target) return;

    if (target.kind === 'grid-cell') {
      target.el.classList.add('drag-over');
    } else if (target.kind === 'prog-card') {
      target.el.classList.add('drag-insert-before');
    } else if (target.kind === 'program-track') {
      target.el.classList.add('drag-over');
    }
  }

  function finishTouchDrag(cancelled) {
    clearHoldTimer();
    pendingStart = null;
    if (!activeDrag) return;

    const drag = activeDrag;
    activeDrag = null;
    clearDropHighlights();

    if (drag.sourceEl) drag.sourceEl.classList.remove('touch-dragging-source');
    if (drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);

    // 防止手指放開後立即觸發額外的 click 事件
    justDraggedUntil = Date.now() + 360;

    if (cancelled || !drag.lastTarget || !handlers) return;

    const t = drag.lastTarget;
    if (drag.type === 'map-palette' && t.kind === 'grid-cell' && handlers.onDropMapFromPalette) {
      handlers.onDropMapFromPalette(drag.payload.cardId, t.col, t.row);
    } else if (drag.type === 'placed-tile' && t.kind === 'grid-cell' && handlers.onMovePlacedTile) {
      handlers.onMovePlacedTile(drag.payload.uid, t.col, t.row);
    } else if (drag.type === 'cmd-palette') {
      if (t.kind === 'prog-card' && handlers.onDropCmdFromPalette) {
        handlers.onDropCmdFromPalette(drag.payload.cardId, t.index);
      } else if (t.kind === 'program-track' && handlers.onDropCmdFromPalette) {
        handlers.onDropCmdFromPalette(drag.payload.cardId, null);
      }
    } else if (drag.type === 'prog-card') {
      if (t.kind === 'prog-card' && handlers.onMoveProgCard) {
        handlers.onMoveProgCard(drag.payload.fromIdx, t.index);
      } else if (t.kind === 'program-track' && handlers.onMoveProgCard) {
        handlers.onMoveProgCard(drag.payload.fromIdx, null);
      }
    }
  }

  function onPointerDown(e) {
    // 僅處理觸控與手寫筆 (iPad / 平板 / 觸控螢幕)，滑鼠沿用原生拖曳
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    // 忽略卡片上的小按鈕（例如 ℹ 說明鈕、× 刪除鈕）
    if (e.target.closest('button')) return;

    const sourceEl = e.target.closest('[data-dnd-type]');
    if (!sourceEl) return;

    const type = sourceEl.dataset.dndType;
    let payload = {};
    if (type === 'cmd-palette' || type === 'map-palette') {
      payload = { cardId: sourceEl.dataset.cardId };
    } else if (type === 'placed-tile') {
      payload = { uid: sourceEl.dataset.tileUid };
    } else if (type === 'prog-card') {
      payload = { fromIdx: parseInt(sourceEl.dataset.trackIndex, 10) };
    } else {
      return;
    }

    pendingStart = {
      type,
      payload,
      sourceEl,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY
    };

    clearHoldTimer();
    holdTimer = setTimeout(() => {
      if (pendingStart && pendingStart.pointerId === e.pointerId) {
        const info = pendingStart;
        pendingStart = null;
        startTouchDrag(info);
      }
    }, HOLD_DELAY_MS);
  }

  function onPointerMove(e) {
    if (pendingStart && pendingStart.pointerId === e.pointerId) {
      const dx = e.clientX - pendingStart.startX;
      const dy = e.clientY - pendingStart.startY;
      pendingStart.x = e.clientX;
      pendingStart.y = e.clientY;
      if (Math.hypot(dx, dy) > SCROLL_CANCEL_PX) {
        // 使用者正在滑動捲動頁面／卡片列，取消長按拖曳讓原生捲動順暢運作
        clearHoldTimer();
        pendingStart = null;
      }
      return;
    }

    if (activeDrag && activeDrag.pointerId === e.pointerId) {
      activeDrag.ghost.style.left = e.clientX + 'px';
      activeDrag.ghost.style.top = e.clientY + 'px';
      updateDropPreview(e.clientX, e.clientY);
    }
  }

  function onTouchMove(e) {
    // 正在觸控拖曳卡片時阻擋 Safari 頁面捲動與橡皮筋回彈
    if (activeDrag) {
      e.preventDefault();
    }
  }

  function onPointerUp(e) {
    if (pendingStart && pendingStart.pointerId === e.pointerId) {
      clearHoldTimer();
      pendingStart = null;
    }
    if (activeDrag && activeDrag.pointerId === e.pointerId) {
      finishTouchDrag(false);
    }
  }

  function onPointerCancel(e) {
    if (pendingStart && pendingStart.pointerId === e.pointerId) {
      clearHoldTimer();
      pendingStart = null;
    }
    if (activeDrag && activeDrag.pointerId === e.pointerId) {
      finishTouchDrag(true);
    }
  }

  let initialized = false;

  global.TouchDnd = {
    init(cbHandlers) {
      handlers = cbHandlers;
      if (initialized) return;
      initialized = true;
      document.addEventListener('pointerdown', onPointerDown, { passive: true });
      document.addEventListener('pointermove', onPointerMove, { passive: true });
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('pointerup', onPointerUp, { passive: true });
      document.addEventListener('pointercancel', onPointerCancel, { passive: true });
    },
    wasJustDragged() {
      return Date.now() < justDraggedUntil;
    },
    isTouchDevice() {
      return (
        ('ontouchstart' in global) ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
        (global.matchMedia && global.matchMedia('(pointer: coarse)').matches)
      );
    }
  };
})(window);
