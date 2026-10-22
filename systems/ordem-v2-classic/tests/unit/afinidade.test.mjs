// Rodar: npm test. Conexão e afinidade com um elemento (module/helpers/affinity-rules.mjs). Spec: docs/spec-afinidade.md.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	AFFINITY_ELEMENTS, OPPRESSOR_OF, afterParanormalPower, affinityMeets, affinityStatus, canConnect, connect, emptyParanormal,
	oppressorOf, powerElement, powersByElement, reachedConnection, skipsComponents, testDiceDelta,
} from "../../module/helpers/affinity-rules.mjs";

describe("elemento opressor", () => {
	it("Morte oprime Sangue, Sangue oprime Conhecimento, Conhecimento oprime Energia, Energia oprime Morte", () => {
		assert.equal(oppressorOf("blood"), "death");
		assert.equal(oppressorOf("knowledge"), "blood");
		assert.equal(oppressorOf("energy"), "knowledge");
		assert.equal(oppressorOf("death"), "energy");
	});
	it("é um ciclo: nenhum elemento oprime a si mesmo e cada um oprime exatamente um", () => {
		const oppressors = Object.keys(AFFINITY_ELEMENTS).map((k) => OPPRESSOR_OF[k]);
		assert.equal(new Set(oppressors).size, 4);
		for (const k of Object.keys(AFFINITY_ELEMENTS)) assert.notEqual(OPPRESSOR_OF[k], k);
	});
	it("Medo e lixo não têm opressor", () => {
		assert.equal(oppressorOf("fear"), null);
		assert.equal(oppressorOf(""), null);
	});
});

describe("quando pode se conectar", () => {
	it("NEX 50% ou nível 10 (conforme a progressão)", () => {
		assert.equal(reachedConnection({ nex: 45 }), false);
		assert.equal(reachedConnection({ nex: 50 }), true);
		assert.equal(reachedConnection({ level: 9, byNex: false }), false);
		assert.equal(reachedConnection({ level: 10, byNex: false }), true);
	});
	it("só uma vez", () => {
		assert.equal(canConnect(emptyParanormal(), { nex: 50 }), true);
		assert.equal(canConnect(emptyParanormal(), { nex: 40 }), false);
		assert.equal(canConnect({ connection: "blood" }, { nex: 99 }), false);
	});
	it("escolher de novo não muda a conexão; elemento inválido é ignorado", () => {
		const first = connect(emptyParanormal(), "blood", { nex: 50 });
		assert.equal(first.connection, "blood");
		assert.equal(connect(first, "death", { nex: 50 }).connection, "blood");
		assert.equal(connect(emptyParanormal(), "fear").connection, "");
	});
});

describe("conexão vira afinidade no próximo poder paranormal", () => {
	it("o poder seguinte transforma a conexão em afinidade", () => {
		const p = connect(emptyParanormal(), "energy", { level: 10, nex: 50 });
		assert.equal(p.affinity, "");
		const after = afterParanormalPower(p, { level: 11 });
		assert.equal(after.affinity, "energy");
		assert.equal(after.graceLevel, 0);
	});
	it("o poder do mesmo nível da subida de NEX não conta (B1)", () => {
		const p = connect(emptyParanormal(), "death", { level: 10, nex: 50, viaLevelUp: true });
		assert.equal(afterParanormalPower(p, { level: 10 }).affinity, "");
		assert.equal(afterParanormalPower(p, { level: 11 }).affinity, "death");
	});
	it("conexão escolhida pelo botão (ficha antiga) vale já no poder seguinte, no mesmo nível", () => {
		const p = connect(emptyParanormal(), "blood", { level: 12, nex: 60, viaLevelUp: false });
		assert.equal(afterParanormalPower(p, { level: 12 }).affinity, "blood");
	});
	it("sem conexão nada acontece; com afinidade já feita nada muda", () => {
		assert.equal(afterParanormalPower(emptyParanormal(), { level: 12 }).affinity, "");
		const done = { ...emptyParanormal(), connection: "blood", affinity: "blood" };
		assert.deepEqual(afterParanormalPower(done, { level: 15 }), done);
	});
});

