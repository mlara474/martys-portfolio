const video = document.querySelector("#camera");
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");
const statusPanel = document.querySelector("#statusPanel");
const statusText = document.querySelector("#statusText");

const state = {
  score: 0,
  coffees: [],
  hands: [],
  lastCoffeeAt: 0,
  lastFrameAt: 0,
  running: false,
  detector: null,
};

const COFFEE_TYPES = [
  { fill: "#f3eee2", sleeve: "#d99b55", lid: "#24282c" },
  { fill: "#62d3a4", sleeve: "#fff8ee", lid: "#1b2024" },
  { fill: "#ff735c", sleeve: "#f3eee2", lid: "#1b2024" },
];

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function setStatus(message, isPlaying = false) {
  statusText.textContent = message;
  statusPanel.classList.toggle("is-playing", isPlaying);
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function spawnCoffee(now) {
  const size = randomBetween(42, 66);
  state.coffees.push({
    x: randomBetween(size, window.innerWidth - size),
    y: -size,
    size,
    speed: randomBetween(150, 245),
    spin: randomBetween(-1.2, 1.2),
    angle: randomBetween(-0.3, 0.3),
    type: COFFEE_TYPES[Math.floor(Math.random() * COFFEE_TYPES.length)],
    bornAt: now,
  });
}

function drawCoffee(cup) {
  ctx.save();
  ctx.translate(cup.x, cup.y);
  ctx.rotate(cup.angle);
  const s = cup.size;

  ctx.shadowColor = "rgba(0, 0, 0, 0.34)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;

  ctx.fillStyle = cup.type.lid;
  roundRect(-s * 0.36, -s * 0.48, s * 0.72, s * 0.18, s * 0.06);
  ctx.fill();

  ctx.fillStyle = cup.type.fill;
  ctx.beginPath();
  ctx.moveTo(-s * 0.32, -s * 0.3);
  ctx.lineTo(s * 0.32, -s * 0.3);
  ctx.lineTo(s * 0.22, s * 0.48);
  ctx.lineTo(-s * 0.22, s * 0.48);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = cup.type.sleeve;
  roundRect(-s * 0.28, -s * 0.02, s * 0.56, s * 0.22, s * 0.06);
  ctx.fill();

  ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
  ctx.beginPath();
  ctx.arc(0, s * 0.09, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawHand(point, index) {
  const radius = index === 0 ? 32 : 26;
  ctx.save();
  ctx.fillStyle = index === 0 ? "rgba(97, 210, 162, 0.24)" : "rgba(255, 115, 92, 0.22)";
  ctx.strokeStyle = index === 0 ? "#61d2a2" : "#ff735c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBackdrop() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.fillStyle = "rgba(16, 19, 22, 0.16)";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
}

function updateGame(now) {
  const delta = Math.min(0.04, (now - state.lastFrameAt) / 1000 || 0.016);
  state.lastFrameAt = now;

  if (now - state.lastCoffeeAt > 760) {
    spawnCoffee(now);
    state.lastCoffeeAt = now;
  }

  for (const cup of state.coffees) {
    cup.y += cup.speed * delta;
    cup.angle += cup.spin * delta;
  }

  for (const hand of state.hands) {
    for (const cup of state.coffees) {
      const dx = cup.x - hand.x;
      const dy = cup.y - hand.y;
      const caught = Math.hypot(dx, dy) < cup.size * 0.7 + 28;
      if (caught && !cup.caught) {
        cup.caught = true;
        state.score += 1;
        scoreEl.textContent = state.score;
      }
    }
  }

  state.coffees = state.coffees.filter(
    (cup) => !cup.caught && cup.y < window.innerHeight + cup.size
  );
}

function drawGame() {
  drawBackdrop();
  for (const cup of state.coffees) drawCoffee(cup);
  state.hands.forEach(drawHand);
}

async function loadHandDetector() {
  const vision = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/vision_bundle.mjs"
  );
  const filesetResolver = await vision.FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
  );
  const options = (delegate) => ({
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate,
    },
    runningMode: "VIDEO",
    numHands: 2,
  });

  try {
    return await vision.HandLandmarker.createFromOptions(filesetResolver, options("GPU"));
  } catch (error) {
    return vision.HandLandmarker.createFromOptions(filesetResolver, options("CPU"));
  }
}

async function startCamera() {
  startButton.disabled = true;
  setStatus("Loading hand tracking...");

  try {
    state.detector = state.detector || (await loadHandDetector());
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    state.running = true;
    setStatus("Playing", true);
    requestAnimationFrame(loop);
  } catch (error) {
    console.error(error);
    setStatus("Camera or hand tracking could not start. Please allow camera access and refresh.");
    startButton.disabled = false;
  }
}

function detectHands(now) {
  if (!state.detector || video.readyState < 2) return;
  const result = state.detector.detectForVideo(video, now);
  state.hands = (result.landmarks || []).map((landmarks) => {
    const wrist = landmarks[0];
    const middle = landmarks[9];
    const x = window.innerWidth - ((wrist.x + middle.x) / 2) * window.innerWidth;
    const y = ((wrist.y + middle.y) / 2) * window.innerHeight;
    return { x, y };
  });
}

function loop(now) {
  if (!state.running) return;
  detectHands(now);
  updateGame(now);
  drawGame();
  requestAnimationFrame(loop);
}

function resetGame() {
  state.score = 0;
  state.coffees = [];
  scoreEl.textContent = "0";
}

window.addEventListener("resize", resizeCanvas);
startButton.addEventListener("click", startCamera);
resetButton.addEventListener("click", resetGame);

resizeCanvas();
drawBackdrop();
