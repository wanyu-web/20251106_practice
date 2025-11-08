let table;
let questions = [];
let current = 0;
let score = 0;
let selected = -1;
let showFeedback = false;
let feedbackTimer = 0;
let state = 'quiz'; // 'quiz', 'final'
let trail = [];
let particles = [];
let confetti = [];

let prevMouseX = 0;
let prevMouseY = 0;

let canvasEl;
let canvasWratio = 0.8;
let canvasHratio = 0.9;

// for grass/gradient toggle removed — now gradient background
let fireColors = ['#FF4D4D','#FFB84D','#FFFF4D','#8DFF4D','#4DFFB8','#4DD0FF','#4D4DFF','#B84DFF'];

function preload() {
  table = loadTable('questions.csv', 'csv', 'header');
}

function setup() {
  pixelDensity(1);
  createCenteredCanvas();
  textFont('Arial');
  parseTable();
  noCursor();
  prevMouseX = mouseX;
  prevMouseY = mouseY;
}

function createCenteredCanvas() {
  let cw = max(400, floor(windowWidth * canvasWratio));
  let ch = max(300, floor(windowHeight * canvasHratio));
  canvasEl = createCanvas(cw, ch);
  canvasEl.style('display', 'block');
  canvasEl.position((windowWidth - cw) / 2, (windowHeight - ch) / 2);
  noSmooth();
}

function windowResized() {
  let cw = max(400, floor(windowWidth * canvasWratio));
  let ch = max(300, floor(windowHeight * canvasHratio));
  resizeCanvas(cw, ch);
  canvasEl.position((windowWidth - cw) / 2, (windowHeight - ch) / 2);
}

function parseTable() {
  questions = [];
  if (!table) return;
  for (let r=0; r<table.getRowCount(); r++) {
    let row = table.getRow(r);
    let q = {
      text: row.get('question'),
      opts: [row.get('optionA'), row.get('optionB'), row.get('optionC'), row.get('optionD')],
      answer: int(row.get('answer')) - 1
    };
    questions.push(q);
  }
  if (questions.length === 0 && table && table.getRowCount() > 0) {
    for (let r=0; r<table.getRowCount(); r++) {
      let row = table.getRow(r).arr;
      if (row.length >= 6) {
        questions.push({
          text: row[0],
          opts: [row[1], row[2], row[3], row[4]],
          answer: int(row[5]) - 1
        });
      }
    }
  }
}

function draw() {
  // 新背景：多段漸層
  drawMultiStopGradient();

  // overlay tone by score to keep previous effect
  let t = map(score, 0, max(1, questions.length), 0, 180);
  push();
  noStroke();
  fill(30 + t*0.3, 30, 50 + t*0.4, 30);
  rect(0, 0, width, height);
  pop();

  if (state === 'quiz') {
    if (questions.length === 0) drawNoQuestions();
    else drawQuestion();
  } else {
    drawFinal();
  }

  // particle updates (cursor fireworks + feedback)
  for (let i = particles.length-1; i >=0; i--) {
    particles[i].update();
    particles[i].show();
    if (particles[i].done) particles.splice(i,1);
  }

  for (let c=confetti.length-1; c>=0; c--) {
    confetti[c].update();
    confetti[c].show();
    if (confetti[c].y > height + 50 && confetti[c].vy > 0) confetti.splice(c,1);
  }

  drawCursor();

  if (showFeedback) {
    feedbackTimer--;
    if (feedbackTimer <= 0) {
      showFeedback = false;
      selected = -1;
      current++;
      if (current >= questions.length) {
        state = 'final';
        prepareFinal();
      }
    }
  }
}

/* ---------- 多段漸層背景 ---------- */
function drawMultiStopGradient() {
  // color stops: dd fd fe -> E0 E1 E9 -> E7 CE E3 -> E4 B4 C2 -> ff b8 d1
  let stops = [
    color('#ddfdfe'),
    color('#E0E1E9'),
    color('#E7CEE3'),
    color('#E4B4C2'),
    color('#ffb8d1')
  ];
  // draw vertical gradient with interpolation between stops
  noFill();
  for (let y=0; y<height; y++) {
    let t = y / (height - 1);
    let seg = t * (stops.length - 1);
    let idx = floor(seg);
    let localT = constrain(seg - idx, 0, 1);
    let c1 = stops[idx];
    let c2 = stops[min(idx+1, stops.length-1)];
    let nc = lerpColor(c1, c2, localT);
    stroke(nc);
    line(0, y, width, y);
  }
}

/* ---------- UI & content (文字大小隨畫布改變) ---------- */
function drawNoQuestions() {
  push();
  textAlign(CENTER, CENTER);
  fill(40);
  textSize(min(24, width*0.03));
  text('找不到 questions.csv 或題庫為空。\n請把 questions.csv 放到同一資料夾並包含標題欄: question,optionA,optionB,optionC,optionD,answer', width/2, height/2);
  pop();
}

