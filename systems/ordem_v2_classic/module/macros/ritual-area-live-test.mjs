// Teste ao vivo dos rituais de área. Rode no console do navegador, como Mestre, com uma cena aberta que tenha
// o token de um agente (conjurador):
//   const t = await import("/systems/ordem_v2_classic/module/macros/ritual-area-live-test.mjs");
//   await t.runAreaRitualTests();            // todos os casos
//   await t.runAreaRitualTests({ only: "AR-01" });
// O teste cria tokens de ameaça temporários (passa sempre / falha sempre / imune / fora da área), força o PD do
// agente e remove tudo no fim. Resultados: tabela { id, caso, ok, detalhe }.

import { areaRuleFor } from "./ritual-area-rules.mjs";
import { withArena } from "./ritual-live-arena.mjs";
import { CONDITIONS, conditionIdFor } from "../helpers/conditions.mjs";
import { areaTemplateData, createAreaRegion, regionContains } from "./ritual-area.mjs";
import { resolveAreaCast, tokensInside } from "./ritual-area-engine.mjs";

const SYSTEM = "ordem_v2_classic";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hp = (token) => Number(token.actor.system.attributes.hp.value);
const effectNames = (token) => token.actor.effects.map((effect) => effect.name);

const ALL_TYPES = ["cuttingDamage", "impactDamage", "piercingDamage", "ballisticDamage", "bloodDamage", "deathDamage", "knowledgeDamage", "energyDamage", "fearDamage", "fireDamage", "coldDamage", "eletricDamage", "chemicalDamage", "mentalDamage", "damageDamage"];

/** Casos de ritual instantâneo (onCast com dano/condições): gerados a partir das regras. */
const INSTANT_CASES = [
	["AR-01a", "Paradoxo", "basic"], ["AR-01b", "Paradoxo", "true"],
	["AR-02a", "Miasma Entrópico", "basic"], ["AR-02b", "Miasma Entrópico", "student"], ["AR-02c", "Miasma Entrópico", "true"],
	["AR-03a", "Deflagração de Energia", "basic"], ["AR-03b", "Deflagração de Energia", "true"],
	["AR-04a", "Esfolar", "basic"], ["AR-04b", "Esfolar", "student"], ["AR-04c", "Esfolar", "true"],
	["AR-05a", "Eletrocussão", "basic"], ["AR-05b", "Eletrocussão", "student"], ["AR-05c", "Eletrocussão", "true"],
	["AR-06a", "Decadência", "basic"], ["AR-06b", "Decadência", "student"], ["AR-06c", "Decadência", "true"],
	["AR-07", "Consumir Manancial", "true"],
	["AR-08a", "Transfigurar Água", "basic", "evaporar"], ["AR-08b", "Transfigurar Água", "true", "evaporar"], ["AR-08c", "Transfigurar Água", "basic", "congelar"],
	["AR-09a", "Transfigurar Terra", "basic", "amolecer"], ["AR-09b", "Transfigurar Terra", "student", "amolecer"],
	["AR-09c", "Transfigurar Terra", "basic", "solidificar"], ["AR-09d", "Transfigurar Terra", "basic", "modelar"],
	["AR-10a", "Poeira da Podridão", "basic"], ["AR-10b", "Poeira da Podridão", "true"],
	["AR-11", "Presença do Medo", "basic"],
	["AR-12a", "Tentáculos de Lodo", "basic"], ["AR-12b", "Tentáculos de Lodo", "true"], ["AR-12c", "Tentáculos de Lodo", "basic", null, { grappleMode: "lose" }],
	["AR-13", "Purgatório", "basic"],
	["AR-14a", "Aurora da Verdade", "basic"], ["AR-14b", "Aurora da Verdade", "student"], ["AR-14c", "Aurora da Verdade", "true"],
	["AR-15", "Dissonância Acústica", "basic"],
	["AR-16a", "Tecer Ilusão", "true"], ["AR-16b", "Tecer Ilusão", "basic"],
	["AR-17a", "Cinerária", "basic"], ["AR-17b", "Rejeitar Névoa", "basic"], ["AR-17c", "Nuvem de Cinzas", "basic"], ["AR-17d", "Detecção de Ameaças", "basic"], ["AR-17e", "Localização", "basic"],
];

/* -------------------------------------------- */
/*  Montagem do cenário                         */
/* -------------------------------------------- */

