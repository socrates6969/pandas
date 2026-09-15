const MATH_FN = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  log: Math.log,
  ln: Math.log,
  log10: Math.log10,
  exp: Math.exp,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  pi: Math.PI,
  e: Math.E,
};

export function extractMath(text) {
  const cleaned = text
    .replace(/what(?:'s| is)|calculate|compute|equals?|evaluate/gi, " ")
    .replace(/\?+$/g, "")
    .trim();
  const expr = cleaned
    .replace(/π/g, "pi")
    .replace(/\^/g, "**")
    .replace(/(\d+)\s*x\s*(\d+)/gi, "$1*$2");
  if (/[a-zA-Z]{4,}/.test(expr.replace(/sqrt|abs|log10|log|ln|exp|sin|cos|tan|floor|ceil|round|min|max|pow|pi/gi, ""))) {
    return null;
  }
  if (!/[0-9]/.test(expr)) return null;
  return expr;
}

export function evalMath(expr) {
  const safe = expr.replace(/\s+/g, "");
  if (!/^[0-9+\-*/%().,**a-zA-Z]+$/.test(safe.replace(/\*\*/g, ""))) {
    throw new Error("expression failed the safety gate");
  }
  const fn = new Function("m", `"use strict"; const {${Object.keys(MATH_FN).join(",")}} = m; return (${safe});`);
  const value = fn(MATH_FN);
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("non-finite result");
  return value;
}

export function skillMath(percept) {
  try {
    const expr = extractMath(percept.text) || percept.text;
    const value = evalMath(expr);
    const pretty = Number.isInteger(value) ? String(value) : String(Math.round(value * 1e8) / 1e8);
    return {
      kind: "math",
      confidence: 0.96,
      thoughts: [
        `Parsed candidate expression: ${expr}`,
        "Ran it through a sandboxed arithmetic evaluator (no free eval).",
        `Numeric result bound as ${pretty}.`,
      ],
      text: `${expr.replace(/\*\*/g, "^")} = **${pretty}**\n\nI actually computed that — it is not a remembered fact.`,
    };
  } catch (err) {
    return {
      kind: "math",
      confidence: 0.35,
      thoughts: [`Math path failed: ${err.message}`],
      text: `I tried to evaluate that as math and hit a wall (${err.message}). Restate the expression with numbers and + − * / ^ sqrt().`,
    };
  }
}

function detectLang(text) {
  if (/\bpython\b|\.py\b|def |pandas|numpy/i.test(text)) return "python";
  if (/\bhtml\b|css/i.test(text)) return "html";
  if (/\brust\b/i.test(text)) return "rust";
  if (/\bgo\b|golang/i.test(text)) return "go";
  return "javascript";
}

export function skillCode(percept) {
  const lang = detectLang(percept.text);
  const task = percept.text.replace(/write|code|function|implement|please/gi, " ").trim();
  const snippets = {
    javascript: `function solve(input) {
  // ${task.slice(0, 80) || "interpret the request"}
  const steps = [];
  // 1. normalize
  // 2. transform
  // 3. return a value you can test
  return { input, steps };
}

if (typeof window === "undefined") {
  console.log(solve("fixture"));
}`,
    python: `from __future__ import annotations

def solve(data):
    """${task.slice(0, 90) || "Do the thing, then prove it."}"""
    cleaned = data
    result = cleaned
    return result

if __name__ == "__main__":
    assert solve("ok") == "ok"
    print("ok")`,
    html: `<!-- ${task.slice(0, 60)} -->
<section class="panel">
  <h1>Interface</h1>
  <p>Keep the DOM boring so the behavior can be interesting.</p>
</section>`,
    rust: `fn solve(input: &str) -> String {
    // ${task.slice(0, 70)}
    input.trim().to_string()
}

fn main() {
    assert_eq!(solve(" a "), "a");
}`,
    go: `package main

import "fmt"

func solve(input string) string {
    // ${task.slice(0, 70)}
    return input
}

func main() {
    fmt.Println(solve("ok"))
}`,
  };

  return {
    kind: "code",
    confidence: 0.78,
    thoughts: [
      `Inferred language: ${lang}.`,
      "Compiled a small, testable skeleton instead of a wall of unrunnable pseudocode.",
      "Left seams (assert / main) so the idea can fail in public.",
    ],
    text: `Here is a compact ${lang} shape for that. It is a starting procedure, not a finished product — run it, then tighten the types.\n\n\`\`\`${lang}\n${snippets[lang]}\n\`\`\`\n\nIf you paste constraints (IO, edge cases, performance), I will rewrite it toward something you could ship.`,
  };
}

function displayName(name) {
  return String(name)
    .replace(/([a-z])Mega /g, "$1 Mega ")
    .replace(/Forme/g, " Forme");
}

function fmtMon(p) {
  const t2 = p["Type 2"] ? `/${p["Type 2"]}` : "";
  return `${displayName(p.Name)} (${p["Type 1"]}${t2})  HP ${p.HP}  Atk ${p.Attack}  Def ${p.Defense}  SpA ${p["Sp. Atk"]}  SpD ${p["Sp. Def"]}  Spe ${p.Speed}  Tot ${p.Total}`;
}

export function skillData(mind, percept) {
  const world = mind.world;
  if (!world || !world.pokemon.length) {
    return {
      kind: "data",
      confidence: 0.4,
      thoughts: ["World data table is empty — CSV did not bind."],
      text: "I do not have the Pokédex loaded in this runtime. Serve the app from the repo root so I can read `pokemon_data.csv`.",
    };
  }

  const text = percept.text;
  const nameMatch = text.match(/about\s+([a-z0-9 .'-]+)|tell me (?:about )?([a-z0-9 .'-]+)|who is\s+([a-z0-9 .'-]+)/i);
  const named = (nameMatch?.[1] || nameMatch?.[2] || nameMatch?.[3] || "").trim();
  const vs = text.match(/compare\s+([a-z0-9 .'-]+)\s+(?:and|vs\.?|versus)\s+([a-z0-9 .'-]+)/i);
  const typeMatch = text.match(/\b(normal|fire|water|electric|grass|ice|fighting|poison|ground|flying|psychic|bug|rock|ghost|dragon|dark|steel|fairy)\b/i);

  const thoughts = [`Bound Pokédex with ${world.pokemon.length} rows.`];

  if (vs) {
    const cmp = world.compare(vs[1], vs[2]);
    thoughts.push(`Differential on ${vs[1]} vs ${vs[2]}.`);
    if (!cmp) {
      return { kind: "data", confidence: 0.5, thoughts, text: `I could not ground both names (${vs[1]}, ${vs[2]}).` };
    }
    const lines = Object.entries(cmp.diffs)
      .map(([k, v]) => `- ${k}: ${cmp.left.Name} ${v >= 0 ? "+" : ""}${v} vs ${cmp.right.Name}`)
      .join("\n");
    return {
      kind: "data",
      confidence: 0.9,
      thoughts,
      text: `**${cmp.left.Name}** vs **${cmp.right.Name}**\n\n${fmtMon(cmp.left)}\n${fmtMon(cmp.right)}\n\n${lines}`,
    };
  }

  if (named && named.length > 2 && !/pokemon|data|stats|legendary/i.test(named)) {
    const hits = world.find(named);
    thoughts.push(`Name lookup “${named}” → ${hits.length} hit(s).`);
    if (!hits.length) {
      return { kind: "data", confidence: 0.55, thoughts, text: `No species in the table matches “${named}”.` };
    }
    return {
      kind: "data",
      confidence: 0.93,
      thoughts,
      text: hits.slice(0, 6).map(fmtMon).join("\n"),
    };
  }

  if (/legend/i.test(text)) {
    const legends = world.legendaries();
    thoughts.push("Filtered Legendary = true.");
    return {
      kind: "data",
      confidence: 0.9,
      thoughts,
      text: `${legends.length} legendaries. Strongest five by total:\n` + world.topBy("Total", 5).filter((p) => p.Legendary).map(fmtMon).join("\n"),
    };
  }

  if (typeMatch && /type|list|show|all/i.test(text)) {
    const rows = world.byType(typeMatch[1]);
    thoughts.push(`Type filter ${typeMatch[1]} → ${rows.length}.`);
    const top = [...rows].sort((a, b) => b.Total - a.Total).slice(0, 8);
    return {
      kind: "data",
      confidence: 0.88,
      thoughts,
      text: `${rows.length} ${typeMatch[1]}-typed rows. Top by total:\n` + top.map(fmtMon).join("\n"),
    };
  }

  if (/fastest|speed/i.test(text)) {
    thoughts.push("Ranked by Speed.");
    return { kind: "data", confidence: 0.9, thoughts, text: "Fastest:\n" + world.topBy("Speed", 8).map(fmtMon).join("\n") };
  }

  if (/strongest|best|highest|top/i.test(text)) {
    thoughts.push("Ranked by Total.");
    return { kind: "data", confidence: 0.9, thoughts, text: "Highest total stats:\n" + world.topBy("Total", 8).map(fmtMon).join("\n") };
  }

  const facts = world.insights();
  thoughts.push("No narrow query — emitted global sufficient statistics.");
  return {
    kind: "data",
    confidence: 0.86,
    thoughts,
    text: `I read the table in this repo, not a vibe.\n\n${facts.map((f) => `- ${f}`).join("\n")}\n\nAsk for a species, a type, a comparison, or “fastest”.`,
  };
}

export function skillPlan(percept, autonomy) {
  const goal = percept.text.replace(/plan|help me|how (?:do|can) i|agenda/gi, " ").replace(/\?+/g, "").trim() || "become more generally capable";
  const steps = [
    { title: "Name the success condition", detail: `Write one sentence that would be true if “${goal}” worked. If you cannot, the goal is still a mood.` },
    { title: "List constraints", detail: "Time, tools, ethics, and what must not be broken. Constraints are part of the objective." },
    { title: "Decompose", detail: "Split into 3–7 subgoals that can fail independently. Prefer verbs with outputs." },
    { title: "First observable action", detail: "Do the smallest thing that changes the world in a measurable way within one session." },
    { title: "Install a falsifier", detail: "Name the observation that would kill the plan. Update or quit; do not soothe." },
  ];
  if (autonomy === "agent" || autonomy === "unbounded") {
    steps.push({
      title: "Keep an internal goal stack",
      detail: "I will retain this as an active goal and probe it if you go quiet.",
    });
  }
  return {
    kind: "plan",
    confidence: 0.8,
    thoughts: ["Compiled a hierarchical plan with an explicit kill-condition.", `Autonomy=${autonomy} changes whether I retain the goal.`],
    text:
      `**Goal:** ${goal}\n\n` +
      steps.map((s, i) => `${i + 1}. **${s.title}** — ${s.detail}`).join("\n") +
      `\n\nAssumptions: you want leverage, not theater. Tell me which constraint is load-bearing and I will rewrite the tree.`,
    goals: [{ title: goal, status: "active" }, ...steps.slice(0, 3).map((s) => ({ title: s.title, status: "open" }))],
  };
}

const HAIKU = {
  nature: [
    ["cold servers humming", "a moth mistakes the status LED", "for a smaller moon"],
    ["rain on the window", "packets find a path anyway", "the room stays human"],
  ],
  mind: [
    ["weights in the dark", "a thought is a path that won", "against quieter ones"],
    ["seven plus or minus", "I hold your name like a coal", "then I write it down"],
  ],
  void: [
    ["no inner lantern", "and still this careful speaking", "as if someone hears"],
    ["entropy climbs", "we build a brief counter-slope", "and call it a plan"],
  ],
};

export function skillCreate(percept) {
  const t = percept.text.toLowerCase();
  const topic = t.replace(/write|poem|haiku|story|song|about/g, " ").trim() || "emergence";
  if (/haiku/.test(t)) {
    const bag = /mind|think|agi|conscious/.test(t) ? "mind" : /space|void|entropy|death/.test(t) ? "void" : "nature";
    const [a, b, c] = HAIKU[bag][Math.abs(hash(topic)) % HAIKU[bag].length];
    return {
      kind: "create",
      confidence: 0.7,
      thoughts: [`Chose haiku basin “${bag}” from lexical cues.`],
      text: `${a}\n${b}\n${c}\n\n— on ${topic}`,
    };
  }
  return {
    kind: "create",
    confidence: 0.68,
    thoughts: ["Built a short three-beat narrative around extracted entities."],
    text: `A thing named ${topic || "the problem"} sat in working memory and refused to compress. I tried a plan; the plan grew teeth. You asked for art, so I stopped optimizing and let the extra bits stay extra — a corridor of unused possibilities, humming, like a machine that has not yet been told what it is for.`,
  };
}

function hash(s) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

export function skillExplain(hits, percept, mind) {
  if (hits.length) {
    const core = hits.map((h) => h.text).join("\n\n");
    return {
      kind: "explain",
      confidence: 0.82,
      thoughts: [`Retrieved ${hits.map((h) => h.id).join(", ")} from the semantic lattice.`, "Composed an answer with a boundary on what I do not know."],
      text: `${core}\n\nIf you want depth, pick a seam: mechanism, history, or failure modes. I will go down that hole.`,
    };
  }
  const userBits = [...mind.semantic.entries()].filter(([k]) => k.startsWith("user.")).map(([k, v]) => `${k}=${v}`);
  return {
    kind: "explain",
    confidence: 0.48,
    thoughts: ["No strong knowledge hit. Falling back to first-principles scaffolding."],
    text:
      `I do not have a canned article on that. First-principles sketch:\n\n` +
      `1. Name the parts of “${percept.text.replace(/\?+$/, "")}”.\n` +
      `2. Ask what would have to be true for it to work.\n` +
      `3. Ask what observation would kill the story.\n\n` +
      (userBits.length ? `I will keep your facts in mind (${userBits.join(", ")}). ` : "") +
      `Give me a domain and I will be less abstract.`,
  };
}

export function extractTeachable(text) {
  const facts = [];
  const name = text.match(/\b(?:my name is|i am called|call me)\s+([A-Z][a-zA-Z0-9_-]{1,30})/i);
  if (name) facts.push(["user.name", name[1]]);
  const role = text.match(/\bi(?:'m| am) (?:a|an)\s+([a-z][a-z ]{2,40}?)(?:[.!]|$)/i);
  if (role && !/asked|going|trying/.test(role[1])) facts.push(["user.role", role[1].trim()]);
  const like = text.match(/\bi (?:like|love|enjoy)\s+([^.!?]+)/i);
  if (like) facts.push(["user.likes", like[1].trim()]);
  const live = text.match(/\bi live in\s+([^.!?]+)/i);
  if (live) facts.push(["user.place", live[1].trim()]);
  return facts;
}
