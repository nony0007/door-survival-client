// ===== DOM =====
const $ = s => document.querySelector(s);
const canvas = $("#game");
const ctx = canvas.getContext("2d");

const phaseEl = $("#phase");
const waveEl = $("#wave");
const coinsEl = $("#coins");
const livesEl = $("#lives");
const speedEl = $("#speed");

const lobbyCard = $("#lobby");
const panelCard = $("#panel");
const playersList = $("#players");
const startBtn = $("#startBtn");

const nameInput = $("#nameInput");
const roomInput = $("#roomInput");
const joinBtn = $("#joinBtn");
const createBtn = $("#createBtn");
const roomLabel = $("#roomLabel");
const copyBtn = $("#copyBtn");

const chatLog = $("#chatLog");
const chatInput = $("#chatInput");
const sendBtn = $("#sendBtn");

const shop = $("#shop");
const shopTimer = $("#shopTimer");
shop.addEventListener("click", (e)=>{
  if (e.target.dataset.item) socket.emit("shop:buy", { item: e.target.dataset.item });
});

let socket = null;
let myId = null;
let currentRoom = null;
let state = { phase:"lobby", wave:0, players:[], doors:[] };
let me = null;
let target = { x: 600, y: 650 };
let danceUntil = 0;

// ===== Socket =====
function connect() {
  socket = io(SERVER_URL, { transports:["websocket"] });
  socket.on("connect", ()=>{ myId = socket.id; });
  socket.on("room:update", (s)=>{
    state = s;
    me = s.players.find(p=>p.id===myId) || me;
    renderPlayersList(s.players);
    render();
    phaseEl.textContent = s.phase;
    waveEl.textContent = s.wave;
    if (me) { coinsEl.textContent = me.coins; livesEl.textContent = me.lives; speedEl.textContent = me.speed.toFixed(2)+"x"; }
  });
  socket.on("player:pos", ({id,x,y})=>{
    const p = state.players.find(p=>p.id===id);
    if (p) { p.x=x; p.y=y; render(); }
  });
  socket.on("chat:system", (m)=>appendSys(m));
  socket.on("chat:message", ({from,text})=>appendMsg(from,text));
  socket.on("round:start", ({ wave, doors })=>{
    state.wave = wave; state.doors = doors; render();
  });
  socket.on("door:reveal", ({ id, type, by })=>{
    const d = state.doors.find(x=>x.id===id);
    if (d) { d.openedBy = by; d.type = type; render(); }
  });
  socket.on("game:ended", ({ winner })=>{
    appendSys(winner ? `${winner.name} wins the game!` : `Game ended.`);
  });
  socket.on("shop:start", ({ endsAt })=>{
    shop.classList.remove("hidden");
    const int = setInterval(()=>{
      const ms = Math.max(0, endsAt - Date.now());
      shopTimer.textContent = `Closes in ${(ms/1000).toFixed(1)}s`;
      if (ms<=0){ clearInterval(int); shop.classList.add("hidden"); }
    }, 100);
  });
  socket.on("status:dance", ({ ms })=>{
    danceUntil = Date.now()+ms;
  });
}

function appendSys(text){
  const div = document.createElement("div"); div.className="chatline system"; div.textContent = text;
  chatLog.appendChild(div); chatLog.scrollTop = chatLog.scrollHeight;
}
function appendMsg(from,text){
  const div = document.createElement("div"); div.className="chatline"; 
  const f = document.createElement("span"); f.className="from"; f.textContent=from+":"; 
  const t = document.createElement("span"); t.textContent=" "+text; 
  div.appendChild(f); div.appendChild(t);
  chatLog.appendChild(div); chatLog.scrollTop = chatLog.scrollHeight;
}

function renderPlayersList(list){
  playersList.innerHTML = "";
  list.forEach(p=>{
    const li = document.createElement("li");
    li.textContent = `${p.name} ${p.alive?"":"(X)"} — ${p.coins}c`;
    if (p.id===myId) li.classList.add("me");
    playersList.appendChild(li);
  });
  // Show start only if I am host
  startBtn.style.display = list.length && list[0].id===myId ? "inline-block" : "none";
}

// ===== Movement =====
canvas.addEventListener("click", (e)=>{
  const r = canvas.getBoundingClientRect();
  const tx = (e.clientX - r.left);
  const ty = (e.clientY - r.top);
  // set new target
  target.x = tx; target.y = ty;
});

function step() {
  if (!me) { requestAnimationFrame(step); return; }
  const now = Date.now();
  let speed = (me.speed||1) * 3.2; // px per frame-ish
  const dx = target.x - me.x;
  const dy = target.y - me.y;
  const dist = Math.hypot(dx,dy);
  if (dist>1){
    me.x += (dx/dist)*speed;
    me.y += (dy/dist)*speed;
    socket.emit("player:move", { x: Math.round(me.x), y: Math.round(me.y) });
  }
  render();
  requestAnimationFrame(step);
}

// ===== Doors interaction =====
canvas.addEventListener("dblclick", tryOpenDoor);
canvas.addEventListener("touchstart", (e)=>{
  if (e.touches.length===2) { tryOpenDoor(); }
});