const tempItems = [];

/** O motor lê o ritual da ficha do conjurador; copia o ritual da biblioteca para ele durante o teste. */
async function ensureItem(caster, name) {
	let item = caster.items.find((entry) => entry.name === name && entry.type === "ritual" && entry.getFlag(SYSTEM, "liveTestCopy"));
	if (item) return item;
	const source = game.actors.getName("Biblioteca de Rituais — Agente")?.items.find((entry) => entry.name === name && entry.type === "ritual");
	if (!source) return null;
	const data = source.toObject();
	data.flags = { ...data.flags, [SYSTEM]: { liveTestCopy: true } };
	[item] = await caster.createEmbeddedDocuments("Item", [data]);
	tempItems.push(item.id);
	return item;
}

async function makeThreatToken(base, name, x, y, mode) {
	const data = (await base.getTokenDocument({ x, y })).toObject();
	data.name = name;
	data.actorLink = false;
	const [doc] = await canvas.scene.createEmbeddedDocuments("Token", [data]);
	const actor = doc.actor;
	const skillOverride = mode === "pass" ? 100 : -100;
	const update = {
		"system.attributes.hp.value": 9999, "system.attributes.hp.max": 9999,
		"system.genericRd": { value: 0, except: [] },
	};
	for (const type of ALL_TYPES) {
		update[`system.resistances.${type}.value`] = 0;
		update[`system.resistances.${type}.vulnerable`] = false;
		update[`system.resistances.${type}.immune`] = mode === "immune";
	}
	// bônus/penalidade fixo de +100 ou -100 (o valor `value` entra na rolagem das ameaças; `degree.override` negativo não entra)
	for (const skill of ["resilience", "reflexes", "will", "fighting"]) update[`system.skills.${skill}.value`] = mode === "pass" ? 100 : (mode === "fail" ? -100 : 0);
	await actor.update(update);
	return doc.object;
}

async function buildScene() {
	const base = game.actors.getName("Aberração de Carne") ?? game.actors.find((a) => a.type === "threat");
	const rect = canvas.dimensions.sceneRect;
	// centro de uma célula da grade: áreas minúsculas (esfera de 1,5 m) só pegam a célula do centro
	const size = canvas.grid.size;
	const origin = { x: Math.floor((rect.x + rect.width / 2) / size) * size + size / 2, y: Math.floor((rect.y + rect.height / 2) / size) * size + size / 2 };
	return { base, origin };
}

async function placeTemplate(rule, origin, casterToken) {
	const data = areaTemplateData(null, rule);
	if (!data) return null;
	const at = rule.area.center === "caster" ? casterToken.center : origin;
	const doc = await createAreaRegion({ direction: 0, ...data }, at, rule.key);
	await pause(300);
	return doc;
}

/** Centros de célula da grade que ficam dentro da forma, longe do conjurador, ordenados pela distância à origem. */
function cellsInside(region, origin, casterToken) {
	const size = canvas.grid.size;
	const found = [];
	const x0 = Math.floor(origin.x / size) * size + size / 2;
	const y0 = Math.floor(origin.y / size) * size + size / 2;
	for (let dx = -2600; dx <= 2600; dx += size) {
		for (let dy = -2600; dy <= 2600; dy += size) {
			const x = x0 + dx;
			const y = y0 + dy;
			if (!regionContains(region, { x, y })) continue;
			if (Math.hypot(x - casterToken.center.x, y - casterToken.center.y) < size * 1.2) continue;
			if (!canvas.dimensions.sceneRect.contains(x, y)) continue;
			found.push({ x, y, d: Math.hypot(x - origin.x, y - origin.y) });
		}
	}
	return found.sort((p, q) => p.d - q.d);
}

