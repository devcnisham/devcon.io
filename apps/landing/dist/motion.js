const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const pauseControl = document.querySelector('.motion-toggle');
const opening = document.querySelector('.opening');
const canvas = document.querySelector('#agent-field');
const context = canvas.getContext('2d');
const previewSteps = [...document.querySelectorAll('.preview-step')];
const activity = document.querySelector('.agent-activity');
const activityMessages = ['Understanding your project', 'Finding the useful next step', 'Leaving out the detours', 'Your path to a first release'];
let userPaused = false;
let heroVisible = true;
let animationFrame = 0;
let previousTime = 0;
let elapsed = 0;
let lastStep = -1;
let width = 0;
let height = 0;
let particles = [];
let typingTimer;
const fullPrompt = document.querySelector('.typed-prompt').textContent;
const theme = getComputedStyle(document.documentElement);
const fieldDot = theme.getPropertyValue('--field-dot').trim() || '#a4b3ff80';
const fieldDim = theme.getPropertyValue('--field-dim').trim() || '#7a96d638';
const fieldLine = theme.getPropertyValue('--field-line').trim() || '128,155,226';
function isPaused() { return userPaused || motionPreference.matches; }

function resizeField() {
  const bounds = opening.getBoundingClientRect();
  width = bounds.width;
  height = bounds.height;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  particles = Array.from({length: width < 640 ? 24 : 48}, (_, index) => ({
    x: ((index * 137.51 + 43) % 1000) / 1000 * width,
    y: ((index * 93.71 + 71) % 1000) / 1000 * height,
    vx: Math.sin(index * 2.3) * .075,
    vy: Math.cos(index * 1.7) * .055,
    radius: index % 7 === 0 ? 1.5 : .7,
  }));
  drawField(0);
}

function drawField(delta) {
  context.clearRect(0, 0, width, height);
  particles.forEach((particle, index) => {
    particle.x = (particle.x + particle.vx * delta + width) % width;
    particle.y = (particle.y + particle.vy * delta + height) % height;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fillStyle = index % 7 === 0 ? fieldDot : fieldDim;
    context.fill();
    for (let next = index + 1; next < particles.length; next++) {
      const other = particles[next];
      const distance = Math.hypot(particle.x - other.x, particle.y - other.y);
      if (distance > 145) continue;
      context.beginPath(); context.moveTo(particle.x, particle.y); context.lineTo(other.x, other.y);
      context.strokeStyle = `rgba(${fieldLine},${(1 - distance / 145) * .11})`;
      context.lineWidth = .6; context.stroke();
    }
  });
}

function frame(time) {
  animationFrame = 0;
  if (isPaused() || !heroVisible || document.hidden) { previousTime = 0; return; }
  const delta = previousTime ? Math.min(time - previousTime, 50) : 0;
  previousTime = time;
  elapsed += delta;
  drawField(delta);
  const current = Math.floor(elapsed / 2200) % previewSteps.length;
  if (current !== lastStep) {
    lastStep = current;
    previewSteps.forEach((step, index) => step.classList.toggle('is-active', index === current));
    activity.textContent = activityMessages[current];
  }
  animationFrame = requestAnimationFrame(frame);
}

function syncMotion() {
  const paused = isPaused();
  document.body.classList.toggle('motion-paused', paused);
  pauseControl.setAttribute('aria-pressed', String(userPaused));
  pauseControl.innerHTML = userPaused ? '<span>▷</span> Resume motion' : '<span>Ⅱ</span> Pause motion';
  if (paused) {
    cancelAnimationFrame(animationFrame); animationFrame = 0; previousTime = 0;
    clearTimeout(typingTimer);
    document.querySelector('.typed-prompt').textContent = fullPrompt;
  } else if (!animationFrame && heroVisible && !document.hidden) {
    animationFrame = requestAnimationFrame(frame);
  }
}

pauseControl.addEventListener('click', () => { userPaused = !userPaused; syncMotion(); });
motionPreference.addEventListener('change', syncMotion);
document.addEventListener('visibilitychange', syncMotion);

const heroObserver = new IntersectionObserver(entries => {
  heroVisible = entries[0].isIntersecting;
  if (!heroVisible) { cancelAnimationFrame(animationFrame); animationFrame = 0; previousTime = 0; }
  syncMotion();
});
heroObserver.observe(opening);

const revealTargets = document.querySelectorAll('.section-heading, .workflow-grid article, .playground-heading, .playground, .prompt-copy, .prompt-card, .principle-band, .faq-section > div, .closing-inner h2, .closing-inner > .button');
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); } });
}, {threshold: .08, rootMargin: '0px 0px -25px 0px'});
revealTargets.forEach((element, index) => {
  element.classList.add('reveal');
  if (element.closest('.workflow-grid')) element.style.setProperty('--reveal-delay', `${index % 3 * 80}ms`);
  revealObserver.observe(element);
});
document.body.classList.add('motion-ready');

let scrollPending = false;
function updateProgress() {
  const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollRange > 0 ? window.scrollY / scrollRange : 0;
  document.querySelector('.reading-progress').style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  scrollPending = false;
}
window.addEventListener('scroll', () => { if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateProgress); } }, {passive:true});
const resizeObserver = new ResizeObserver(() => { resizeField(); updateProgress(); });
resizeObserver.observe(opening);

function typePrompt() {
  if (isPaused()) return;
  const target = document.querySelector('.typed-prompt');
  let letters = 0;
  target.textContent = '';
  function typeNext() {
    if (isPaused()) { target.textContent = fullPrompt; return; }
    target.textContent = fullPrompt.slice(0, ++letters);
    if (letters < fullPrompt.length) typingTimer = setTimeout(typeNext, 38);
  }
  typingTimer = setTimeout(typeNext, 700);
}
resizeField(); syncMotion(); updateProgress(); typePrompt();
