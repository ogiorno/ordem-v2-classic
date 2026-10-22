// Rodar: npm test. Valida a progressão por Nível contra as tabelas do livro (regras/02-criacao-de-personagem)
// e confere se as trilhas/origens dos compêndios casam com a concessão automática de habilidades.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { calculateProgress, calculateStatusMaxima, calculatePerRound } from "../../module/helpers/actor-calculations.mjs";
import {
	abilityUnlockLevel,
	findOriginPower,
	nexToLevel,
	normalizeName,
} from "../../module/helpers/level-progression-rules.mjs";

const SRC = path.resolve(import.meta.dirname, "../../packs/_source");
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const walk = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const full = path.join(dir, e.name);
		return e.isDirectory() ? walk(full) : full.endsWith(".json") ? [full] : [];
	});
const items = (pack) => walk(path.join(SRC, pack)).filter((f) => !f.endsWith("_folder.json")).map(readJson);

// Livro de Regras: inicial / por novo nível (PV +Vig, PE +Pre, PD +Pre; SAN fixo).
const BOOK = {
	combatente: { hp: [20, 4], pe: [2, 2], san: [12, 3], pd: [6, 3] },
	especialista: { hp: [16, 3], pe: [3, 3], san: [16, 4], pd: [8, 4] },
	ocultista: { hp: [12, 2], pe: [4, 4], san: [20, 5], pd: [10, 5] },
};

describe("classes dos compêndios x livro", () => {
	for (const [name, book] of Object.entries(BOOK)) {
		const cls = items("classes").find((c) => normalizeName(c.name) === name);
		it(`${name}: valores iniciais e por nível`, () => {
			assert.equal(cls.system.hpInitial, book.hp[0]);
			assert.equal(cls.system.hpPerLevel, book.hp[1]);
			assert.equal(cls.system.peInitial, book.pe[0]);
			assert.equal(cls.system.pePerLevel, book.pe[1]);
			assert.equal(cls.system.sanInitial, book.san[0]);
			assert.equal(cls.system.sanPerLevel, book.san[1]);
			assert.equal(cls.system.pdInitial, book.pd[0]);
			assert.equal(cls.system.pdPerLevel, book.pd[1]);
		});
		it(`${name}: máximos do nível 1 ao 20 (Vig 3, Pre 2)`, () => {
			const [VIG, PRE] = [3, 2];
			for (let nivel = 1; nivel <= 20; nivel++) {
				const progress = calculateProgress(false, nivel, 1);
				assert.equal(progress, nivel);
				const sane = calculateStatusMaxima(VIG, PRE, progress, false, cls.system);
				assert.equal(sane.PV_max, book.hp[0] + VIG + (nivel - 1) * (book.hp[1] + VIG), `PV nível ${nivel}`);
				assert.equal(sane.PE_max, book.pe[0] + PRE + (nivel - 1) * (book.pe[1] + PRE), `PE nível ${nivel}`);
				assert.equal(sane.SAN_max, book.san[0] + (nivel - 1) * book.san[1], `SAN nível ${nivel}`);
				const nosan = calculateStatusMaxima(VIG, PRE, progress, true, cls.system);
				assert.equal(nosan.PD_max, book.pd[0] + PRE + (nivel - 1) * (book.pd[1] + PRE), `PD nível ${nivel}`);
			}
		});
	}
});

describe("calculateProgress", () => {
	it("usa só o nível (limitado a 1–20) e o estágio do sobrevivente", () => {
		assert.equal(calculateProgress(false, 7, 3), 7);
		assert.equal(calculateProgress(false, 0, 3), 1);
		assert.equal(calculateProgress(false, 50, 3), 20);
		assert.equal(calculateProgress(true, 7, 3), 3);
	});
	it("PE por rodada = nível; PD por rodada = nível sem Sanidade", () => {
		assert.deepEqual(calculatePerRound(false, 6, false), { PE_perRound: 6 });
		assert.deepEqual(calculatePerRound(false, 6, true), { PD_perRound: 6 });
	});
});

describe("concessão de habilidades", () => {
	it("NEX -> nível", () => {
		assert.equal(nexToLevel(5), 1);
		assert.equal(nexToLevel(10), 2);
		assert.equal(nexToLevel(40), 8);
		assert.equal(nexToLevel(65), 13);
		assert.equal(nexToLevel(99), 20);
	});
	it("habilidade de trilha libera no nível do NEX do nome", () => {
		assert.equal(abilityUnlockLevel("NEX 10% - A Favorita"), 2);
		assert.equal(abilityUnlockLevel("Nex 99% - A Sanidade Está Lá Fora"), 20);
		assert.equal(abilityUnlockLevel("Conhecimento"), null);
	});
	it("toda trilha dos livros tem habilidades nos níveis 2, 8, 13 e 20", () => {
		const folders = new Map();
		const abilities = [];
		for (const pack of ["pathFighter", "pathSpecialist", "pathOccultist"]) {
			for (const f of walk(path.join(SRC, pack))) {
				const j = readJson(f);
				if (f.endsWith("_folder.json")) folders.set(j._id, j.name);
				else abilities.push(j);
			}
		}
		const paths = items("paths").filter((p) => p.type === "path");
		let checked = 0;
		for (const p of paths) {
			const levels = abilities
				.filter((a) => normalizeName(folders.get(a.folder)) === normalizeName(p.name))
				.map((a) => abilityUnlockLevel(a.name))
				.filter((l) => l !== null)
				.sort((a, b) => a - b);
			if (!levels.length) continue; // trilhas sem pasta de habilidades (ex.: Monstruoso)
			checked++;
			for (const l of [2, 8, 13, 20]) assert.ok(levels.includes(l), `${p.name} sem habilidade de nível ${l} (${levels})`);
		}
		assert.ok(checked >= 20);
	});
	it("origens do livro recebem o poder correto", () => {
		const powers = items("originPowers").map((o) => o.name);
		const expected = {
			Militar: "Para Bellum",
			Engenheiro: "Ferramentas Favoritas",
			Operário: "Ferramentas de Trabalho",
			Atleta: "110%",
			Acadêmico: "Saber é Poder",
			Vítima: "Cicatrizes Psicológicas",
		};
		const origins = items("origins");
		for (const [origin, power] of Object.entries(expected)) {
			const o = origins.find((x) => x.name === origin);
			assert.equal(findOriginPower(o.name, o.system.description, powers), power, origin);
		}
	});
});