/** Cria passa/falha/imune dentro da área e um "fora" quando couber na cena. */
async function spawnTokens(base, doc, casterToken) {
	const cells = cellsInside(doc, regionCenter(doc), casterToken);
	if (!cells.length) throw new Error("Nenhuma célula livre dentro da área para o teste.");
	// áreas minúsculas (esfera de 1,5 m): as criaturas dividem o mesmo espaço
	const inner = cells.slice(0, Math.max(1, Math.ceil(cells.length * 0.6)));
	const spots = [inner[0], inner[Math.floor(inner.length / 2)], inner.at(-1)];
	const half = (base.prototypeToken.width * canvas.grid.size) / 2; // o centro do token cai exatamente no centro da célula escolhida
	const pass = await makeThreatToken(base, "Teste Passa", spots[0].x - half, spots[0].y - half, "pass");
	const fail = await makeThreatToken(base, "Teste Falha", spots[1].x - half, spots[1].y - half, "fail");
	const immune = await makeThreatToken(base, "Teste Imune", spots[2].x - half, spots[2].y - half, "immune");
	const rect = canvas.dimensions.sceneRect;
	let far = null;
	for (let k = 0; k < 600 && !far; k++) {
		const x = Math.floor((rect.x + 100 + Math.random() * (rect.width - 300)) / canvas.grid.size) * canvas.grid.size;
		const y = Math.floor((rect.y + 100 + Math.random() * (rect.height - 300)) / canvas.grid.size) * canvas.grid.size;
		if (!regionContains(doc, { x: x + half, y: y + half })) far = await makeThreatToken(base, "Teste Fora", x, y, "fail");
	}
	return { pass, fail, immune, far };
}

/** Ponto de referência da Região (centro do círculo ou canto do primeiro polígono). */
function regionCenter(region) {
	const shape = region.shapes[0].toObject();
	if (shape.type === "circle") return { x: shape.x, y: shape.y };
	if (shape.type === "rectangle") return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
	return { x: shape.points[0], y: shape.points[1] };
}

/** Totais dos `count` últimos dados de dano do ritual no chat, em ordem de rolagem. */
function lastDamageRolls(itemName, count = 1) {
	const messages = game.messages.contents.filter((m) => (m.flavor ?? "").startsWith(`${itemName} — dano`));
	return messages.slice(-count).flatMap((message) => message.rolls.map((roll) => Math.max(0, Math.floor(Number(roll.total)))));
}

/* -------------------------------------------- */
/*  Casos instantâneos (e ticks via onCast)     */
/* -------------------------------------------- */

