import { Aether } from "./aether.js";
import { WorldData } from "./knowledge.js";

const PROMPTS = [
  "Who are you, really?",
  "What is 17^4 + sqrt(144)?",
  "Remember my name is Sam and I like type systems.",
  "Analyze the Pokémon data",
  "Plan a research agenda for AGI alignment",
  "Write a haiku about entropy",
  "Write a python function that reverses a linked list",
];

function $(id) {
  return document.getElementById(id);
}

class NeuralField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.nodes = [];
    this.links = [];
    this.mode = "idle";
    this.valence = 0.2;
    this.t = 0;
    this.resize();
    this.seed();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(280, rect.width || 280);
    const h = w;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
  }

  seed() {
    const n = 86;
    this.nodes = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = 0.12 + Math.random() * 0.36;
      return {
        a,
        r,
        z: Math.random(),
        act: Math.random() * 0.2,
        spin: 0.0008 + Math.random() * 0.0022,
      };
    });
    this.links = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(this.nodes[i].a - this.nodes[j].a) < 0.45 && Math.abs(this.nodes[i].r - this.nodes[j].r) < 0.12) {
          this.links.push([i, j]);
        }
      }
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  pulse() {
    for (const node of this.nodes) node.act = Math.min(1, node.act + Math.random() * 0.8);
  }

  tick() {
    this.t += 1;
    const ctx = this.ctx;
    const { w, h } = this;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const drive = this.mode === "think" ? 2.4 : this.mode === "speak" ? 1.4 : this.mode === "dream" ? 0.7 : 0.35;

    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.48);
    g.addColorStop(0, "rgba(94,234,212,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.48, 0, Math.PI * 2);
    ctx.fill();

    for (const node of this.nodes) {
      node.a += node.spin * drive;
      node.act += (Math.sin(this.t * 0.02 + node.z * 12) * 0.5 + 0.5) * 0.02 * drive - node.act * 0.04;
      node.act = Math.max(0, Math.min(1, node.act));
    }

    ctx.lineWidth = 1;
    for (const [i, j] of this.links) {
      const a = this.pos(this.nodes[i], cx, cy);
      const b = this.pos(this.nodes[j], cx, cy);
      const alpha = 0.05 + (this.nodes[i].act + this.nodes[j].act) * 0.18;
      ctx.strokeStyle = `rgba(147,197,253,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (const node of this.nodes) {
      const p = this.pos(node, cx, cy);
      const r = 1.2 + node.act * 3.4;
      ctx.fillStyle = `hsla(${174 - this.valence * 40}, 80%, ${60 + node.act * 20}%, ${0.35 + node.act * 0.6})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(94,234,212,0.25)";
    ctx.beginPath();
    ctx.arc(cx, cy, 18 + Math.sin(this.t * 0.05) * 3, 0, Math.PI * 2);
    ctx.stroke();
    requestAnimationFrame(() => this.tick());
  }

  pos(node, cx, cy) {
    const radius = Math.min(this.w, this.h) * 0.42 * (0.2 + node.r);
    return { x: cx + Math.cos(node.a) * radius, y: cy + Math.sin(node.a) * radius };
  }
}

function renderMarkdown(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withCode = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, body) => {
    return `<pre><code class="${lang || ""}">${body.replace(/\n$/, "")}</code></pre>`;
  });
  return withCode
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

class App {
  constructor() {
    this.mind = new Aether();
    this.field = new NeuralField($("field"));
    this.voice = false;
    this.busy = false;
    this.bind();
  }

