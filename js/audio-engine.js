/**
 * Web Audio 音效合成引擎 (Audio Engine)
 * 無需外部音檔，純瀏覽器即時合成 10 種指令卡音效與操作回饋音效
 */
(function (global) {
  'use strict';

  let ctx = null;
  let muted = false;
  let unlocked = false;

  function ensureContext() {
    if (muted) return null;
    if (!ctx) {
      const AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  // iPadOS Safari 需於首次使用者觸控／點擊手勢內同步解鎖 AudioContext 並播放 1 sample 靜音緩衝
  function unlockAudio() {
    if (unlocked) return;
    const AudioCtx = global.AudioContext || global.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      if (!ctx) ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
      unlocked = true;
      document.removeEventListener('touchstart', unlockAudio, true);
      document.removeEventListener('pointerdown', unlockAudio, true);
      document.removeEventListener('click', unlockAudio, true);
    } catch (_) {}
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('touchstart', unlockAudio, true);
    document.addEventListener('pointerdown', unlockAudio, true);
    document.addEventListener('click', unlockAudio, true);
  }

  function playTone(freq, startOffset, duration, type, volume, endFreq) {
    const c = ensureContext();
    if (!c) return;
    const now = c.currentTime + startOffset;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq && endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume || 0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playNoise(startOffset, duration, filterFreq, filterType, volume) {
    const c = ensureContext();
    if (!c) return;
    const sampleRate = c.sampleRate;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = c.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = c.createBufferSource();
    source.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = filterType || 'bandpass';
    filter.frequency.value = filterFreq || 1200;

    const gain = c.createGain();
    const now = c.currentTime + startOffset;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume || 0.16, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  const SOUNDS = {
    // 1. 嗨！：上揚開朗雙音
    hi() {
      playTone(523, 0.0, 0.14, 'triangle', 0.22, 660);
      playTone(784, 0.14, 0.24, 'triangle', 0.22, 880);
      return 480;
    },
    // 2. 啊！：輕快驚喜音
    ah() {
      playTone(440, 0.0, 0.12, 'sine', 0.22, 740);
      playTone(880, 0.12, 0.22, 'sine', 0.2, 660);
      return 420;
    },
    // 3. 咦？：疑惑滑升問句音
    huh() {
      playTone(340, 0.0, 0.16, 'sine', 0.2, 310);
      playTone(330, 0.16, 0.26, 'sine', 0.22, 620);
      return 480;
    },
    // 4. 呃啊：低落沮喪下滑音
    uhoh() {
      playTone(420, 0.0, 0.18, 'sawtooth', 0.11, 350);
      playTone(310, 0.2, 0.34, 'sawtooth', 0.11, 175);
      return 600;
    },
    // 5. 老鼠呼叫：高頻連續吱吱聲
    mouse() {
      for (let i = 0; i < 4; i++) {
        playTone(1700, i * 0.11, 0.08, 'sine', 0.14, 2400);
      }
      return 520;
    },
    // 6. 企鵝嘎嘎叫：方波鼻音嘎嘎
    penguin() {
      playTone(280, 0.0, 0.14, 'square', 0.1, 370);
      playTone(310, 0.18, 0.14, 'square', 0.1, 250);
      playTone(290, 0.36, 0.16, 'square', 0.1, 390);
      return 580;
    },
    // 7. 歡呼：三和弦慶祝音 + 掌聲
    cheer() {
      playTone(523.25, 0.0, 0.14, 'triangle', 0.2);
      playTone(659.25, 0.12, 0.14, 'triangle', 0.2);
      playTone(783.99, 0.24, 0.14, 'triangle', 0.2);
      playTone(1046.5, 0.36, 0.32, 'triangle', 0.24);
      playNoise(0.28, 0.45, 2200, 'bandpass', 0.12);
      return 760;
    },
    // 8. 工廠：節奏機械聲 + 馬達嗡嗡
    factory() {
      playTone(110, 0.0, 0.55, 'sawtooth', 0.09, 125);
      playNoise(0.05, 0.1, 700, 'bandpass', 0.18);
      playNoise(0.22, 0.1, 900, 'bandpass', 0.18);
      playNoise(0.4, 0.12, 650, 'bandpass', 0.2);
      return 620;
    },
    // 9. 消防水管：高壓噴水白噪音
    firehose() {
      playNoise(0.0, 0.65, 1800, 'highpass', 0.18);
      playTone(300, 0.0, 0.5, 'sine', 0.06, 520);
      return 700;
    },
    // 10. 警笛：高低頻緊急警笛
    siren() {
      playTone(620, 0.0, 0.22, 'sawtooth', 0.1, 980);
      playTone(980, 0.22, 0.22, 'sawtooth', 0.1, 620);
      playTone(620, 0.44, 0.22, 'sawtooth', 0.1, 980);
      return 720;
    },

    // UI 與機器人系統回饋音效
    step() {
      playTone(260, 0.0, 0.07, 'triangle', 0.12, 330);
      return 100;
    },
    turn() {
      playTone(380, 0.0, 0.08, 'sine', 0.11, 460);
      return 100;
    },
    gear() {
      playTone(180, 0.0, 0.18, 'sawtooth', 0.07, 220);
      return 200;
    },
    click() {
      playTone(600, 0.0, 0.05, 'sine', 0.08, 720);
      return 60;
    },
    error() {
      playTone(220, 0.0, 0.15, 'sawtooth', 0.12, 160);
      playTone(160, 0.16, 0.2, 'sawtooth', 0.12, 120);
      return 380;
    },
    scan() {
      playTone(880, 0.0, 0.08, 'sine', 0.14, 1320);
      playTone(1320, 0.09, 0.1, 'sine', 0.12, 1760);
      return 220;
    }
  };

  global.AudioEngine = {
    play(soundId) {
      if (muted) return 350;
      const fn = SOUNDS[soundId];
      if (!fn) return 300;
      try {
        return fn();
      } catch (e) {
        return 300;
      }
    },
    setMuted(val) {
      muted = !!val;
    },
    isMuted() {
      return muted;
    }
  };
})(window);