describe("leitura da ficha", () => {
	it("estados: bloqueado, pendente, conectado e afinidade", () => {
		assert.equal(affinityStatus(emptyParanormal(), { nex: 20 }).state, "locked");
		assert.equal(affinityStatus(emptyParanormal(), { nex: 50 }).state, "pending");
		const conn = affinityStatus({ connection: "blood" }, { nex: 50 });
		assert.equal(conn.state, "connected");
		assert.equal(conn.oppressor, "death");
		const aff = affinityStatus({ connection: "blood", affinity: "blood" }, { nex: 60 });
		assert.equal(aff.state, "affinity");
		assert.match(aff.summary, /–1d20 contra efeitos de Morte/);
	});
	it("poder paranormal → elemento pelo pré-requisito", () => {
		assert.equal(powerElement("Sangue 2"), "blood");
		assert.equal(powerElement("Conhecimento 1"), "knowledge");
		assert.equal(powerElement(""), null);
		assert.deepEqual(powersByElement(["Sangue 1", "Sangue 2", "Morte 1", ""]), { knowledge: 0, energy: 0, death: 1, blood: 2 });
	});
});

describe("efeitos da afinidade (usados nas fases seguintes)", () => {
	const aff = { connection: "blood", affinity: "blood" };
	it("componentes só do elemento da afinidade", () => {
		assert.equal(skipsComponents(aff, "blood"), true);
		assert.equal(skipsComponents(aff, "death"), false);
		assert.equal(skipsComponents({ connection: "blood" }, "blood"), false);
	});
	it("+1d20 contra o próprio elemento, –1d20 contra o opressor, 0 nos outros", () => {
		assert.equal(testDiceDelta(aff, "blood"), 1);
		assert.equal(testDiceDelta(aff, "death"), -1);
		assert.equal(testDiceDelta(aff, "energy"), 0);
		assert.equal(testDiceDelta({ connection: "blood" }, "blood"), 0);
		assert.equal(testDiceDelta(aff, "fear"), 0);
	});
	it("requisito de afinidade de ritual", () => {
		assert.equal(affinityMeets(aff, "afinidade", "blood"), true);
		assert.equal(affinityMeets(aff, "afinidade", "death"), false);
		assert.equal(affinityMeets(aff, "Sangue"), true);
		assert.equal(affinityMeets(aff, "Morte"), false);
		assert.equal(affinityMeets({ connection: "blood" }, "Sangue"), false);
	});
});

import { componentElementOf, componentStatus, formAffinityCheck, isComponentImproviser } from "../../module/helpers/affinity-rules.mjs";

describe("conjuração de rituais (Fase 2)", () => {
	const aff = { connection: "blood", affinity: "blood" };
	it("forma sem exigência passa", () => {
		assert.deepEqual(formAffinityCheck(aff, null, "blood"), { needed: false, ok: true, element: "", label: "" });
	});
	it("'afinidade' sem elemento vale para o elemento do ritual", () => {
		const yes = formAffinityCheck(aff, "afinidade", "blood");
		assert.equal(yes.ok, true);
		const no = formAffinityCheck(aff, "afinidade", "death");
		assert.equal(no.ok, false);
		assert.equal(no.label, "Morte");
	});
	it("'afinidade com X' compara com X, não com o ritual", () => {
		assert.equal(formAffinityCheck(aff, "Sangue", "knowledge").ok, true);
		assert.equal(formAffinityCheck(aff, "Morte", "death").ok, false);
	});
	it("só conexão, sem afinidade, não atende; o Mestre passa por cima", () => {
		assert.equal(formAffinityCheck({ connection: "blood" }, "afinidade", "blood").ok, false);
		assert.equal(formAffinityCheck({ connection: "blood" }, "afinidade", "blood", { bypass: true }).ok, true);
	});
	it("nomes de componente e do poder que improvisa", () => {
		assert.equal(componentElementOf("Componente de Sangue"), "blood");
		assert.equal(componentElementOf("Componentes Ritualísticos de Conhecimento"), "knowledge");
		assert.equal(componentElementOf("Ampliador de Sangue"), null);
		assert.equal(isComponentImproviser("Improvisar Componentes"), true);
		assert.equal(isComponentImproviser("Improvisar"), false);
	});
	it("componentes: dispensados, presentes, improvisados, faltando e Medo", () => {
		assert.equal(componentStatus(aff, "blood").state, "dispensed");
		assert.equal(componentStatus({}, "blood", { componentElements: ["blood"] }).state, "ok");
		assert.equal(componentStatus({}, "blood", { componentElements: ["death"] }).state, "missing");
		assert.equal(componentStatus({}, "blood", { improvises: true }).state, "improvised");
		assert.equal(componentStatus({}, "fear").state, "none");
		assert.match(componentStatus({}, "death").note, /Componente de Morte/);
	});
	it("afinidade com outro elemento não dispensa", () => {
		assert.equal(componentStatus(aff, "death").state, "missing");
	});
});

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	AFFINITY_MANUAL_REASONS, AFFINITY_POWERS, AFFINITY_RULE_FLAG, affinityEffectData, affinityLineFor, affinityParagraph, canHaveAffinityCopy, copyGrantsBenefit,
} from "../../module/helpers/affinity-powers.mjs";
import { passiveKey } from "../../module/helpers/passive-effects-rules.mjs";

