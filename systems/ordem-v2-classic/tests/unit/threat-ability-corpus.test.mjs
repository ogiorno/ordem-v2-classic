import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { buildFixture, sha256, DEFAULT_SOURCE, FIXTURE_PATH } from "../../tools/build-threat-ability-fixture.mjs";

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
const abilities = fixture.creatures.flatMap((c) => c.abilities.map((a) => ({ ...a, creature: c.id })));
const attacks = fixture.creatures.flatMap((c) => c.attacks);

test("totais do corpus: 66 criaturas, 166 habilidades, 88 ataques", () => {
  assert.equal(fixture.creatures.length, 66);
  assert.equal(abilities.length, 166);
  assert.equal(attacks.length, 88);
  assert.deepEqual(fixture.totals, { creatures: 66, abilities: 166, attacks: 88 });
});

test("ids de criaturas, habilidades e ataques são únicos e estáveis", () => {
  for (const list of [fixture.creatures, abilities, attacks]) {
    const ids = list.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length);
  }
  for (const a of abilities) assert.match(a.id, /^\d{4}-H\d{2}$/);
  for (const a of attacks) assert.match(a.id, /^\d{4}-A\d{2}$/);
  assert.equal(fixture.creatures[0].abilities[0].id, "1295-H01");
});

test("todo registro tem os campos exigidos", () => {
  for (const c of fixture.creatures) {
    for (const key of ["id", "slug", "name", "sourceFile", "sourceHash"]) assert.ok(c[key], `${c.id} sem ${key}`);
    assert.match(c.sourceHash, /^[0-9a-f]{64}$/);
  }
  for (const a of abilities) {
    for (const key of ["name", "activation", "description", "normalizedDescription", "source", "hash"]) {
      assert.ok(a[key], `${a.id} sem ${key}`);
    }
    assert.equal(a.hash, sha256(`${a.name}\n${a.activation}\n${a.description}`));
    assert.doesNotMatch(a.normalizedDescription, /\s{2,}/);
  }
});

test("seis fichas sem ability separada estão anotadas", () => {
  const semAbility = fixture.creatures.filter((c) => !c.abilities.length).map((c) => c.id);
  assert.deepEqual(semAbility, ["1363", "1366", "1404", "1522", "1597", "1612"]);
  for (const c of fixture.creatures.filter((x) => !x.abilities.length)) {
    assert.ok(c.warnings.some((w) => w.startsWith("sem-ability-separada")), c.id);
    assert.ok(c.attacks.length > 0, `${c.id} deveria ter ataques`);
  }
});

test("ataques ficam separados das habilidades, sem duplicação", () => {
  const abilityNames = new Set(abilities.map((a) => `${a.creature}|${a.name}`));
  for (const c of fixture.creatures) {
    for (const atk of c.attacks) assert.ok(!abilityNames.has(`${c.id}|${atk.name}`), `${c.id} ${atk.name} duplicado`);
    assert.equal(new Set(c.attacks.map((a) => a.name)).size, c.attacks.length, `${c.id} ataques repetidos`);
  }
});

test("hash do corpus é determinístico", () => {
  assert.equal(fixture.corpusHash, sha256(JSON.stringify(fixture.creatures)));
});

test("fixture em dia com a extração local (quando disponível)", { skip: !existsSync(DEFAULT_SOURCE) }, () => {
  const rebuilt = buildFixture(DEFAULT_SOURCE);
  assert.equal(rebuilt.corpusHash, fixture.corpusHash, "a fonte mudou: rode tools/build-threat-ability-fixture.mjs e revise");
  assert.equal(JSON.stringify(rebuilt), JSON.stringify(fixture));
});
