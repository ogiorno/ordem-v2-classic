// Rodar: npm test. Área das armas, Em Chamas (docs/spec-armas-area-recarga.md, seções 4 a 6).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { areaKind, flameHit, lineHits, radiusDamage, radiusHits, reflexDT, BAZOOKA_RADIUS_SQUARES, FLAME_LENGTH_SQUARES } from "../../module/helpers/weapon-area.mjs";
import { CONDITIONS, CONDITION_RULES, conditionIdFor } from "../../module/helpers/conditions.mjs";
import { BURN_DAMAGE_FORMULA, BURN_DAMAGE_TYPE } from "../../module/helpers/turn-effects-rules.mjs";

const at = (id, x, y) => ({ id, x, y });

describe("tipo de área da arma", () => {
	it("Bazuca é raio, Lança-chamas é linha, as outras não têm área", () => {
		assert.equal(areaKind("Bazuca"), "radius");
		assert.equal(areaKind("Lança-chamas"), "line");
		assert.equal(areaKind("Pistola"), null);
	});
});

describe("Bazuca: raio de 3 m (2 quadrados)", () => {
	const beings = [at("perto", 10, 10), at("diagonal", 11, 11), at("limite", 12, 10), at("fora", 13, 10), at("longe", 20, 20)];
	it("pega quem está a até 2 quadrados do centro", () => {
		assert.equal(BAZOOKA_RADIUS_SQUARES, 2);
		assert.deepEqual(radiusHits(at("c", 10, 10), beings), ["perto", "diagonal", "limite"]);
	});
	it("a distância é em linha reta entre centros (2,5 quadrados fica de fora)", () => {
		assert.deepEqual(radiusHits(at("c", 10, 10), [at("a", 12.5, 10), at("b", 11.4, 11.4)]), ["b"]);
	});
	it("DT do teste de Reflexos é 10 + Agilidade", () => {
		assert.equal(reflexDT(3), 13);
		assert.equal(reflexDT(0), 10);
	});
	it("quem passa recebe metade arredondada para baixo", () => {
		assert.equal(radiusDamage(15, true), 7);
		assert.equal(radiusDamage(15, false), 15);
		assert.equal(radiusDamage(1, true), 0);
	});
});

describe("Lança-chamas: linha de 1 quadrado até o alcance curto", () => {
	const from = at("eu", 0, 0);
	const to = at("alvo", 3, 0);
	it("alcança até 6 quadrados", () => {
		assert.equal(FLAME_LENGTH_SQUARES, 6);
		const hits = lineHits(from, to, [at("a", 1, 0), at("b", 6, 0), at("c", 7, 0)]);
		assert.deepEqual(hits, ["a", "b"]);
	});
	it("largura de 1 quadrado: até meio quadrado para cada lado", () => {
		const hits = lineHits(from, to, [at("lado", 2, 0.5), at("fora", 2, 0.6), at("outro", 2, -0.4)]);
		assert.deepEqual(hits, ["lado", "outro"]);
	});
	it("não pega quem está atrás de quem atira nem quem é o próprio atirador", () => {
		assert.deepEqual(lineHits(from, to, [at("atras", -2, 0), at("eu", 0, 0)]), []);
	});
	it("funciona na diagonal", () => {
		assert.deepEqual(lineHits(at("eu", 0, 0), at("alvo", 2, 2), [at("a", 1, 1), at("b", 3, 3), at("c", 3, 0)]), ["a", "b"]);
	});
	it("sem direção (alvo no mesmo ponto) não atinge ninguém", () => {
		assert.deepEqual(lineHits(from, from, [at("a", 1, 0)]), []);
	});
	it("um único ataque contra cada Defesa: acerta se o total alcança", () => {
		assert.ok(flameHit(15, 15));
		assert.ok(!flameHit(14, 15));
	});
});

describe("Em Chamas", () => {
	it("entra no catálogo sem mexer na Defesa e com o marcador de dano de turno", () => {
		assert.equal(conditionIdFor({ key: "burning" }), "burning");
		const c = CONDITIONS.burning;
		assert.equal(c.name, "Em Chamas");
		assert.deepEqual(c.changes, []);
		assert.equal(c.condition.burn, true);
		assert.match(CONDITION_RULES.burning, /1d6/);
	});
	it("dano de 1d6 de fogo no início do turno", () => {
		assert.equal(BURN_DAMAGE_FORMULA, "1d6");
		assert.equal(BURN_DAMAGE_TYPE, "fireDamage");
	});
});
