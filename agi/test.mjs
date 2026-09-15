import { Aether, classifyIntent, evalMath, perceive } from "./js/aether.js";
import { parseCSV, retrieveKnowledge, WorldData } from "./js/knowledge.js";
import { extractTeachable, skillMath } from "./js/skills.js";
import { readFileSync } from "node:fs";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const math = skillMath(perceive("what is 12 * 11 + sqrt(49)"));
assert(math.text.includes("139"), `math should be 139, got ${math.text}`);

assert(evalMath("2**10") === 1024, "pow");
assert(classifyIntent("who are you").id === "identity", "identity intent");
assert(classifyIntent("analyze the pokemon data").id === "data", "data intent");
assert(perceive("I love this").sentiment > 0, "sentiment");

const facts = extractTeachable("Remember my name is Sam and I like type systems.");
assert(facts.some(([k, v]) => k === "user.name" && v === "Sam"), "name bind");

const csv = readFileSync(new URL("../pokemon_data.csv", import.meta.url), "utf8");
const world = new WorldData(parseCSV(csv));
assert(world.pokemon.length > 700, "pokedex size");
assert(world.find("Pikachu")[0].Speed === 90, "pikachu speed");
assert(world.insights().length >= 4, "insights");

const hits = retrieveKnowledge("what is artificial general intelligence");
assert(hits[0].id === "agi", "knowledge ranking");

const mind = new Aether({ world, now: () => 1_700_000_000_000 });
const greet = await mind.cycle("hello");
assert(greet.action.kind === "greet", "greet route");

const id = await mind.cycle("who are you");
assert(/Aether/i.test(id.action.text), "self name");

await mind.cycle("Remember my name is Sam and I like type systems.");
const recall = await mind.cycle("what is my name");
assert(/Sam/.test(recall.action.text), "recall name");

const plan = await mind.cycle("plan a research agenda for AGI alignment");
assert(plan.action.kind === "plan" && /Goal/.test(plan.action.text), "plan");

const data = await mind.cycle("analyze the pokemon data");
assert(data.action.kind === "data", "data skill");
assert(/Pokémon|Pokemon/i.test(data.action.text) || /species/.test(data.action.text), "data content");

const pikachu = await mind.cycle("tell me about Pikachu");
assert(/Pikachu/.test(pikachu.action.text), "species lookup");

console.log("aether tests: ok");
