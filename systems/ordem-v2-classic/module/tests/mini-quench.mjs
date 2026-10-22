// Mini executor de suites Quench para rodar SEM o módulo Quench.
// Uso (console do navegador, dentro do mundo, como GM):
//   await import("/systems/ordem-v2-classic/module/tests/mini-quench.mjs"); depois: await miniQuench("/systems/ordem-v2-classic/module/tests/suites/threat-sheet-book.test.mjs")
// Suporta o subconjunto de mocha/chai que as suites do sistema usam (describe/it/before/after/beforeEach/afterEach + assert básico).
window.miniQuench = async function miniQuench(path) {
	const fail = (msg) => { throw new Error(msg); };
	const same = (a, b) => foundry.utils.objectsEqual(a, b);
	const assert = {
		ok: (v, m) => v || fail(m ?? `esperava valor verdadeiro, veio ${JSON.stringify(v)}`),
		equal: (a, b, m) => a == b || fail(m ?? `esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`),
		strictEqual: (a, b, m) => a === b || fail(m ?? `esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`),
		notEqual: (a, b, m) => a != b || fail(m ?? `esperava diferente de ${JSON.stringify(b)}`),
		deepEqual: (a, b, m) => same(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null))) || fail(m ?? `esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`),
		match: (s, re, m) => re.test(s) || fail(m ?? `${JSON.stringify(s)} não casa com ${re}`),
		isNull: (v, m) => v === null || fail(m ?? `esperava null, veio ${JSON.stringify(v)}`),
		isAbove: (a, b, m) => a > b || fail(m ?? `esperava ${a} > ${b}`),
		isBelow: (a, b, m) => a < b || fail(m ?? `esperava ${a} < ${b}`),
		isAtLeast: (a, b, m) => a >= b || fail(m ?? `esperava ${a} >= ${b}`),
		isAtMost: (a, b, m) => a <= b || fail(m ?? `esperava ${a} <= ${b}`),
		isTrue: (v, m) => v === true || fail(m ?? `esperava true, veio ${JSON.stringify(v)}`),
		isFalse: (v, m) => v === false || fail(m ?? `esperava false, veio ${JSON.stringify(v)}`),
		notOk: (v, m) => !v || fail(m ?? `esperava valor falso, veio ${JSON.stringify(v)}`),
		isNotNull: (v, m) => v !== null || fail(m ?? "esperava não-null"),
		isUndefined: (v, m) => v === undefined || fail(m ?? `esperava undefined, veio ${JSON.stringify(v)}`),
		isDefined: (v, m) => v !== undefined || fail(m ?? "esperava definido"),
		exists: (v, m) => (v !== null && v !== undefined) || fail(m ?? "esperava existir"),
		notExists: (v, m) => v === null || v === undefined || fail(m ?? "esperava não existir"),
		isNumber: (v, m) => typeof v === "number" || fail(m ?? `esperava number, veio ${typeof v}`),
		isString: (v, m) => typeof v === "string" || fail(m ?? `esperava string, veio ${typeof v}`),
		isArray: (v, m) => Array.isArray(v) || fail(m ?? "esperava array"),
		isObject: (v, m) => (v !== null && typeof v === "object") || fail(m ?? "esperava objeto"),
		isFunction: (v, m) => typeof v === "function" || fail(m ?? "esperava função"),
		instanceOf: (v, C, m) => v instanceof C || fail(m ?? `esperava instância de ${C?.name}`),
		lengthOf: (v, n, m) => v?.length === n || fail(m ?? `esperava length ${n}, veio ${v?.length}`),
		property: (o, k, m) => (o != null && k in Object(o)) || fail(m ?? `esperava propriedade ${k}`),
		include: (c, x, m) =>
			(typeof c === "string" || Array.isArray(c) ? c.includes(x) : Object.entries(x).every(([k, v]) => c?.[k] === v)) ||
			fail(m ?? `${JSON.stringify(c)} não inclui ${JSON.stringify(x)}`),
		notInclude: (c, x, m) => !c?.includes?.(x) || fail(m ?? `${JSON.stringify(c)} não deveria incluir ${JSON.stringify(x)}`),
		sameMembers: (a, b, m) => same([...a].map(String).sort(), [...b].map(String).sort()) || fail(m ?? "membros diferentes"),
		throws: (f, m) => {
			try {
				f();
			} catch (_) {
				return true;
			}
			return fail(m ?? "esperava exceção");
		},
	};
	assert.deepStrictEqual = assert.deepEqual;
	assert.isNotOk = assert.notOk;

	const newSuite = (name, parent = null) => ({ name, parent, before: [], after: [], beforeEach: [], afterEach: [], children: [] });
	const batches = [];
	const quench = {
		registerBatch(name, fn) {
			const root = newSuite(name);
			let cur = root;
			fn({
				describe: (n, f) => { const s = newSuite(n, cur); cur.children.push(s); const prev = cur; cur = s; f(); cur = prev; },
				it: (n, f) => cur.children.push({ test: true, name: n, fn: f }),
				before: (f) => cur.before.push(f),
				after: (f) => cur.after.push(f),
				beforeEach: (f) => cur.beforeEach.push(f),
				afterEach: (f) => cur.afterEach.push(f),
				assert,
			});
			batches.push(root);
		},
	};

	await import(`${path}?t=${Date.now()}`);
	Hooks.callAll("quenchReady", quench);

	const results = [];
	const chain = (s) => { const out = []; for (let x = s; x; x = x.parent) out.unshift(x); return out; };
	const call = async (fns) => { for (const f of fns) await f(); };
	const runSuite = async (s) => {
		try { await call(s.before); } catch (e) { results.push({ name: `${s.name} [before]`, ok: false, error: e.message }); return; }
		for (const c of s.children) {
			if (!c.test) { await runSuite(c); continue; }
			const full = chain(s).map((x) => x.name).join(" › ") + " › " + c.name;
			try {
				for (const a of chain(s)) await call(a.beforeEach);
				await c.fn();
				results.push({ name: full, ok: true });
			} catch (e) {
				results.push({ name: full, ok: false, error: e.message });
			} finally {
				for (const a of chain(s).reverse()) { try { await call(a.afterEach); } catch (_) { /* ignora */ } }
			}
		}
		try { await call(s.after); } catch (e) { results.push({ name: `${s.name} [after]`, ok: false, error: e.message }); }
	};
	for (const b of batches) await runSuite(b);

	const failed = results.filter((r) => !r.ok);
	return { total: results.length, passed: results.length - failed.length, failed: failed.length, failures: failed };
};