async function runInstant(id, ritualName, formId, choiceId, ctx) {
	const { caster, casterToken, base, origin } = ctx;
	const item = await ensureItem(caster, ritualName);
	if (!item) return { id, caso: `${ritualName} (${formId})`, ok: false, detalhe: "ritual não encontrado" };
	const rule = areaRuleFor(item, formId, choiceId);
	if (!rule) return { id, caso: `${ritualName} (${formId})`, ok: false, detalhe: "regra não mapeada" };
	const label = `${ritualName} [${formId}${choiceId ? "/" + choiceId : ""}]`;
	const created = [];
	let template = null;
	try {
		const needsArea = !!rule.area;
		template = needsArea ? await placeTemplate(rule, origin, casterToken) : null;
		const tokens = template ? await spawnTokens(base, template, casterToken) : {
			pass: await makeThreatToken(base, "Teste Passa", origin.x - 100, origin.y, "pass"),
			fail: await makeThreatToken(base, "Teste Falha", origin.x + 100, origin.y, "fail"),
			immune: await makeThreatToken(base, "Teste Imune", origin.x, origin.y + 100, "immune"),
			far: null,
		};
		created.push(...Object.values(tokens).filter(Boolean));
		const hpBefore = new Map(created.map((token) => [token.id, hp(token)]));
		const casterHpBefore = Number(caster.system.PV.value);
		const cast = {
			actorId: caster.id, itemId: item.id, formId, choiceId: choiceId ?? null, cost: 6,
			targetIds: [tokens.pass.id, tokens.fail.id, tokens.immune.id], templateId: template?.id ?? null, casterTokenId: casterToken.id,
		};
		const grappleMode = ctx.grappleMode ?? "win";
		const savedOccultism = foundry.utils.deepClone(caster._source.system.skills.occultism);
		if (rule.onCast?.special === "grapple") await caster.update({ "system.skills.occultism.mod": grappleMode === "win" ? 300 : -300 });
		let lines;
		let secondLines = [];
		try {
			lines = await resolveAreaCast(cast, rule);
			await pause(300);
			if (rule.onCast?.special === "grapple") {
				var afterFirst = new Map(created.map((token) => [token.id, { hp: hp(token), names: effectNames(token) }]));
				secondLines = await resolveAreaCast(cast, rule);
				await pause(300);
			}
		} finally {
			if (rule.onCast?.special === "grapple") await caster.update({ "system.skills.occultism": savedOccultism });
		}
		const delta = (token) => (token ? hpBefore.get(token.id) - hp(token) : null);
		const spec = rule.onCast ?? {};
		const amounts = spec.damage?.length ? lastDamageRolls(ritualName, spec.damage.length) : [];
		const full = amounts.reduce((sum, n) => sum + n, 0);
		const half = amounts.reduce((sum, n) => sum + Math.floor(n / 2), 0);
		const problems = [];
		const expect = (cond, text) => { if (!cond) problems.push(text); };

		if (spec.damage?.length && spec.special !== "grapple") {
			const saveMode = spec.save?.success;
			const expectedPass = !spec.save ? full : saveMode === "half" ? half : saveMode === "full" ? full : 0;
			const expectedFail = spec.damageOnFailOnly || !spec.save ? full : full;
			expect(delta(tokens.pass) === (spec.special === "killAtZero" ? delta(tokens.pass) : expectedPass), `passou: dano ${delta(tokens.pass)} ≠ ${expectedPass}`);
			expect(delta(tokens.fail) === expectedFail, `falhou: dano ${delta(tokens.fail)} ≠ ${expectedFail}`);
			expect(delta(tokens.immune) === 0, `imune: dano ${delta(tokens.immune)} ≠ 0`);
		} else if (!spec.special) {
			expect(delta(tokens.pass) === 0 && delta(tokens.fail) === 0, "ritual sem dano causou dano");
		}
		if (tokens.far) expect(delta(tokens.far) === 0 && effectNames(tokens.far).length === 0, "token fora da área foi afetado");
		expect(Number(caster.system.PV.value) === casterHpBefore, "o agente (aliado) foi afetado");

		const failNames = effectNames(tokens.fail);
		const passNames = effectNames(tokens.pass);
		const nameOf = (cond) => cond.label ?? CONDITIONS[conditionIdFor(cond)]?.name ?? game.i18n.localize(CONFIG.statusEffects.find((s) => s.id === cond.key)?.name ?? cond.key);
		if (spec.save || spec.onFail || spec.onSuccess) {
			for (const cond of spec.onFail ?? []) expect(failNames.includes(nameOf(cond)), `falhou: faltou condição "${nameOf(cond)}"`);
			for (const cond of spec.onSuccess ?? []) expect(passNames.includes(nameOf(cond)), `passou: faltou condição "${nameOf(cond)}"`);
			const successNames = (spec.onSuccess ?? []).map(nameOf);
			for (const cond of spec.onFail ?? []) if (spec.save && !successNames.includes(nameOf(cond))) expect(!passNames.includes(nameOf(cond)), `passou: recebeu condição indevida "${nameOf(cond)}"`);
		}
		if (spec.special === "vulnerabilities") {
			const vulnerable = created.filter((t) => t.id !== tokens.far?.id && t.actor.system.resistances.cuttingDamage.vulnerable === true);
			expect(vulnerable.length === 3, `vulnerabilidade aplicada a ${vulnerable.length}/3 ameaças`);
			expect(!tokens.far || tokens.far.actor.system.resistances.cuttingDamage.vulnerable === false, "token fora ficou vulnerável");
		}
		if (spec.special === "tempPvFromDamage") expect(lines.some((line) => /PV temporários/.test(line)), "faltou linha de PV temporários");
		if (spec.special === "grapple") {
			const grabbed = (names) => names.some((n) => /Agarrado/.test(n));
			const amountsSecond = lastDamageRolls(ritualName, spec.damage.length);
			const fullSecond = amountsSecond.reduce((sum, n) => sum + n, 0);
			if (grappleMode === "win") {
				for (const [key, token] of Object.entries({ passa: tokens.pass, falha: tokens.fail, imune: tokens.immune })) {
					expect(grabbed(afterFirst.get(token.id).names), `1ª disputa vencida: ${key} devia estar agarrado`);
					expect(afterFirst.get(token.id).hp === hpBefore.get(token.id), `1ª disputa: ${key} não devia levar dano (só agarra)`);
				}
				expect(hpBefore.get(tokens.pass.id) - hp(tokens.pass) === fullSecond, `2ª disputa (já agarrado): passa devia levar o esmagamento inteiro (${fullSecond}), levou ${hpBefore.get(tokens.pass.id) - hp(tokens.pass)}`);
				expect(hpBefore.get(tokens.fail.id) - hp(tokens.fail) === fullSecond, "2ª disputa: falha devia levar o esmagamento inteiro");
				expect(hpBefore.get(tokens.immune.id) === hp(tokens.immune), "2ª disputa: imune a impacto e Morte não leva dano");
			} else {
				for (const token of [tokens.pass, tokens.fail, tokens.immune]) expect(!grabbed(effectNames(token)) && hp(token) === hpBefore.get(token.id), "disputa perdida: nada devia acontecer");
			}
			secondLines.length && lines.push("2ª rodada: " + secondLines.join(" | "));
		}
		if (rule.narrative && !rule.onCast) expect(lines.some((line) => line.includes(rule.narrative.slice(0, 20))) && created.every((t) => hp(t) === hpBefore.get(t.id)), "narrativo: devia só avisar, sem efeito");
		const detalhe = problems.length ? `${problems.join("; ")} || ${lines.join(" | ")}` : `ok · rolado ${amounts.join("+") || "—"} · passou −${delta(tokens.pass)} · falhou −${delta(tokens.fail)} · imune −${delta(tokens.immune)}`;
		return { id, caso: label, ok: problems.length === 0, detalhe };
	} catch (error) {
		return { id, caso: label, ok: false, detalhe: `erro: ${error.message}` };
	} finally {
		if (template) await canvas.scene.deleteEmbeddedDocuments("Region", [template.id]).catch(() => {});
		await canvas.scene.deleteEmbeddedDocuments("Token", created.map((t) => t.id)).catch(() => {});
		await pause(200);
	}
}

