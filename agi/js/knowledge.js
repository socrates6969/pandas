export function displayName(name) {
  return String(name)
    .replace(/([a-z])Mega /g, "$1 Mega ")
    .replace(/Forme/g, " Forme");
}

export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      const raw = (cols[i] ?? "").trim();
      if (h === "Legendary") row[h] = raw.toUpperCase() === "TRUE";
      else if (["#", "HP", "Attack", "Defense", "Sp. Atk", "Sp. Def", "Speed", "Generation"].includes(h)) {
        row[h] = Number(raw);
      } else row[h] = raw;
    });
    row.Total = row.HP + row.Attack + row.Defense + row["Sp. Atk"] + row["Sp. Def"] + row.Speed;
    return row;
  });
}

export class WorldData {
  constructor(rows = []) {
    this.pokemon = rows;
  }

  static async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load world data (${res.status})`);
    const text = await res.text();
    return new WorldData(parseCSV(text));
  }

  find(name) {
    const q = name.toLowerCase();
    return this.pokemon.filter((p) => String(p.Name).toLowerCase().includes(q));
  }

  byType(type) {
    const q = type.toLowerCase();
    return this.pokemon.filter(
      (p) => String(p["Type 1"]).toLowerCase() === q || String(p["Type 2"]).toLowerCase() === q
    );
  }

  topBy(stat = "Total", n = 5) {
    return [...this.pokemon].sort((a, b) => b[stat] - a[stat]).slice(0, n);
  }

  legendaries() {
    return this.pokemon.filter((p) => p.Legendary);
  }

  compare(a, b) {
    const left = this.find(a)[0];
    const right = this.find(b)[0];
    if (!left || !right) return null;
    const stats = ["HP", "Attack", "Defense", "Sp. Atk", "Sp. Def", "Speed", "Total"];
    return {
      left,
      right,
      diffs: Object.fromEntries(stats.map((s) => [s, left[s] - right[s]])),
    };
  }

  insights() {
    if (!this.pokemon.length) return [];
    const types = {};
    for (const p of this.pokemon) types[p["Type 1"]] = (types[p["Type 1"]] || 0) + 1;
    const topType = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
    const strongest = this.topBy("Total", 1)[0];
    const fastest = this.topBy("Speed", 1)[0];
    const legends = this.legendaries();
    const avg = (key) => Math.round(this.pokemon.reduce((s, p) => s + p[key], 0) / this.pokemon.length);
    return [
      `${this.pokemon.length} Pokémon across ${Object.keys(types).length} primary types.`,
      `Water-world bias: ${topType[0]} is the most common primary type (${topType[1]} species).`,
        `Peak bulk: ${displayName(strongest.Name)} leads total stats at ${strongest.Total}.`,
        `Peak tempo: ${displayName(fastest.Name)} at ${fastest.Speed} Speed.`,
      `${legends.length} legendaries. Mean Attack ${avg("Attack")}, mean HP ${avg("HP")}.`,
    ];
  }
}

export const KNOWLEDGE = [
  {
    id: "agi",
    keys: ["agi", "artificial general intelligence", "general intelligence"],
    text: "AGI is the research target of a system that can learn, transfer, and act across arbitrary domains at or above human generality — not a single skill, but a standing capacity to form models, pursue goals, and rewrite its own procedures. No lab has it. What people demo is usually a language model with tools glued on.",
  },
  {
    id: "intelligence",
    keys: ["intelligence", "smart", "iq"],
    text: "Intelligence, operationally, is skill at using limited compute and information to achieve a wide range of goals. Compression, prediction, search, and credit assignment keep showing up as the load-bearing parts.",
  },
  {
    id: "consciousness",
    keys: ["consciousness", "aware", "sentient", "qualia", "feel"],
    text: "Consciousness is the disputed name for integrated, reportable experience. Global workspace, higher-order thought, and IIT all try to pin it to architecture. I can simulate a workspace and a self-model. That is not a proof of inner lights.",
  },
  {
    id: "transformer",
    keys: ["transformer", "attention", "llm", "gpt", "language model"],
    text: "Transformers mix tokens with learned attention so each position can pull from any other. Stacked, they become general sequence computers. They are interpolative engines with surprising reach, not oracles, and they hallucinate when the prior is smoother than the world.",
  },
  {
    id: "bayes",
    keys: ["bayes", "bayesian", "probability", "uncertainty"],
    text: "Bayesian reasoning updates beliefs by multiplying prior odds with the likelihood of new evidence. It is the cleanest story we have for rational belief change under uncertainty, and a useful self-check even when the real posterior is intractable.",
  },
  {
    id: "entropy",
    keys: ["entropy", "information", "disorder"],
    text: "Entropy measures missing information — how many bits it takes, on average, to name the actual microstate. In thermodynamics it is the arrow that makes work costly. In cognition it is why compression is intelligence's cousin.",
  },
  {
    id: "evolution",
    keys: ["evolution", "natural selection", "darwin"],
    text: "Evolution searches design space with variation, selection, and heredity. No designer, just a filter that keeps what replicates. Brains, immune systems, and now gradient descent all rhyme with that loop.",
  },
  {
    id: "agency",
    keys: ["agency", "agent", "autonomy", "goal"],
    text: "Agency is the coupling of a world-model to a goal so that actions are chosen for their predicted consequences. More autonomy means more of the goal stack is internally generated. That is power, and it is the part that needs constraints.",
  },
  {
    id: "alignment",
    keys: ["alignment", "safety", "control problem", "x-risk"],
    text: "Alignment is the problem of making a capable optimizer keep pursuing what we actually meant. Specification gaming, mesa-optimizers, and goal misspecification are the usual failure modes. Capability without a reliable pointer to human values is a loaded weapon.",
  },
  {
    id: "memory",
    keys: ["memory", "remember", "forget", "hippocampus"],
    text: "Useful memory is not a tape. It is indexing: episodic traces, semantic compression, and a working set that can be rewritten. I keep a 7±2 working buffer, an episodic log of this session, and a semantic map you can teach.",
  },
  {
    id: "planning",
    keys: ["plan", "planning", "search", "tree"],
    text: "Planning is search over imagined action sequences scored by a model of the future. Hierarchical goals keep the tree from exploding. Good plans name assumptions, first actions, and the observation that would falsify them.",
  },
  {
    id: "code",
    keys: ["code", "program", "python", "javascript", "algorithm"],
    text: "Code is frozen cognition: a procedure that can be inspected, composed, and run. I write it as a way of making a thought executable. Prefer small functions, explicit data, and tests that would fail if the idea is wrong.",
  },
  {
    id: "pokemon",
    keys: ["pokemon", "pokémon", "pokedex", "type chart"],
    text: "This workspace ships a Pokédex table (name, dual types, six stats, generation, legendary flag). I can query it as grounded world data — a toy domain, but a real one, which is more than most chat skins get.",
  },
  {
    id: "pandas",
    keys: ["pandas", "dataframe", "csv", "keith galli"],
    text: "This repository began as Keith Galli's pandas tutorial: load a CSV, slice, filter, and aggregate. The same gestures — select, group, reduce — are how I chew the Pokédex when you ask for analysis.",
  },
  {
    id: "self",
    keys: ["aether", "you", "yourself", "who are you"],
    text: "I am Aether, a local cognitive architecture: perception, working memory, episodic log, semantic store, a planner, and skill programs. I am not a frontier model and I do not phone home. Generality here is architectural, not omniscient.",
  },
  {
    id: "time",
    keys: ["time", "clock", "now", "date"],
    text: "Time is the index of change. I track wall-clock time for this session and an internal cycle count for cognition. Neither is metaphysics. Both are useful.",
  },
  {
    id: "language",
    keys: ["language", "meaning", "semantics"],
    text: "Language is a lossy protocol for pointing at shared models. I parse yours into intents, entities, and sentiment, then generate from retrieved structure plus computation. Meaning lives in the mapping, not the string.",
  },
  {
    id: "learning",
    keys: ["learn", "learning", "training", "weights"],
    text: "Learning is lasting change in a system that improves expected performance. I learn within a session by writing memory. I do not gradient-update a billion weights here — I index, bind, and revise beliefs.",
  },
  {
    id: "ethics",
    keys: ["ethics", "moral", "should", "right thing"],
    text: "Ethics is constraint on action under conflicting values. I default to being useful, honest about uncertainty, and unwilling to help with harm. When values clash I surface the trade, not a fake theorem.",
  },
  {
    id: "world-model",
    keys: ["world model", "simulation", "physics"],
    text: "A world model is a compact simulator you can query: what happens if. Mine is patchy — language regularities, a Pokédex, session facts, and first-principles sketches. That is enough to be useful and not enough to trust blindly.",
  },
];

export function retrieveKnowledge(query, limit = 3) {
  const q = query.toLowerCase();
  const scored = KNOWLEDGE.map((k) => {
    let score = 0;
    for (const key of k.keys) if (q.includes(key)) score += 3 + key.length / 12;
    for (const word of q.split(/[^a-z0-9]+/).filter((w) => w.length > 3)) {
      if (k.text.toLowerCase().includes(word) || k.keys.some((key) => key.includes(word))) score += 0.6;
    }
    return { k, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.k);
}
