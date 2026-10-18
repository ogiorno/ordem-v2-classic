// Rodar: npm test. Origens: o que cada uma concede, sincronia com o texto do livro e remoção na troca (docs/spec-origens-ui.md).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { originGrantsView, originLoss, originRemovalPlan, originSwapHtml, powerSummary } from "../../module/helpers/origin-grants.mjs";
import { makeEntry, originPlan } from "../../module/helpers/skill-training-rules.mjs";
import { SKILL_NAMES, passiveRuleFor } from "../../module/helpers/passive-effects-rules.mjs";
import { normalizeName, stripHtml } from "../../module/helpers/level-progression-rules.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const walk = (dir, out = []) => {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p, out);
		else if (e.name.endsWith(".json")) out.push(p);
	}
	return out;
};
const docs = (sub) => walk(path.join(ROOT, "packs/_source", sub)).map((f) => JSON.parse(fs.readFileSync(f, "utf8"))).filter((d) => d.name && d.type);

const origins = docs("origins").filter((d) => d.type === "origin");
const powers = docs("originPowers").filter((d) => d.type === "ability").map((p) => ({ name: p.name, description: p.system.description }));
const bySkillName = Object.fromEntries(Object.entries(SKILL_NAMES).map(([k, v]) => [normalizeName(v), k]));
const view = (name) => {
	const o = origins.find((x) => x.name === name);
	return originGrantsView({ name: o.name, description: o.system.description }, powers);
};

/** Perícias que a descrição da origem declara ("Perícias Treinadas. Pontaria e Tática."), como chaves. */
function declaredSkills(description) {
	const text = stripHtml(description).replace(/\s+/g, " ");
	const m = text.match(/Per[ií]cias Treinadas\s*\.\s*([^.]*)\./i);
	if (!m) return null;
	return m[1].split(/,| e /).map((s) => normalizeName(s)).filter(Boolean).map((n) => bySkillName[n] ?? (n.startsWith("profissao") ? "profession" : n));
}

describe("origens do compêndio: cobertura", () => {
	it("encontra as 57 origens (26 do livro, 20 do Sobrevivendo ao Horror e 11 de Arquivos Secretos)", () => {
		assert.equal(origins.length, 57);
	});

	for (const origin of origins) {
		describe(origin.name, () => {
			it("tem perícias cadastradas na regra", () => {
				const plan = originPlan(origin.name);
				assert.ok(plan, "sem regra de treinamento");
				assert.equal(plan.pending, false);
			});

			it("a regra bate com o texto 'Perícias Treinadas' da descrição", () => {
				const declared = declaredSkills(origin.system.description);
				const plan = originPlan(origin.name);
				assert.ok(plan && !plan.pending, "sem regra");
				if (plan.chooseOptions) return assert.ok(declared.includes("occultism") && plan.fixed.includes("occultism"), "Ferido por Ritual: Ocultismo fixo");
				if (!declared) return assert.ok(plan.choose, "descrição sem 'Perícias Treinadas' e sem escolha");
				if (origin.name === "Amnésico") return; // o livro diz "à escolha do Mestre"; a mesa decidiu que o jogador escolhe
				const fixed = [...plan.fixed, ...plan.professions.map(() => "profession")];
				for (const key of declared) {
					if (key === "profession") assert.ok(plan.professions.length, "descrição cita Profissão");
					else assert.ok(fixed.includes(key) || plan.choose, `${key} está na descrição mas não na regra`);
				}
				for (const key of plan.fixed) assert.ok(declared.includes(key), `${key} está na regra mas não na descrição`);
			});

			it("a tela mostra perícias, poder e links para o Grimório", () => {
				const v = view(origin.name);
				assert.equal(v.status, "ready");
				assert.ok(v.lines.length > 0);
				for (const s of v.skills) {
					assert.ok(SKILL_NAMES[s.key], `perícia ${s.key} sem nome`);
					assert.deepEqual(s.link, { kind: "skill", name: s.label });
				}
				const total = v.skills.length + v.professions.length + v.choose;
				assert.equal(total, 2, `${origin.name}: esperava 2 perícias, veio ${total}`);
				if (v.power) {
					assert.ok(v.power.summary.length > 10, "poder sem resumo");
					assert.deepEqual(v.power.link, { kind: "power", name: v.power.name });
					assert.ok(v.lines.some((l) => l.includes(`Habilidade: ${v.power.name}`)));
				}
			});
		});
	}
});

describe("origens: poderes", () => {
	it("toda origem (exceto Amnésico) acha o seu poder", () => {
		const missing = origins.filter((o) => o.name !== "Amnésico" && !view(o.name).power).map((o) => o.name);
		assert.deepEqual(missing, [], `sem poder: ${missing.join(", ")}`);
	});
	it("nenhum poder de origem do compêndio fica órfão", () => {
		const claimed = new Set(origins.map((o) => view(o.name).power?.name).filter(Boolean));
		const orphans = powers.map((p) => p.name).filter((n) => !claimed.has(n) && n !== "110%");
		assert.deepEqual(orphans, [], `poderes sem origem: ${orphans.join(", ")}`);
	});
	it("Militar: Pontaria, Tática e Para Bellum", () => {
		const v = view("Militar");
		assert.deepEqual(v.skills.map((s) => s.label), ["Pontaria", "Tática"]);
		assert.equal(v.power.name, "Para Bellum");
	});
	it("Engenheiro, Operário e Chef: Profissão e poder por apelido", () => {
		assert.equal(view("Engenheiro").power.name, "Ferramentas Favoritas");
		assert.equal(view("Operário").power.name, "Ferramentas de Trabalho");
		assert.ok(view("Engenheiro").professions[0].label.includes("escolhe"));
		assert.ok(view("Chef").professions[0].label.includes("cozinheiro"));
	});
	it("Amnésico: o próprio jogador escolhe as duas perícias", () => {
		const v = view("Amnésico");
		assert.equal(v.choose, 2);
		assert.ok(v.lines.some((l) => l.includes("Você escolhe 2")));
		assert.ok(!v.lines.some((l) => /mestre/i.test(l)));
	});
	it("Profetizado: Vontade e mais uma à escolha do jogador", () => {
		const v = view("Profetizado");
		assert.deepEqual(v.skills.map((s) => s.label), ["Vontade"]);
		assert.equal(v.choose, 1);
	});
});