function drawQuestion() {
  let q = questions[current];
  push();
  translate(width*0.06, height*0.06);
  fill(40);
  textSize(min(48, width*0.035, height*0.06));
  textAlign(LEFT, TOP);
  text('題目 ' + (current+1) + ' / ' + questions.length, 0, 0);
  textSize(min(28, width*0.025, height*0.04));
  fill(20);
  text(q.text, 0, 50, width*0.88);
  pop();

  // 選項區
  let boxW = min(720, width*0.8);
  let boxH = min(80, height*0.09);
  let startX = (width - boxW)/2;
  let startY = height*0.45;
  for (let i=0; i<4; i++) {
    let x = startX;
    let y = startY + i*(boxH + max(12, height*0.02));
    let hovered = mouseX > x && mouseX < x+boxW && mouseY > y && mouseY < y+boxH;
    let col = color(255, 255, 255, 200);
    if (hovered) col = lerpColor(col, color(200,230,255), 0.3);
    if (showFeedback && selected === i) {
      if (i === q.answer) col = color(120,220,160);
      else col = color(255,160,160);
    } else if (showFeedback && i === q.answer) {
      col = color(120,220,160, 220);
    }
    push();
    translate(x,y);
    noStroke();
    fill(col);
    rect(0,0,boxW,boxH,12);
    fill(30);
    textSize(min(22, width*0.02, height*0.03));
    textAlign(LEFT, CENTER);
    text((['A','B','C','D'][i]) + '.  ' + q.opts[i], 20, boxH/2);
    pop();

    if (hovered && !showFeedback) {
      for (let k=0;k<2;k++){
        particles.push(new FireParticle(random(x+40,x+boxW-40), random(y+10,y+boxH-10), randomChoice(fireColors), false));
      }
    }
  }

  push();
  fill(40);
  textSize(min(18, width*0.02));
  textAlign(RIGHT, BOTTOM);
  text('得分: ' + score + ' / ' + questions.length, width - 20, height - 20);
  pop();
}

/* ---------- mouse interaction ---------- */
function mousePressed() {
  if (state === 'quiz' && !showFeedback && questions.length > 0) {
    let q = questions[current];
    let boxW = min(720, width*0.8);
    let boxH = min(80, height*0.09);
    let startX = (width - boxW)/2;
    let startY = height*0.45;
    for (let i=0; i<4; i++) {
      let x = startX;
      let y = startY + i*(boxH + max(12, height*0.02));
      if (mouseX > x && mouseX < x+boxW && mouseY > y && mouseY < y+boxH) {
        selected = i;
        evaluateSelection(i);
        break;
      }
    }
  } else if (state === 'final') {
    restart();
  }
  // big burst on click
  burst(mouseX, mouseY, randomChoice(fireColors), 40);
}

/* ---------- evaluate & feedback ---------- */
function evaluateSelection(i) {
  let q = questions[current];
  showFeedback = true;
  feedbackTimer = 60;
  if (i === q.answer) {
    score++;
    burst(mouseX, mouseY, '#8CFF9A', 24);
  } else {
    burst(mouseX, mouseY, '#FF9AA2', 24);
    let correctY = height*0.45 + q.answer*(min(80, height*0.09)+max(12, height*0.02)) + 30;
    for (let k=0;k<20;k++){
      particles.push(new FireParticle(width/2, correctY + random(-20,20), '#8CFF9A', false));
    }
  }
}

/* ---------- Firework / cursor particles ---------- */
class FireParticle {
  constructor(x,y,col,fast=true) {
    this.x = x;
    this.y = y;
    this.col = color(col);
    this.size = random(2,8);
    this.vx = random(-2,2) * (fast ? 2 : 1);
    this.vy = random(-2,2) * (fast ? 2 : 1);
    this.life = 30 + floor(random(30));
    this.alpha = 255;
    this.done = false;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.06;
    this.alpha -= 6;
    this.life--;
    if (this.life <= 0 || this.alpha <= 0) this.done = true;
  }
  show() {
    noStroke();
    push();
    fill(red(this.col), green(this.col), blue(this.col), this.alpha);
    ellipse(this.x, this.y, this.size);
    pop();
  }
}

function burst(x,y, colHex, count = 20) {
  for (let i=0;i<count;i++){
    let p = new FireParticle(x + random(-6,6), y + random(-6,6), colHex, true);
    p.vx = random(-6,6);
    p.vy = random(-6,6);
    p.size = random(3,10);
    particles.push(p);
  }
}