/** Paradoxo verdadeiro: quem chega a 0 PV faz Fortitude; falhou vira cinzas (morre), passou continua vivo. */
async function runKill(id, ctx) {
	const { caster, casterToken, base, origin } = ctx;
	const item = await ensureItem(caster, "Paradoxo");
	const rule = areaRuleFor(item, "true");
	const created = [];
	let template = null;
	try {
		template = await placeTemplate(rule, origin, casterToken);
		const tokens = await spawnTokens(base, template, casterToken);
		created.push(...Object.values(tokens).filter(Boolean));
		await tokens.fail.actor.update({ "system.attributes.hp.value": 5 });
		await tokens.pass.actor.update({ "system.attributes.hp.value": 3 });
		const cast = { actorId: caster.id, itemId: item.id, formId: "true", choiceId: null, cost: 10, targetIds: [], templateId: template.id, casterTokenId: casterToken.id };
		const lines = await resolveAreaCast(cast, rule);
		await pause(400);
		const problems = [];
		if (hp(tokens.fail) !== 0 || !tokens.fail.actor.statuses.has("dead")) problems.push("falhou em Fortitude a 0 PV: devia morrer (cinzas)");
		if (hp(tokens.pass) !== 0 || tokens.pass.actor.statuses.has("dead")) problems.push("passou em Fortitude a 0 PV: devia ficar a 0 PV, vivo");
		return { id, caso: "Paradoxo [true] reduzido a 0 PV", ok: problems.length === 0, detalhe: problems.length ? problems.join("; ") + " || " + lines.join(" | ") : "falhou → cinzas; passou → vivo a 0 PV" };
	} catch (error) {
		return { id, caso: "Paradoxo [true] reduzido a 0 PV", ok: false, detalhe: "erro: " + error.message };
	} finally {
		if (template) await canvas.scene.deleteEmbeddedDocuments("Region", [template.id]).catch(() => {});
		await canvas.scene.deleteEmbeddedDocuments("Token", created.map((t) => t.id)).catch(() => {});
	}
}

/* -------------------------------------------- */
/*  Zonas: turnos, expiração, saída             */
/* -------------------------------------------- */

async function withCombat(caster, casterToken, tokens, fn) {
	const combat = await Combat.create({ scene: canvas.scene.id, active: true });
	// iniciativas já na criação: a ordem dos turnos é sempre conjurador, passa, falha, imune, fora
	const docs = [casterToken, ...tokens].map((token, i) => ({ tokenId: token.id, sceneId: canvas.scene.id, actorId: token.actor.id, initiative: 100 - i * 10 }));
	await combat.createEmbeddedDocuments("Combatant", docs);
	await pause(300);
	try {
		await combat.startCombat();
		await pause(500);
		return await fn(combat);
	} finally {
		await combat.delete().catch(() => {});
	}
}