describe("origens: buffs de ficha", () => {
	it("todo poder de origem com efeito automático aparece como buff na tela da sua origem", () => {
		let seen = 0;
		for (const p of powers) {
			const rule = passiveRuleFor(p.name);
			if (!rule?.changes.length) continue;
			seen++;
			const o = origins.find((x) => view(x.name).power?.name === p.name);
			assert.ok(o, `${p.name} não pertence a nenhuma origem`);
			assert.ok(view(o.name).lines.some((l) => l.startsWith("Buff automático:")), `${o.name} não mostra o buff de ${p.name}`);
		}
		assert.ok(seen >= 6, `esperava pelo menos 6 buffs de poder de origem, vieram ${seen}`);
	});
	it("poder sem buff automático explica o motivo", () => {
		const v = view("Executivo");
		assert.ok(v.power);
		assert.ok(v.power.buffs.length > 0 || v.power.manual || passiveRuleFor(v.power.name) === null);
	});
	it("resumo do poder corta em palavra inteira", () => {
		const s = powerSummary(`<p>${"palavra ".repeat(60)}</p>`, 50);
		assert.ok(s.endsWith("…") && s.length <= 52);
	});
});

describe("troca de origem: o que sai da ficha", () => {
	const items = [
		{ id: "p1", granted: { source: "oldOrigin", kind: "origin" } },
		{ id: "p2", granted: { source: "pathX", kind: "path" } },
		{ id: "p3", granted: null },
	];
	const entries = [
		{ id: "e1", sourceItem: "oldOrigin", skill: "aim" }, { id: "e2", sourceItem: "oldOrigin", skill: "tactics" },
		{ id: "e3", sourceItem: "cls", skill: "fighting" }, { id: "e4", sourceItem: null, skill: "arts" },
	];
	it("remove o poder e as perícias dados pela origem antiga e nada mais", () => {
		assert.deepEqual(originRemovalPlan("oldOrigin", items, entries), { itemIds: ["p1"], entryIds: ["e1", "e2"] });
	});
	it("origem sem concessões não remove nada", () => {
		assert.deepEqual(originRemovalPlan("other", items, entries), { itemIds: [], entryIds: [] });
	});
});

describe("troca de origem: confirmação do que se perde", () => {
	const origin = { id: "o1" };
	const entry = (skill, source, sourceItem, extra = {}) => ({ ...makeEntry({ skill, kind: "train", source, sourceItem, ...extra }) });
	const items = [{ id: "p1", name: "Para Bellum", granted: { source: "o1", kind: "origin" } }, { id: "p2", name: "Ataque Especial", granted: { source: "c1", kind: "class" } }];
	it("lista as perícias que só a origem treinava e o poder que ela deu", () => {
		const entries = [entry("aim", "origin", "o1"), entry("tactics", "origin", "o1")];
		assert.deepEqual(originLoss(origin.id, items, entries), { powers: ["Para Bellum"], skills: ["Pontaria", "Tática"] });
	});
	it("perícia que outra fonte também treina continua treinada e não é listada", () => {
		const entries = [entry("aim", "origin", "o1"), entry("tactics", "origin", "o1"), entry("aim", "class", "c1")];
		assert.deepEqual(originLoss(origin.id, items, entries).skills, ["Tática"]);
	});
	it("Profissão da origem aparece pelo nome", () => {
		const entries = [entry("profession:cozinheiro", "origin", "o1")];
		assert.deepEqual(originLoss(origin.id, [], entries).skills, ["Profissão (cozinheiro)"]);
	});
	it("origem sem nada concedido: texto diz que não perde nada", () => {
		const html = originSwapHtml({ existing: "Amnésico", replacement: "Militar", loss: originLoss("x", [], []), gain: view("Militar") });
		assert.match(html, /Nada \(a origem antiga/);
		assert.match(html, /Habilidade: Para Bellum/);
		assert.match(html, /Perícias: Pontaria, Tática/);
	});
	it("texto da confirmação traz perde e ganha, e escapa HTML do nome", () => {
		const html = originSwapHtml({ existing: "<b>X</b>", replacement: "Militar", loss: { powers: ["Para Bellum"], skills: ["Pontaria"] }, gain: view("Profetizado") });
		assert.match(html, /Você perde/);
		assert.match(html, /Perícia treinada: Pontaria/);
		assert.match(html, /Habilidade: Para Bellum/);
		assert.match(html, /1 perícia à sua escolha/);
		assert.ok(!html.includes("<b>X</b>"));
	});
	it("a confirmação funciona para todas as 57 origens como destino", () => {
		for (const o of origins) {
			const html = originSwapHtml({ existing: "A", replacement: o.name, loss: { powers: [], skills: [] }, gain: view(o.name) });
			assert.match(html, /Você ganha/, o.name);
		}
	});
});
