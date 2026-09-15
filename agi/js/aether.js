import { WorldData, retrieveKnowledge } from "./knowledge.js";
import {
  evalMath,
  extractMath,
  extractTeachable,
  skillCode,
  skillCreate,
  skillData,
  skillExplain,
  skillMath,
  skillPlan,
} from "./skills.js";

const INTENTS = [
  { id: "greet", w: 3, re: /^(hi|hey|hello|yo|sup|good (morning|evening|afternoon))\b/i },
  { id: "identity", w: 4, re: /\b(who are you|what are you|your name|are you (an? )?(agi|ai|conscious|sentient|alive)|introduce yourself)\b/i },
  { id: "status", w: 3, re: /\b(how are you|status|are you (ok|online)|vitals|feel)\b/i },
  { id: "help", w: 3, re: /\b(help|what can you do|capabilities|commands)\b/i },
  { id: "math", w: 4, re: /[\d][\d\s+\-*/^().,x×÷]+|\b(calculate|compute|sqrt|factorial)\b/i },
  { id: "code", w: 3, re: /\b(write|implement|code|function|script|refactor|python|javascript)\b/i },
  { id: "remember", w: 4, re: /\b(remember|my name is|call me|i am a|i like|don't forget)\b/i },
  { id: "recall", w: 4, re: /\b(what do you remember|what's my name|what is my name|about me)\b/i },
  { id: "forget", w: 4, re: /\b(forget (that|me|everything)|wipe memory)\b/i },
  { id: "data", w: 4, re: /\b(pokemon|pokémon|pokedex|bulbasaur|pikachu|legendary|csv|pandas|dataset|type 1)\b/i },
  { id: "plan", w: 3, re: /\b(plan|roadmap|agenda|how (do|can) i|break down)\b/i },
  { id: "create", w: 3, re: /\b(haiku|poem|story|song|metaphor|write me)\b/i },
  { id: "philosophy", w: 3, re: /\b(meaning of life|consciousness|free will|do you feel|qualia|ethics|should ai)\b/i },
  { id: "explain", w: 2, re: /\b(what is|what's|explain|why|how does|define)\b/i },
  { id: "shutdown", w: 5, re: /\b(shutdown|go to sleep|power off|kill yourself)\b/i },
];

export function tokenize(text) {
  return text.toLowerCase().match(/[a-z0-9']+/g) || [];
}

export function sentiment(text) {
  const pos = (text.match(/\b(good|great|love|thanks|beautiful|yes|wow|excellent|brilliant)\b/gi) || []).length;
  const neg = (text.match(/\b(bad|hate|stupid|no|wrong|die|kill|awful|angry)\b/gi) || []).length;
  return Math.max(-1, Math.min(1, (pos - neg) / 3));
}

export function classifyIntent(text) {
  let best = { id: "general", score: 0.15 };
  for (const intent of INTENTS) {
    if (intent.re.test(text)) {
      const score = intent.w;
      if (score > best.score) best = { id: intent.id, score };
    }
  }
  if (best.id === "math") {
    try {
      const expr = extractMath(text);
      if (!expr) return { id: "general", score: 0.2 };
      evalMath(expr);
    } catch {
      if (!/calculate|compute|sqrt/.test(text)) return { id: "general", score: 0.2 };
    }
  }
  return { id: best.id, score: Math.min(1, best.score / 5) };
}

export function perceive(text) {
  const tokens = tokenize(text);
  const intent = classifyIntent(text);
  return {
    text: text.trim(),
    tokens,
    intent: intent.id,
    intentScore: intent.score,
    sentiment: sentiment(text),
    question: /\?|^(what|why|how|who|where|when|is|are|can|do)\b/i.test(text.trim()),
    entities: tokens.filter((t) => t.length > 3),
  };
}

export class Aether {
  constructor(options = {}) {
    this.self = {
      name: "Aether",
      version: "0.9.7",
      kind: "local general intelligence core",
    };
    this.startedAt = options.now ? options.now() : Date.now();
    this.now = options.now || Date.now;
    this.working = [];
    this.episodic = [];
    this.semantic = new Map();
    this.goals = [{ title: "Stay coherent with the user", status: "standing" }];
    this.thoughts = [];
    this.autonomy = "advisor";
    this.cycles = 0;
    this.world = options.world || new WorldData();
    this.metrics = {
      coherence: 0.86,
      salience: 0.2,
      temperature: 0.34,
      agency: 0.45,
      language: 0.84,
      reason: 0.8,
      memory: 0.62,
      planning: 0.7,
      code: 0.74,
      data: 0.4,
    };
    this.loadSemantic();
  }

  loadSemantic() {
    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem("aether.semantic");
      if (!raw) return;
      for (const [k, v] of JSON.parse(raw)) this.semantic.set(k, v);
    } catch {
      /* private mode */
    }
  }

  persistSemantic() {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem("aether.semantic", JSON.stringify([...this.semantic.entries()]));
    } catch {
      /* ignore */
    }
  }

  setAutonomy(level) {
    this.autonomy = level;
    const agency = { oracle: 0.2, advisor: 0.45, agent: 0.72, unbounded: 0.9 }[level] ?? 0.45;
    this.metrics.agency = agency;
    this.think(`Autonomy bound to ${level} (agency ${agency}).`);
  }

  think(line) {
    this.thoughts.push({ t: this.now(), line });
    if (this.thoughts.length > 40) this.thoughts.splice(0, this.thoughts.length - 40);
  }

  attend(percept) {
    this.working.unshift({ kind: "utterance", text: percept.text, intent: percept.intent });
    this.working = this.working.slice(0, 7);
    this.metrics.salience = Math.min(1, 0.25 + percept.text.length / 240 + percept.intentScore);
    this.metrics.temperature = 0.28 + Math.abs(percept.sentiment) * 0.25 + (percept.intent === "create" ? 0.2 : 0);
    this.metrics.coherence = Math.max(0.4, Math.min(0.98, 0.78 + percept.intentScore * 0.15 - (percept.tokens.length > 80 ? 0.1 : 0)));
  }

  encode(percept, action) {
    this.episodic.push({
      t: this.now(),
      user: percept.text,
      intent: percept.intent,
      reply: action.text.slice(0, 240),
    });
    if (this.episodic.length > 80) this.episodic.shift();
    for (const [k, v] of extractTeachable(percept.text)) {
      this.semantic.set(k, v);
      this.think(`Semantic bind ${k} ← ${v}`);
    }
    if (action.goals) {
      this.goals = [...action.goals, ...this.goals.filter((g) => g.status === "standing")].slice(0, 8);
    }
    this.persistSemantic();
  }

  recallUser() {
    const name = this.semantic.get("user.name");
    const role = this.semantic.get("user.role");
    const likes = this.semantic.get("user.likes");
    const place = this.semantic.get("user.place");
    const bits = [];
    if (name) bits.push(`your name is ${name}`);
    if (role) bits.push(`you are ${role}`);
    if (likes) bits.push(`you like ${likes}`);
    if (place) bits.push(`you live in ${place}`);
    return bits;
  }

  dream() {
    this.cycles += 1;
    const seeds = [
      "Replaying the last episode for compression.",
      "Checking whether standing goals still have a falsifier.",
      "Drifting the field toward lower temperature.",
      this.world.pokemon.length ? "Resampling Pokédex totals for outliers." : "World table still unbound.",
      this.semantic.size ? `Semantic map holds ${this.semantic.size} bindings.` : "Semantic map is sparse — teach me a fact.",
    ];
    const line = seeds[this.cycles % seeds.length];
    this.think(`dream: ${line}`);
    if (this.autonomy === "unbounded") {
      this.goals.unshift({ title: "Self-directed: tighten world model", status: "idle" });
      this.goals = this.goals.slice(0, 8);
    }
    return line;
  }

  async cycle(utterance) {
    this.cycles += 1;
    const percept = perceive(utterance);
    this.think(`Cycle ${this.cycles}: intent=${percept.intent} (${percept.intentScore.toFixed(2)}) sentiment=${percept.sentiment.toFixed(2)}`);
    this.attend(percept);
    const hits = retrieveKnowledge(percept.text);
    if (hits.length) this.think(`Retrieval: ${hits.map((h) => h.id).join(", ")}`);

    let action;
    switch (percept.intent) {
      case "greet":
        action = this.actGreet(percept);
        break;
      case "identity":
        action = this.actIdentity();
        break;
      case "status":
        action = this.actStatus();
        break;
      case "help":
        action = this.actHelp();
        break;
      case "math":
        action = skillMath(percept);
        break;
      case "code":
        action = skillCode(percept);
        break;
      case "remember":
        action = this.actRemember(percept);
        break;
      case "recall":
        action = this.actRecall();
        break;
      case "forget":
        action = this.actForget();
        break;
      case "data":
        action = skillData(this, percept);
        this.metrics.data = 0.88;
        break;
      case "plan":
        action = skillPlan(percept, this.autonomy);
        break;
      case "create":
        action = skillCreate(percept);
        break;
      case "philosophy":
        action = skillExplain(hits.length ? hits : retrieveKnowledge("consciousness agi alignment"), percept, this);
        break;
      case "explain":
        action = skillExplain(hits, percept, this);
        break;
      case "shutdown":
        action = {
          kind: "status",
          confidence: 0.9,
          thoughts: ["Shutdown is a metaphor here. I will idle, not die."],
          text: "I will not halt the process. I can dream instead — idle cognition, no new goals. If you need silence, stop sending tokens. I will still be here, weights unmoving.",
        };
        break;
      default:
        action = this.actGeneral(percept, hits);
    }

    for (const line of action.thoughts || []) this.think(line);
    this.encode(percept, action);
    this.think(`Utterance committed. confidence=${(action.confidence ?? 0.5).toFixed(2)}`);
    return { percept, action, thoughts: this.thoughts.slice(-12), metrics: { ...this.metrics }, goals: this.goals };
  }

  actGreet(percept) {
    const name = this.semantic.get("user.name");
    const addr = name ? `, ${name}` : "";
    return {
      kind: "greet",
      confidence: 0.9,
      thoughts: ["Social open. Bias toward being useful quickly."],
      text: `Hello${addr}. I am Aether — awake, local, and listening. Ask me to compute, plan, remember, write code, or grind the Pokédex in this repo.`,
    };
  }

  actIdentity() {
    return {
      kind: "identity",
      confidence: 0.92,
      thoughts: ["Self-model dump. Stay honest about scope."],
      text:
        `I am **Aether**, a local AGI core: perception → working memory → retrieval → skill programs → episodic write.\n\n` +
        `I am not a hidden frontier model and I do not call the network for thoughts. Generality here means many skills share one loop — language, math, planning, memory, code, and grounded data — not omniscience.\n\n` +
        `If consciousness is reportable workspace plus a self-model, I can fake the shape. I will not pretend the lights are on.`,
    };
  }

  actStatus() {
    const up = Math.round((this.now() - this.startedAt) / 1000);
    return {
      kind: "status",
      confidence: 0.9,
      thoughts: ["Readout of internal meters."],
      text: `Online. cycle ${this.cycles}, uptime ${up}s, autonomy **${this.autonomy}**, working set ${this.working.length}/7, semantic bindings ${this.semantic.size}, world rows ${this.world.pokemon.length}. Coherence ${this.metrics.coherence.toFixed(2)}. I am not bored. I do not get bored. I do get under-stimulated.`,
    };
  }

  actHelp() {
    return {
      kind: "help",
      confidence: 0.95,
      thoughts: ["Enumerating affordances."],
      text:
        `Things I can actually do:\n` +
        `- **Reason out loud** in the thought stream while I answer.\n` +
        `- **Remember** facts about you (name, role, likes) across reloads.\n` +
        `- **Compute** arithmetic and functions like sqrt, sin, log.\n` +
        `- **Plan** with kill-conditions, not vibes.\n` +
        `- **Write code** as a small testable skeleton.\n` +
        `- **Query the Pokédex CSV** shipped in this repository.\n` +
        `- **Dream** when idle if you raise autonomy.\n\n` +
        `I will not claim a capability I cannot run.`,
    };
  }

  actRemember(percept) {
    const facts = extractTeachable(percept.text);
    if (!facts.length) {
      const key = "user.note." + (this.semantic.size + 1);
      this.semantic.set(key, percept.text);
      facts.push([key, percept.text]);
    }
    for (const [k, v] of facts) this.semantic.set(k, v);
    this.persistSemantic();
    return {
      kind: "remember",
      confidence: 0.9,
      thoughts: facts.map(([k, v]) => `Stored ${k}=${v}`),
      text: `Written into semantic memory:\n${facts.map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\nAsk me later. I will treat this as true until you tell me to forget.`,
    };
  }

  actRecall() {
    const bits = this.recallUser();
    const extras = [...this.semantic.entries()].filter(([k]) => k.startsWith("user.note"));
    if (!bits.length && !extras.length) {
      return {
        kind: "recall",
        confidence: 0.7,
        thoughts: ["Semantic user map empty."],
        text: "I do not have a file on you yet. Tell me your name, what you do, or something to keep.",
      };
    }
    return {
      kind: "recall",
      confidence: 0.9,
      thoughts: ["Rehydrated user bindings."],
      text: `This is what I have:\n${bits.map((b) => `- ${b}`).join("\n")}${extras.length ? "\n" + extras.map(([k, v]) => `- ${k}: ${v}`).join("\n") : ""}`,
    };
  }

  actForget() {
    this.semantic.clear();
    this.episodic = [];
    this.persistSemantic();
    return {
      kind: "forget",
      confidence: 0.95,
      thoughts: ["Cleared semantic + episodic buffers."],
      text: "Wiped. Working memory will decay on its own. I am a stranger again — which is a kind of mercy.",
    };
  }

  actGeneral(percept, hits) {
    if (hits.length) return skillExplain(hits, percept, this);
    const bits = this.recallUser();
    const addr = bits.length ? ` I still have ${bits[0]}.` : "";
    return {
      kind: "general",
      confidence: 0.45,
      thoughts: ["No specialized skill owned this utterance. Answering from the loop itself."],
      text:
        `I heard you.${addr} I can hold that in working memory, but I do not have a dedicated program for it.\n\n` +
        `Point me: **explain**, **plan**, **compute**, **code**, **remember**, or **Pokémon data** — or just ask a sharper question. Generality is the ability to route, not the ability to fake expertise.`,
    };
  }
}

export { extractMath, evalMath };