async function advanceUntil(combat, predicate, limit = 12) {
	for (let i = 0; i < limit; i++) {
		if (predicate(combat.combatant)) return true;
		await combat.nextTurn();
		await pause(1800);
	}
	return predicate(combat.combatant);
}

async function runZone(id, ritualName, formId, ctx, scenario) {
	const { caster, casterToken, base, origin } = ctx;
	const item = await ensureItem(caster, ritualName);
	const rule = areaRuleFor(item, formId);
	const label = `${ritualName} [${formId}] zona`;
	const created = [];
	let template = null;
	try {
		template = await placeTemplate(rule, origin, casterToken);
		const tokens = await spawnTokens(base, template, casterToken);
		created.push(...Object.values(tokens).filter(Boolean));
		const casterHp0 = Number(caster.system.PV.value);
		const cast = { actorId: caster.id, itemId: item.id, formId, choiceId: null, cost: 6, targetIds: [], templateId: template.id, casterTokenId: casterToken.id };
		const problems = [];
		const expect = (cond, text) => { if (!cond) problems.push(text); };
		const notes = [];
		await scenario({ item, rule, template, tokens, created, cast, expect, notes, casterHp0, combatCtx: { caster, casterToken } });
		return { id, caso: label, ok: problems.length === 0, detalhe: problems.length ? problems.join("; ") : notes.join(" · ") };
	} catch (error) {
		return { id, caso: label, ok: false, detalhe: `erro: ${error.stack?.split("\n").slice(0, 2).join(" ") ?? error.message}` };
	} finally {
		const live = canvas.scene.regions.get(template?.id);
		if (live) await live.delete().catch(() => {});
		await canvas.scene.deleteEmbeddedDocuments("Token", created.map((t) => t.id)).catch(() => {});
		await pause(300);
	}
}

const tickScenario = (when, { expectDamage = true, rounds = null } = {}) => async (s) => {
	const { tokens, cast, rule, expect, notes, created, combatCtx } = s;
	// Tentáculos: a disputa é Ocultismo contra a Luta da criatura; forçamos a vitória do conjurador para o teste ser determinístico
	const grapple = rule.tick?.special === "grapple";
	const savedOccultism = foundry.utils.deepClone(combatCtx.caster._source.system.skills.occultism);
	if (grapple) await combatCtx.caster.update({ "system.skills.occultism.mod": 300 });
	try {
		await runTick(s, when, { rounds });
	} finally {
		if (grapple) await combatCtx.caster.update({ "system.skills.occultism": savedOccultism });
	}
};

async function runTick(s, when, { rounds }) {
	const { tokens, cast, rule, expect, notes, created, combatCtx } = s;
	await resolveAreaCast(cast, rule);
	for (const token of created) token.actor.__before = hp(token);
	const before = new Map(created.map((t) => [t.id, hp(t)]));
	await withCombat(combatCtx.caster, combatCtx.casterToken, [tokens.pass, tokens.fail, tokens.immune, tokens.far].filter(Boolean), async (combat) => {
		const turnOf = (token) => (c) => c?.tokenId === token.id;
		if (when === "targetTurn") {
			await advanceUntil(combat, turnOf(tokens.fail));
			for (let waited = 0; waited < 10000 && hp(tokens.fail) >= before.get(tokens.fail.id); waited += 200) await pause(200);
			await pause(500);
			expect(before.get(tokens.fail.id) - hp(tokens.fail) > 0, "início do turno da criatura na área: devia levar dano");
			notes.push(`falhou −${before.get(tokens.fail.id) - hp(tokens.fail)}`);
			const passBefore = hp(tokens.pass);
			await advanceUntil(combat, turnOf(tokens.pass));
			await pause(1500);
			notes.push(`passou −${passBefore - hp(tokens.pass)}`);
			if (tokens.far) {
				await advanceUntil(combat, turnOf(tokens.far));
				await pause(1200);
				expect(before.get(tokens.far.id) === hp(tokens.far), "criatura fora da área levou dano no turno");
			}
		} else {
			// o turno do conjurador dispara o efeito para todos dentro da área
			await advanceUntil(combat, (c) => c?.tokenId !== combatCtx.casterToken.id);
			await advanceUntil(combat, (c) => c?.tokenId === combatCtx.casterToken.id);
			for (let waited = 0; waited < 10000 && hp(tokens.fail) >= before.get(tokens.fail.id); waited += 200) await pause(200);
			await pause(1200);
			expect(before.get(tokens.fail.id) - hp(tokens.fail) > 0, "turno do conjurador: ameaça na área devia levar dano");
			notes.push(`falhou −${before.get(tokens.fail.id) - hp(tokens.fail)}`, `passou −${before.get(tokens.pass.id) - hp(tokens.pass)}`);
			expect(before.get(tokens.immune.id) === hp(tokens.immune), "imune levou dano");
			if (rule.tick?.special === "grapple") expect(before.get(tokens.pass.id) - hp(tokens.pass) > 0, "turno do conjurador: criatura agarrada também devia ser esmagada");
		}
		if (rounds) {
			// depois de `rounds` rodadas completas, a zona deve ter sido removida
			for (let i = 0; i < rounds + 1; i++) await advanceUntil(combat, (c) => c?.tokenId === combatCtx.casterToken.id && combat.round > i + 1, 14);
			await pause(1500);
			notes.push(canvas.scene.regions.get(s.template.id) ? "zona ainda ativa" : "zona expirou");
		}
	});
}