function tryOpenDoor(){
  if (!state.doors || !me) return;
  if (Date.now() < danceUntil) return; // dancing
  const near = state.doors.find(d=>!d.openedBy && Math.hypot(d.x-me.x, d.y-me.y)<=90);
  if (near) socket.emit("door:open", { doorId: near.id });
}

// ===== Render =====
function render(){
  // scale to CSS size
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  if (canvas.width !== Math.floor(rect.width * scale)) {
    canvas.width = Math.floor(rect.width * scale);
    canvas.height = Math.floor(rect.height * scale);
    ctx.scale(scale, scale);
  }
  // clear
  ctx.clearRect(0,0,rect.width,rect.height);

  // background grid
  ctx.fillStyle = "#081022";
  ctx.fillRect(0,0,rect.width,rect.height);
  ctx.strokeStyle = "#0f2346";
  for (let x=0; x<rect.width; x+=40){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,rect.height); ctx.stroke(); }
  for (let y=0; y<rect.height; y+=40){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(rect.width,y); ctx.stroke(); }

  // doors
  if (state.doors){
    state.doors.forEach(d=>{
      const opened = !!d.openedBy;
      ctx.fillStyle = opened ? "#263a66" : "#394b7a";
      ctx.strokeStyle = opened ? "#6a7fb6" : "#9ab3ff";
      roundRect(ctx, d.x-30, d.y-40, 60, 80, 8, true, true);
      ctx.fillStyle = opened ? "#9ab3ff" : "#eaf0ff";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("DOOR "+d.id, d.x, d.y+50);
      if (opened){
        // show icon for type
        const t = d.type || "safe";
        const icon = { death:"💀", treasure_big:"💰", extra_life:"❤️", king_outfit:"👑", treasure:"🪙", speed:"⚡", clue:"❓", swap:"🔄", dance:"💃", portal:"🌀", safe:"✅" }[t] || "✅";
        ctx.fillText(icon, d.x, d.y);
      }
    });
  }

  // players
  state.players.forEach(p=>{
    if (!p.alive){
      ctx.fillStyle = "rgba(255,0,0,0.4)";
      ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle = p.skin==="king" ? "#ffd54a" : "#9ab3ff";
      ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI*2); ctx.fill();
      // crown if king
      if (p.skin==="king"){
        ctx.fillStyle = "#ffea7a";
        ctx.beginPath();
        ctx.moveTo(p.x-10, p.y-14);
        ctx.lineTo(p.x-4, p.y-22);
        ctx.lineTo(p.x, p.y-14);
        ctx.lineTo(p.x+6, p.y-22);
        ctx.lineTo(p.x+10, p.y-14);
        ctx.closePath();
        ctx.fill();
      }
    }
    // name
    ctx.fillStyle = "#eaf0ff";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(p.name, p.x, p.y+24);
  });

  // you marker
  if (me){
    ctx.strokeStyle = "#3b82f6";
    ctx.beginPath(); ctx.arc(me.x, me.y, 16, 0, Math.PI*2); ctx.stroke();
  }
}

function roundRect(ctx, x, y, w, h, r, fill, stroke){
  if (w<2*r) r=w/2; if (h<2*r) r=h/2;
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y,   x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x,   y+h, r);
  ctx.arcTo(x,   y+h, x,   y,   r);
  ctx.arcTo(x,   y,   x+w, y,   r);
  if (fill) ctx.fill(); if (stroke) ctx.stroke();
}

// ===== UI =====
joinBtn.addEventListener("click", ()=>{
  const name = nameInput.value.trim() || "Player";
  const room = (roomInput.value.trim() || "").toUpperCase();
  if (!room) return alert("Enter room code");
  doJoin(room, name);
});
createBtn.addEventListener("click", ()=>{
  const name = nameInput.value.trim() || "Player";
  const code = genCode();
  roomInput.value = code;
  doJoin(code, name);
});
startBtn.addEventListener("click", ()=> socket.emit("game:start"));
sendBtn.addEventListener("click", ()=>{
  const t = chatInput.value.trim(); if (!t) return;
  socket.emit("chat:message", t); chatInput.value = "";
});
chatInput.addEventListener("keydown", (e)=>{ if (e.key==="Enter") sendBtn.click(); });

copyBtn.addEventListener("click", async ()=>{
  if (!currentRoom) return;
  const url = new URL(location.href); url.searchParams.set("room", currentRoom);
  try { await navigator.clipboard.writeText(url.toString()); copyBtn.textContent="Copied!"; setTimeout(()=>copyBtn.textContent="Copy Invite",1000); } catch {}
});

function doJoin(room, name){
  currentRoom = room;
  roomLabel.textContent = "Room: "+room;
  const url = new URL(location.href); url.searchParams.set("room", room); history.replaceState({}, "", url.toString());
  lobbyCard.classList.add("hidden");
  panelCard.classList.remove("hidden");
  socket.emit("room:join", { roomCode: room, name });
}

function genCode(){
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let s=""; for (let i=0;i<4;i++) s+=chars[Math.floor(Math.random()*chars.length)]; return s;
}

// ===== Boot =====
connect();
function initMeFollow(){ if (me){ target.x=me.x; target.y=me.y; step(); } else setTimeout(initMeFollow, 200); }
initMeFollow();
// Auto room
const prm = new URLSearchParams(location.search); const rr = (prm.get("room")||"").toUpperCase();
if (rr){ roomInput.value = rr; }