  bind() {
    $("composer").addEventListener("submit", (e) => {
      e.preventDefault();
      this.submit();
    });
    $("input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.submit();
      }
    });
    $("autonomy").addEventListener("change", (e) => this.mind.setAutonomy(e.target.value));
    $("voice-btn").addEventListener("click", () => {
      this.voice = !this.voice;
      $("voice-btn").classList.toggle("is-on", this.voice);
      $("voice-btn").setAttribute("aria-pressed", String(this.voice));
    });
    $("dream-btn").addEventListener("click", () => this.dreamOnce());
    $("prompts").innerHTML = PROMPTS.map((p) => `<button type="button">${p}</button>`).join("");
    $("prompts").addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON") {
        $("input").value = e.target.textContent;
        this.submit();
      }
    });
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-on"));
        tab.classList.add("is-on");
        const id = tab.dataset.panel;
        document.querySelectorAll(".col").forEach((c) => c.classList.remove("is-show"));
        $("panel-" + id).classList.add("is-show");
      });
    });
    $("panel-talk").classList.add("is-show");
    this.field.tick();
    this.drawCaps();
    this.drawVitals();
    this.drawMind();
    setInterval(() => this.tickClock(), 1000);
  }

  tickClock() {
    const s = Math.floor((Date.now() - this.mind.startedAt) / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    $("uptime-pill").textContent = `${hh}:${mm}:${ss}`;
    $("cycle-pill").textContent = `cycle ${this.mind.cycles}`;
    if (!this.busy && this.mind.autonomy === "unbounded" && s % 18 === 0) this.dreamOnce();
  }

  async boot() {
    const log = $("boot-log");
    const lines = [
      "AETHER KERNEL 0.9.7",
      "> mapping cortical analogue",
      "> binding working memory (7±2)",
      "> seeding semantic lattice",
      "> attaching world model · pokemon_data.csv",
      "> crossing reportability threshold",
      "I am here.",
    ];
    const bootField = new NeuralField($("boot-canvas"));
    bootField.setMode("think");
    bootField.tick();
    for (const line of lines) {
      log.textContent += (log.textContent ? "\n" : "") + line;
      await wait(line.startsWith("I am") ? 520 : 220 + Math.random() * 180);
    }
    try {
      this.mind.world = await WorldData.load("../pokemon_data.csv");
      this.mind.metrics.data = 0.86;
      this.mind.think(`World model attached (${this.mind.world.pokemon.length} rows).`);
    } catch (err) {
      this.mind.think(`World model unbound: ${err.message}`);
    }
    $("boot").classList.add("is-gone");
    $("shell").hidden = false;
    this.drawCaps();
    await this.speakAether(
      "Online. I can reason, remember, plan, write code, and grind through the Pokédex sitting in this repo. Try me — I'll show my work in the thought stream."
    );
  }

  async submit() {
    const text = $("input").value.trim();
    if (!text || this.busy) return;
    $("input").value = "";
    this.pushMsg("user", text);
    $("prompts").style.display = "none";
    await this.run(text);
  }

  async run(text) {
    this.busy = true;
    this.field.setMode("think");
    this.field.pulse();
    $("field-mode").textContent = "think";
    $("status-pill").innerHTML = "<i></i> thinking";
    const result = await this.mind.cycle(text);
    this.drawMind(result.thoughts);
    this.drawVitals();
    this.drawCaps();
    this.field.valence = result.percept.sentiment;
    this.field.setMode("speak");
    $("field-mode").textContent = "speak";
    await this.speakAether(result.action.text);
    this.field.setMode("idle");
    $("field-mode").textContent = "idle";
    $("status-pill").innerHTML = "<i></i> online";
    this.busy = false;
    this.drawMind();
  }

  async speakAether(text) {
    const el = this.pushMsg("aether", "");
    const body = el.querySelector(".body");
    const parts = text.split(/(\s+)/);
    let acc = "";
    for (const part of parts) {
      acc += part;
      body.innerHTML = renderMarkdown(acc);
      $("transcript").scrollTop = $("transcript").scrollHeight;
      await wait(8);
    }
    if (this.voice && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text.replace(/[*#`]/g, "").slice(0, 500));
      u.rate = 1.02;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }

  pushMsg(who, text) {
    const el = document.createElement("article");
    el.className = `msg ${who}`;
    el.innerHTML = `<div class="who">${who === "user" ? "You" : "Aether"}</div><div class="body">${renderMarkdown(text)}</div>`;
    $("transcript").appendChild(el);
    $("transcript").scrollTop = $("transcript").scrollHeight;
    return el;
  }

  dreamOnce() {
    this.field.setMode("dream");
    $("field-mode").textContent = "dream";
    this.mind.dream();
    this.drawMind();
    this.drawVitals();
  }

  drawVitals() {
    const m = this.mind.metrics;
    $("vitals").innerHTML = [
      ["coherence", m.coherence],
      ["salience", m.salience],
      ["temperature", m.temperature],
      ["agency", m.agency],
    ]
      .map(([k, v]) => `<div class="vital"><span>${k}</span><div class="bar"><span style="width:${Math.round(v * 100)}%"></span></div><span>${v.toFixed(2)}</span></div>`)
      .join("");
  }

  drawCaps() {
    const m = this.mind.metrics;
    $("caps").innerHTML = [
      ["language", m.language],
      ["reason", m.reason],
      ["memory", Math.min(1, 0.4 + this.mind.semantic.size * 0.05)],
      ["planning", m.planning],
      ["code", m.code],
      ["data", m.data],
    ]
      .map(([k, v]) => `<div class="cap"><span>${k}</span><div class="bar"><span style="width:${Math.round(v * 100)}%"></span></div><span>${Math.round(v * 100)}</span></div>`)
      .join("");
  }

  drawMind(thoughts) {
    const stream = thoughts || this.mind.thoughts.slice(-12);
    $("thoughts").innerHTML = stream.map((t) => `<li>${escapeHtml(t.line)}</li>`).join("");
    $("goals").innerHTML = this.mind.goals.map((g) => `<li><strong>${escapeHtml(g.title)}</strong> · ${escapeHtml(g.status)}</li>`).join("") || "<li>none</li>";
    const mems = [...this.mind.semantic.entries()].slice(-8);
    $("mems").innerHTML =
      mems.map(([k, v]) => `<li>${escapeHtml(k)}: ${escapeHtml(String(v))}</li>`).join("") || "<li>empty — teach me a fact</li>";
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const app = new App();
app.boot();