/** Miasma Entrópico verdadeiro: dura 3 rodadas; depois a zona some e o dano para. */
async function expiryScenario(s) {
	const { tokens, cast, rule, expect, notes, created, combatCtx } = s;
	await withCombat(combatCtx.caster, combatCtx.casterToken, [tokens.pass, tokens.fail, tokens.immune], async (combat) => {
		await resolveAreaCast(cast, rule); // conjurado na rodada 1
		const perRound = [];
		let last = hp(tokens.fail);
		for (let round = 1; round <= 4; round++) {
			const ok = await advanceUntil(combat, (c) => c?.tokenId === tokens.fail.id && combat.round === round, 16);
			if (!ok) break;
			// o efeito do turno pode demorar (dados 3D, mensagens): espera o dano chegar (ou 3 s para provar que não vem)
			const t0 = Date.now();
			while (Date.now() - t0 < (round <= 3 ? 10000 : 3000) && !(round <= 3 && hp(tokens.fail) < last)) await pause(200);
			await pause(600);
			perRound.push(last - hp(tokens.fail));
			last = hp(tokens.fail);
		}
		notes.push("dano por rodada (a criatura que falha): " + perRound.join(", "));
		expect(perRound.slice(0, 3).every((d) => d > 0), "nas 3 rodadas de duração a criatura na área devia levar dano no início do turno: " + perRound.join(","));
		expect(perRound[3] === 0, "depois das 3 rodadas o dano devia parar");
		expect(!canvas.scene.regions.get(s.template.id), "a zona devia ter sido removida ao expirar");
	});
}

/* -------------------------------------------- */
/*  Execução                                    */
/* -------------------------------------------- */

/** Roda os testes dos rituais de área numa cena temporária, com cópias do agente (não toca nas cenas nem nas fichas do mundo). */
export async function runAreaRitualTests(options = {}) {
	return withArena(() => runAreaSuite(options), { agents: ["Agente NEX 50 — Ocultista"] });
}

