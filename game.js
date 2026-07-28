(() => {
  const canvas = document.querySelector('#game-canvas');
  const startButton = document.querySelector('#start-game');
  const pauseButton = document.querySelector('#pause-game');
  const overlay = document.querySelector('#game-overlay');
  const overlayTitle = document.querySelector('#overlay-title');
  const overlayCopy = document.querySelector('#overlay-copy');
  const status = document.querySelector('#game-status');
  const scoreEl = document.querySelector('#score');
  const highScoreEl = document.querySelector('#high-score');
  if (!canvas || !startButton || !pauseButton) return;

  const ctx = canvas.getContext('2d');
  const colors = { mint: '#d8f36a', sun: '#ffc857', berry: '#ef7a9c', ocean: '#77c7e8', mono: '#f1f1e9' };
  const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const vectors = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 };
  const state = { running: false, paused: false, score: 0, highScore: 0, character: 'mint', player: null, enemies: [], food: null, lastTime: 0, spawnTimer: 0, particles: [], frameId: null };
  const random = (min, max) => Math.random() * (max - min) + min;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function readHighScore() {
    try { return Number(window.localStorage.getItem('worm-high-score')) || 0; } catch (error) { return 0; }
  }
  function writeHighScore() {
    try { window.localStorage.setItem('worm-high-score', String(state.highScore)); } catch (error) { /* Storage may be unavailable on file://. */ }
  }
  function makeWorm(x, y, size, color, enemy = false) {
    return { x, y, size, color, direction: ['up', 'down', 'left', 'right'][Math.floor(random(0, 4))], speed: enemy ? random(22, 45) : 115, enemy, pattern: Math.floor(random(0, 3)) };
  }
  function updateScore(value) {
    state.score = value;
    if (state.score > state.highScore) { state.highScore = state.score; writeHighScore(); }
    scoreEl.textContent = String(state.score);
    highScoreEl.textContent = String(state.highScore);
  }
  function reset() {
    updateScore(0);
    state.player = makeWorm(canvas.width * .5, canvas.height * .5, 18, colors[state.character]);
    state.player.direction = 'right';
    state.enemies = Array.from({ length: 10 }, () => makeWorm(random(30, canvas.width - 30), random(30, canvas.height - 30), random(9, 42), '#9a9b93', true));
    state.food = { x: random(25, canvas.width - 25), y: random(25, canvas.height - 25), size: 6 };
    state.spawnTimer = 0;
    state.particles = [];
  }
  function setDirection(direction) {
    if (!state.player || !vectors[direction] || opposite[state.player.direction] === direction) return;
    state.player.direction = direction;
  }
  function spawnParticles(x, y, color) { for (let i = 0; i < 16; i += 1) state.particles.push({ x, y, vx: random(-70, 70), vy: random(-70, 70), life: 1, color }); }
  function setOverlay(title, copy, buttonText) { overlayTitle.textContent = title; overlayCopy.textContent = copy; startButton.textContent = buttonText; overlay.hidden = false; overlay.style.display = ''; }
  function hideOverlay() { overlay.hidden = true; overlay.style.display = 'none'; }
  function startGame() { reset(); state.running = true; state.paused = false; state.lastTime = 0; hideOverlay(); pauseButton.disabled = false; pauseButton.textContent = 'Pause'; status.textContent = 'Stay sharp — the field is growing.'; }
  function togglePause() {
    if (!state.running) return;
    state.paused = !state.paused;
    pauseButton.textContent = state.paused ? 'Resume' : 'Pause';
    if (state.paused) { setOverlay('A quiet moment.', 'Your score is safe. Resume when you are ready.', 'Resume'); status.textContent = 'Paused — the field is waiting.'; }
    else { hideOverlay(); status.textContent = 'Back in motion.'; }
  }
  function endGame(message) {
    state.running = false;
    state.paused = false;
    pauseButton.disabled = true;
    pauseButton.textContent = 'Pause';
    setOverlay('The field got you.', `${message} Best score: ${state.highScore}.`, 'Try again');
    status.textContent = 'Game over — choose your next move.';
  }
  function update(delta) {
    if (!state.running || state.paused) return;
    const p = state.player;
    p.x = clamp(p.x + Math.cos(vectors[p.direction]) * p.speed * delta, p.size, canvas.width - p.size);
    p.y = clamp(p.y + Math.sin(vectors[p.direction]) * p.speed * delta, p.size, canvas.height - p.size);
    state.spawnTimer += delta;
    if (state.spawnTimer > 3 && state.enemies.length < 100) { state.enemies.push(makeWorm(random(25, canvas.width - 25), random(25, canvas.height - 25), random(9, 42), '#9a9b93', true)); state.spawnTimer = 0; }
    state.enemies.forEach((enemy) => { enemy.x = clamp(enemy.x + Math.cos(vectors[enemy.direction]) * enemy.speed * delta, enemy.size, canvas.width - enemy.size); enemy.y = clamp(enemy.y + Math.sin(vectors[enemy.direction]) * enemy.speed * delta, enemy.size, canvas.height - enemy.size); if (Math.random() < .015) enemy.direction = ['up', 'down', 'left', 'right'][Math.floor(random(0, 4))]; });
    if (Math.hypot(p.x - state.food.x, p.y - state.food.y) < p.size + state.food.size) { updateScore(state.score + Math.max(5, Math.round(state.food.size * 2))); p.size = Math.min(55, p.size + .8); state.food = { x: random(25, canvas.width - 25), y: random(25, canvas.height - 25), size: random(4, 9) }; }
    for (const enemy of state.enemies) { const distance = Math.hypot(p.x - enemy.x, p.y - enemy.y); if (distance < p.size + enemy.size) { if (p.size > enemy.size * 1.05) { updateScore(state.score + Math.round(enemy.size * 3)); spawnParticles(enemy.x, enemy.y, enemy.color); enemy.x = random(25, canvas.width - 25); enemy.y = random(25, canvas.height - 25); enemy.size = random(9, 42); } else { spawnParticles(p.x, p.y, colors[state.character]); endGame('A larger worm caught you. Smaller worms are safe to eat.'); break; } } }
    state.particles = state.particles.filter((particle) => { particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.life -= delta * 2; return particle.life > 0; });
  }
  function drawWorm(worm) { ctx.save(); ctx.translate(worm.x, worm.y); ctx.rotate(vectors[worm.direction]); ctx.fillStyle = worm.color; ctx.beginPath(); ctx.arc(0, 0, worm.size, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#101010'; ctx.beginPath(); ctx.arc(worm.size * .45, -worm.size * .25, Math.max(2, worm.size * .12), 0, Math.PI * 2); ctx.fill(); if (worm.pattern === 1) { ctx.strokeStyle = '#10101055'; ctx.lineWidth = Math.max(2, worm.size * .13); ctx.beginPath(); ctx.moveTo(-worm.size * .7, -worm.size * .3); ctx.lineTo(worm.size * .7, -worm.size * .3); ctx.stroke(); } if (worm.pattern === 2) { ctx.fillStyle = '#ffffff66'; ctx.beginPath(); ctx.arc(-worm.size * .25, worm.size * .15, Math.max(2, worm.size * .16), 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
  function draw() { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#191a18'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = '#292b26'; ctx.lineWidth = 1; for (let x = 0; x < canvas.width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); } for (let y = 0; y < canvas.height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); } if (state.food) { ctx.fillStyle = colors[state.character]; ctx.beginPath(); ctx.arc(state.food.x, state.food.y, state.food.size, 0, Math.PI * 2); ctx.fill(); } state.enemies.forEach(drawWorm); if (state.player) drawWorm(state.player); state.particles.forEach((particle) => { ctx.globalAlpha = particle.life; ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }); }
  function frame(time) { const delta = Math.min(.05, (time - state.lastTime) / 1000 || 0); state.lastTime = time; update(delta); draw(); state.frameId = window.requestAnimationFrame(frame); }
  startButton.addEventListener('click', () => { if (state.paused) { togglePause(); } else { startGame(); } });
  pauseButton.addEventListener('click', togglePause);
  document.querySelectorAll('[data-direction]').forEach((button) => button.addEventListener('pointerdown', () => setDirection(button.dataset.direction)));
  document.querySelectorAll('[data-character]').forEach((button) => button.addEventListener('click', () => { state.character = button.dataset.character; document.querySelectorAll('.character-choice').forEach((choice) => choice.classList.toggle('active', choice === button)); if (!state.running) { reset(); draw(); } }));
  window.addEventListener('keydown', (event) => { const map = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', W: 'up', A: 'left', S: 'down', D: 'right' }; if (event.key === ' ' && state.running) { event.preventDefault(); togglePause(); return; } if (map[event.key]) { event.preventDefault(); setDirection(map[event.key]); } });
  state.highScore = readHighScore();
  highScoreEl.textContent = String(state.highScore);
  reset(); draw();
  if (state.frameId === null) state.frameId = window.requestAnimationFrame(frame);
})();
