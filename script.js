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

const SPRINKLE_COLORS = ["#fff176", "#61d2a2", "#ff735c", "#9c7bff", "#ffffff"];

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

function spawnTreat(now) {
  const isCupcake = Math.random() < 0.28;
  const size = isCupcake ? randomBetween(48, 70) : randomBetween(42, 64);
  state.coffees.push({
    x: randomBetween(size, window.innerWidth - size),
    y: -size,
    size,
    speed: randomBetween(145, 245),
    spin: randomBetween(-1.2, 1.2),
    angle: randomBetween(-0.3, 0.3),
    kind: isCupcake ? "cupcake" : "coffee",
    points: isCupcake ? 2 : 1,
    sprinkles: Array.from({ length: 12 }, (_, index) => ({
      x: randomBetween(-0.28, 0.28),
      y: randomBetween(-0.28, 0.02),
      color: SPRINKLE_COLORS[index % SPRINKLE_COLORS.length],
    })),
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

  ctx.fillStyle = "#1b2024";
  roundRect(-s * 0.36, -s * 0.48, s * 0.72, s * 0.18, s * 0.06);
  ctx.fill();

  ctx.fillStyle = "#fffdf7";
  ctx.beginPath();
  ctx.moveTo(-s * 0.32, -s * 0.3);
  ctx.lineTo(s * 0.32, -s * 0.3);
  ctx.lineTo(s * 0.22, s * 0.48);
  ctx.lineTo(-s * 0.22, s * 0.48);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(27, 32, 36, 0.24)";
  ctx.lineWidth = Math.max(2, s * 0.04);
  ctx.stroke();

  ctx.fillStyle = "#ff7fbd";
  roundRect(-s * 0.28, -s * 0.02, s * 0.56, s * 0.22, s * 0.06);
  ctx.fill();

  ctx.fillStyle = "#1b2024";
  ctx.font = `900 ${Math.floor(s * 0.16)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("1", 0, s * 0.09);
  ctx.restore();
}

function drawCupcake(cup) {
  ctx.save();
  ctx.translate(cup.x, cup.y);
  ctx.rotate(cup.angle);
  const s = cup.size;

  ctx.shadowColor = "rgba(0, 0, 0, 0.34)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;

  ctx.fillStyle = "#ff7fbd";
  ctx.beginPath();
  ctx.arc(0, -s * 0.08, s * 0.34, Math.PI, 0);
  ctx.arc(s * 0.22, -s * 0.08, s * 0.22, Math.PI, 0);
  ctx.arc(-s * 0.22, -s * 0.08, s * 0.22, Math.PI, 0);
  ctx.lineTo(s * 0.42, s * 0.12);
  ctx.lineTo(-s * 0.42, s * 0.12);
  ctx.closePath();
  ctx.fill();

  for (const sprinkle of cup.sprinkles) {
    const sprinkleX = sprinkle.x * s;
    const sprinkleY = sprinkle.y * s;
    ctx.strokeStyle = sprinkle.color;
    ctx.lineWidth = Math.max(2, s * 0.035);
    ctx.beginPath();
    ctx.moveTo(sprinkleX - s * 0.035, sprinkleY);
    ctx.lineTo(sprinkleX + s * 0.035, sprinkleY + s * 0.025);
    ctx.stroke();
  }

  ctx.fillStyle = "#d82e4f";
  ctx.beginPath();
  ctx.arc(0, -s * 0.46, s * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4f8a3d";
  ctx.lineWidth = Math.max(2, s * 0.035);
  ctx.beginPath();
  ctx.moveTo(s * 0.04, -s * 0.55);
  ctx.quadraticCurveTo(s * 0.16, -s * 0.64, s * 0.24, -s * 0.52);
  ctx.stroke();

  ctx.fillStyle = "#fff0b8";
  ctx.beginPath();
  ctx.moveTo(-s * 0.38, s * 0.06);
  ctx.lineTo(s * 0.38, s * 0.06);
  ctx.lineTo(s * 0.28, s * 0.5);
  ctx.lineTo(-s * 0.28, s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(163, 86, 42, 0.38)";
  ctx.lineWidth = Math.max(1.5, s * 0.025);
  for (let x = -0.2; x <= 0.2; x += 0.2) {
    ctx.beginPath();
    ctx.moveTo(s * x, s * 0.09);
    ctx.lineTo(s * x * 0.75, s * 0.46);
    ctx.stroke();
  }

  ctx.fillStyle = "#1b2024";
  ctx.font = `900 ${Math.floor(s * 0.16)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("2", 0, s * 0.27);
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
    spawnTreat(now);
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
        state.score += cup.points;
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
  for (const cup of state.coffees) {
    if (cup.kind === "cupcake") {
      drawCupcake(cup);
    } else {
      drawCoffee(cup);
    }
  }
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