describe("linhas 'Afinidade' dos poderes paranormais (Fase 4)", () => {
	const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../packs/_source/paranormalPowers");
	const FOLDER_ELEMENT = { "poderes-de-conhecimento": "knowledge", "poderes-de-energia": "energy", "poderes-de-morte": "death", "poderes-de-sangue": "blood" };
	const packPowers = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const files = entry.isDirectory() ? fs.readdirSync(path.join(dir, entry.name)).map((f) => [entry.name, path.join(dir, entry.name, f)]) : [["", path.join(dir, entry.name)]];
		for (const [folder, file] of files) {
			if (!file.endsWith(".json") || file.endsWith("_folder.json")) continue;
			packPowers.push({ name: JSON.parse(fs.readFileSync(file, "utf8")).name, element: FOLDER_ELEMENT[folder] ?? null });
		}
	}

	it("o compêndio tem poderes e todos estão classificados", () => {
		assert.ok(packPowers.length >= 29, packPowers.length);
		for (const p of packPowers) assert.ok(affinityLineFor(p.name), `sem linha de afinidade: ${p.name}`);
	});
	it("o elemento da tabela é o da pasta do compêndio", () => {
		for (const p of packPowers.filter((x) => x.element)) assert.equal(affinityLineFor(p.name).element, p.element, p.name);
	});
	it("toda linha é auto (com mudanças) ou manual (com motivo conhecido) e tem texto", () => {
		for (const [key, line] of Object.entries(AFFINITY_POWERS)) {
			assert.ok(line.line.length > 10, key);
			if (line.changes) assert.ok(line.changes.length > 0 && !line.manual, key);
			else assert.ok(AFFINITY_MANUAL_REASONS[line.manual], `motivo desconhecido em ${key}`);
		}
	});
	it("a tabela não tem chave sobrando (todo nome existe no compêndio)", () => {
		const names = new Set(packPowers.map((p) => passiveKey(p.name)));
		for (const key of Object.keys(AFFINITY_POWERS)) assert.ok(names.has(key), `chave sem poder: ${key}`);
	});
	it("poderes automáticos: Potencial Aprimorado, Espreitar da Besta, Sangue de Ferro", () => {
		const auto = Object.entries(AFFINITY_POWERS).filter(([, l]) => l.changes).map(([k]) => k).sort();
		assert.deepEqual(auto, ["espreitar da besta", "potencial aprimorado", "sangue de ferro"]);
	});
	it("a cópia só dá benefício com afinidade no elemento do poder", () => {
		assert.equal(copyGrantsBenefit("Sangue de Ferro", "blood"), true);
		assert.equal(copyGrantsBenefit("Sangue de Ferro", "death"), false);
		assert.equal(copyGrantsBenefit("Sangue de Ferro", ""), false);
		assert.equal(copyGrantsBenefit("Poder Inexistente", "blood"), false);
	});
	it("efeito da cópia: Espreitar da Besta soma +5 em Furtividade (total +10); manual não cria efeito", () => {
		const data = affinityEffectData("Espreitar da Besta", "blood");
		assert.deepEqual(data.system.changes.map((c) => [c.key, c.value]), [["system.skills.stealth.mod", 5]]);
		assert.equal(data.flags["ordem-v2-classic"][AFFINITY_RULE_FLAG], true);
		assert.equal(data.transfer, true);
		assert.equal(affinityEffectData("Espreitar da Besta", "death"), null);
		assert.equal(affinityEffectData("Anatomia Insana", "blood"), null);
		assert.deepEqual(affinityEffectData("Sangue de Ferro", "blood").system.changes.map((c) => c.key), ["system.skills.resilience.mod"]);
		assert.equal(affinityEffectData("Potencial Aprimorado", "death").system.changes[0].value, "@nivel.value");
	});
	it("Resistir a Elemento se repete por elemento, então não vira cópia", () => {
		assert.equal(canHaveAffinityCopy("Resistir a <Elemento>"), false);
		assert.equal(canHaveAffinityCopy("Sangue Vivo"), true);
		assert.equal(canHaveAffinityCopy("Poder Inexistente"), false);
	});
	it("trecho do grimório", () => {
		assert.match(affinityParagraph("Sangue Vivo"), /cura acelerada aumenta para 5/);
		assert.match(affinityParagraph("Sangue Vivo", { hasAffinity: true }), /pode escolher o poder uma segunda vez/);
		assert.match(affinityParagraph("Sangue Vivo", { hasAffinity: false }), /Exige afinidade/);
		assert.equal(affinityParagraph("Poder Inexistente"), "");
	});
});