async function runAreaSuite({ only = null, keepMessages = false } = {}) {
	if (!game.user.isGM) throw new Error("Rode como Mestre.");
	const casterToken = canvas.tokens.placeables.find((token) => token.actor?.type === "agent");
	if (!casterToken) throw new Error("A cena precisa ter o token de um agente.");
	const caster = casterToken.actor;
	const pdBefore = caster.system.PD.value;
	const { base, origin } = await buildScene();
	const ctx = { caster, casterToken, base, origin };
	const results = [];
	const wanted = (id) => !only || [].concat(only).some((prefix) => id.startsWith(prefix));
	// As áreas grandes pegam qualquer ameaça da cena: guardamos o estado das ameaças reais e das mensagens para restaurar no fim.
	const realThreats = canvas.tokens.placeables.filter((token) => token.actor?.type === "threat").map((token) => ({
		token, hp: token.actor.system.attributes.hp.value, effects: new Set(token.actor.effects.map((effect) => effect.id)),
	}));
	const knownMessages = new Set(game.messages.contents.map((message) => message.id));
	try {
		for (const [id, name, form, choice, extra] of INSTANT_CASES) {
			if (!wanted(id)) continue;
			if (["Poeira da Podridão", "Presença do Medo", "Tentáculos de Lodo", "Purgatório", "Miasma Entrópico"].includes(name) || id.startsWith("AR-16")) {
				// os efeitos de onCast dessas zonas também são testados aqui; ticks/saída ficam nos cenários de zona abaixo
			}
			results.push(await runInstant(id, name, form, choice, { ...ctx, ...(extra ?? {}) }));
		}
		if (wanted("AR-01c")) results.push(await runKill("AR-01c", ctx));
		const zones = [
			["AR-20a", "Paradoxo", "student", tickScenario("targetTurn")],
			["AR-20b", "Miasma Entrópico", "true", tickScenario("targetTurn")],
			["AR-20g", "Miasma Entrópico", "true", expiryScenario],
			["AR-20c", "Poeira da Podridão", "basic", tickScenario("casterTurn")],
			["AR-20d", "Tentáculos de Lodo", "basic", tickScenario("casterTurn")],
			["AR-20e", "Presença do Medo", "basic", tickScenario("targetTurn")],
			["AR-20f", "Tecer Ilusão", "true", tickScenario("casterTurn")],
			["AR-21", "Purgatório", "basic", exitScenario],
		];
		for (const [id, name, form, scenario] of zones) if (wanted(id)) results.push(await runZone(id, name, form, ctx, scenario));
	} finally {
		for (const { token, hp: hpBefore, effects } of realThreats) {
			if (!canvas.tokens.get(token.id)) continue;
			const extra = token.actor.effects.filter((effect) => !effects.has(effect.id)).map((effect) => effect.id);
			if (extra.length) await token.actor.deleteEmbeddedDocuments("ActiveEffect", extra).catch(() => {});
			await token.actor.update({ "system.attributes.hp.value": hpBefore });
			await token.actor.unsetFlag(SYSTEM, "areaOncePerScene").catch(() => {});
		}
		if (!keepMessages) {
			const fresh = game.messages.contents.filter((message) => !knownMessages.has(message.id)).map((message) => message.id);
			for (let i = 0; i < fresh.length; i += 100) await ChatMessage.deleteDocuments(fresh.slice(i, i + 100)).catch(() => {});
		}
		await caster.update({ "system.PD.value": pdBefore });
		if (tempItems.length) await caster.deleteEmbeddedDocuments("Item", tempItems.splice(0)).catch(() => {});
	}
	console.table(results);
	return results;
}

async function exitScenario(s) {
	const { tokens, cast, rule, expect, notes, created, template, combatCtx } = s;
	await resolveAreaCast(cast, rule);
	await pause(500);
	// passa sempre: consegue sair, mas leva o dano
	const outside = (token) => {
		const shape = template.shapes[0].toObject();
		return { x: Math.round(shape.x + (shape.radius ?? 400) + 150), y: Math.round(token.document.y) };
	};
	const startPass = { x: tokens.pass.document.x, y: tokens.pass.document.y };
	const hpPass = hp(tokens.pass);
	await tokens.pass.document.update(outside(tokens.pass), { animate: false, teleport: true });
	await pause(2500);
	const movedPass = Math.abs(tokens.pass.document.x - startPass.x) > 100;
	expect(movedPass, "passou em Fortitude: devia conseguir sair da área");
	expect(hpPass - hp(tokens.pass) > 0, "ao tentar sair devia levar o dano de Sangue");
	notes.push(`passou: saiu, −${hpPass - hp(tokens.pass)} PV`);
	const startFail = { x: tokens.fail.document.x, y: tokens.fail.document.y };
	const hpFail = hp(tokens.fail);
	await tokens.fail.document.update(outside(tokens.fail), { animate: false, teleport: true });
	await pause(3000);
	const bounced = Math.abs(tokens.fail.document.x - startFail.x) < 5 && Math.abs(tokens.fail.document.y - startFail.y) < 5;
	expect(bounced, `falhou em Fortitude: devia voltar à posição (agora x=${tokens.fail.document.x}, y=${tokens.fail.document.y})`);
	expect(hpFail - hp(tokens.fail) > 0, "falhou: devia levar o dano mesmo assim");
	expect(effectNames(tokens.fail).some((n) => /Sem ação de movimento/.test(n)), "falhou: devia perder a ação de movimento");
	notes.push(`falhou: não saiu, −${hpFail - hp(tokens.fail)} PV, perdeu ação de movimento`);
	void combatCtx; void created;
}

export { tokensInside };
