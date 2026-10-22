// Rodar: npm test. A concessão automática de habilidades (origem, trilha, classe) não pode criar a mesma
// habilidade duas vezes quando várias concessões chegam ao mesmo tempo na mesma ficha.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTaskQueue } from "../../module/helpers/actor-task-queue.mjs";
import { duplicateGrantIds, normalizeName } from "../../module/helpers/level-progression-rules.mjs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe("fila de tarefas por ficha", () => {
	it("tarefas da mesma ficha rodam uma de cada vez, na ordem de chegada", async () => {
		const run = createTaskQueue();
		const log = [];
		const task = (name, ms) => async () => {
			log.push(`${name}:início`);
			await wait(ms);
			log.push(`${name}:fim`);
		};
		await Promise.all([run("a", task("1", 30)), run("a", task("2", 5)), run("a", task("3", 1))]);
		assert.deepEqual(log, ["1:início", "1:fim", "2:início", "2:fim", "3:início", "3:fim"]);
	});
	it("fichas diferentes não esperam umas pelas outras", async () => {
		const run = createTaskQueue();
		const log = [];
		await Promise.all([
			run("a", async () => {
				await wait(30);
				log.push("a");
			}),
			run("b", async () => {
				await wait(1);
				log.push("b");
			}),
		]);
		assert.deepEqual(log, ["b", "a"]);
	});
	it("uma tarefa que falha não trava as seguintes, e o erro chega a quem pediu", async () => {
		const run = createTaskQueue();
		const falha = run("a", async () => {
			throw new Error("falhou");
		});
		const depois = run("a", async () => "ok");
		await assert.rejects(falha, /falhou/);
		assert.equal(await depois, "ok");
	});
	it("devolve o resultado da tarefa", async () => {
		assert.equal(await createTaskQueue()("a", async () => 42), 42);
	});
});

describe("concessão simulada com a fila: o cenário que duplicou", () => {
	// Mesmo desenho de grantEntries: lê o que a ficha tem, espera (getDocument no compêndio), cria.
	const makeActor = () => {
		const items = [];
		const grant = async (name, source) => {
			const owned = new Set(items.map((i) => normalizeName(i.name)));
			if (owned.has(normalizeName(name))) return;
			await wait(5);
			items.push({ id: `i${items.length}`, name, granted: { source } });
		};
		return { items, grant };
	};
	it("sem fila, três concessões ao mesmo tempo duplicam (o defeito original)", async () => {
		const a = makeActor();
		await Promise.all([a.grant("Fôlego de Nadador", "o1"), a.grant("Fôlego de Nadador", "o2"), a.grant("Fôlego de Nadador", "o3")]);
		assert.equal(a.items.length, 3);
	});
	it("com a fila por ficha, três concessões ao mesmo tempo criam uma só", async () => {
		const a = makeActor();
		const run = createTaskQueue();
		await Promise.all([run("ficha", () => a.grant("Fôlego de Nadador", "o1")), run("ficha", () => a.grant("Fôlego de Nadador", "o2")), run("ficha", () => a.grant("Fôlego de Nadador", "o3"))]);
		assert.equal(a.items.length, 1);
	});
});

describe("limpeza de duplicatas concedidas", () => {
	const g = (id, name, source) => ({ id, name, granted: source ? { source } : null });
	it("mantém a primeira e devolve as repetidas da mesma origem", () => {
		assert.deepEqual(duplicateGrantIds([g("1", "Fôlego de Nadador", "o"), g("2", "Fôlego de Nadador", "o"), g("3", "Fôlego de Nadador", "o")]), ["2", "3"]);
	});
	it("ignora acentos e maiúsculas no nome", () => {
		assert.deepEqual(duplicateGrantIds([g("1", "Fôlego de Nadador", "o"), g("2", "FOLEGO DE NADADOR", "o")]), ["2"]);
	});
	it("o mesmo nome vindo de origens diferentes não é duplicata", () => {
		assert.deepEqual(duplicateGrantIds([g("1", "Poder", "a"), g("2", "Poder", "b")]), []);
	});
	it("o que o jogador pôs à mão (sem marca de concessão) nunca é removido", () => {
		assert.deepEqual(duplicateGrantIds([g("1", "Poder", null), g("2", "Poder", null), g("3", "Poder", "a")]), []);
	});
	it("sem duplicatas devolve vazio", () => {
		assert.deepEqual(duplicateGrantIds([g("1", "A", "x"), g("2", "B", "x")]), []);
	});
});

describe("o código da concessão usa a fila", () => {
	const src = fs.readFileSync(path.resolve(import.meta.dirname, "../../module/helpers/level-progression.mjs"), "utf8");
	it("hook da origem, migração, trilha e remoção passam pela fila única", () => {
		assert.match(src, /createTaskQueue\(\)/);
		assert.equal((src.match(/grantEntries\(/g) ?? []).length, 4, "grantEntries só na definição, na origem, na trilha e na classe");
		assert.ok(!/await originPowerEntry\(item\)/.test(src), "o hook não concede fora da fila");
		assert.match(src, /function removeGranted[\s\S]*enqueue\(/);
		assert.match(src, /export function grantOriginPower/);
	});
	it("a concessão confere duplicatas depois de criar", () => {
		assert.match(src, /await dropDuplicateGrants\(actor\)/);
	});
});