/* ---------- cursor as color-changing fireworks with drag trail ---------- */
function drawCursor() {
  // add trail points
  trail.push({x:mouseX, y:mouseY, a:160});
  if (trail.length > 40) trail.shift();

  // spawn small spark particles while moving (creates firework drawing)
  let dx = mouseX - prevMouseX;
  let dy = mouseY - prevMouseY;
  let speed = sqrt(dx*dx + dy*dy);
  let spawnCount = constrain(floor(speed/2) + 1, 1, 8);
  let baseColor = fireColors[floor((frameCount*0.05) % fireColors.length)];
  for (let i=0;i<spawnCount;i++){
    let jitterX = random(-2,2);
    let jitterY = random(-2,2);
    particles.push(new FireParticle(mouseX + jitterX, mouseY + jitterY, randomChoice(fireColors), false));
  }

  // when dragging fast leave more pronounced burst
  if (mouseIsPressed && speed > 4) {
    burst(mouseX, mouseY, baseColor, 12);
  }

  // draw trail (fading blobs)
  noStroke();
  for (let i=trail.length-1; i>=0; i--) {
    let t = trail[i];
    fill(255, 200, 220, t.a * (i / trail.length));
    let s = map(i, 0, trail.length, 2, 12);
    ellipse(t.x, t.y, s);
  }

  // small pointer indicator (transparent)
  push();
  noFill();
  stroke(200, 100);
  strokeWeight(1.4);
  ellipse(mouseX, mouseY, 10);
  pop();

  prevMouseX = mouseX;
  prevMouseY = mouseY;
}

/* ---------- final & confetti (保留原邏輯) ---------- */
let finalAnimPrepared = false;
let finalMode = 'encourage';
function prepareFinal() {
  finalAnimPrepared = true;
  confetti = [];
  let pct = score / max(1, questions.length);
  if (pct >= 0.8) finalMode = 'praise';
  else if (pct >= 0.5) finalMode = 'encourage';
  else finalMode = 'try';

  if (finalMode === 'praise') {
    for (let i=0;i<250;i++){
      confetti.push(new Confetti(random(width), random(-height,0), random(-1,1), random(1,6), random(6,12), color(random(60,255), random(60,255), random(60,255))));
    }
  } else if (finalMode === 'encourage') {
    for (let i=0;i<120;i++){
      confetti.push(new Confetti(random(width), random(height), random(-0.6,0.6), random(-2,-0.2), random(4,8), color(120,200,255,180)));
    }
  } else {
    for (let i=0;i<160;i++){
      confetti.push(new Confetti(random(width), random(-height, height), 0, random(3,8), random(1,3), color(120,140,255,160)));
    }
  }
}

class Confetti {
  constructor(x,y,vx,vy,sz,col) {
    this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.sz=sz; this.col=col;
  }
  update(){ this.x += this.vx; this.y += this.vy; }
  show(){ noStroke(); fill(this.col); rect(this.x, this.y, this.sz, this.sz*1.8); }
}

function drawFinal() {
  push();
  translate(width*0.06, height*0.12);
  fill(30);
  textSize(min(48, width*0.04));
  textAlign(LEFT, TOP);
  text('測驗結束', 0, 0);
  textSize(min(24, width*0.02));
  text('你的分數: ' + score + ' / ' + questions.length, 0, 70);
  pop();

  push();
  textAlign(CENTER, CENTER);
  textSize(min(36, width*0.035));
  fill(30);
  if (finalMode === 'praise') {
    text('太棒了！你表現優異 🎉', width/2, height*0.35);
  } else if (finalMode === 'encourage') {
    text('表現不錯！再接再厲 💪', width/2, height*0.35);
  } else {
    text('繼續努力，別放棄 ☘️', width/2, height*0.35);
  }
  pop();

  push();
  textSize(16);
  fill(60);
  textAlign(CENTER, CENTER);
  text('按任意處重玩', width/2, height*0.65);
  pop();

  for (let i=confetti.length-1;i>=0;i--){
    let c = confetti[i];
    c.update();
    if (finalMode === 'praise') c.vy += 0.04;
    else if (finalMode === 'encourage') {
      c.vy -= 0.02;
      if (c.y < -20) c.y = height + random(0,200);
    } else {
      c.vy += 0.06;
      if (c.y > height + 50) c.y = random(-200, -10);
    }
    c.show();
  }
}

/* ---------- restart ---------- */
function restart() {
  current = 0;
  score = 0;
  selected = -1;
  showFeedback = false;
  feedbackTimer = 0;
  state = 'quiz';
  particles = [];
  confetti = [];
  finalAnimPrepared = false;
}

/* ---------- helpers ---------- */
function randomChoice(arr) {
  return arr[floor(random(arr.length))];
}
