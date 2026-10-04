// Rodar: npm test. Regras puras da spec de experiência do jogador (docs/spec-experiencia-jogador.md).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeD20Pool } from "../../module/helpers/dice-labels.mjs";
import { canApplyDamage, damageStateKey, validateCardDamageRequest } from "../../module/helpers/card-damage-rules.mjs";
import { shouldDisplayMessage } from "../../module/components/message-visibility.mjs";
import { shouldNoticeChatMessage } from "../../module/helpers/chat-notice.mjs";

describe("describeD20Pool", () => {
	it("troca kh/kl por texto de jogador", () => {
		assert.equal(describeD20Pool("3d20kh"), "3 dados, vale o maior");
		assert.equal(describeD20Pool("2d20kl"), "2 dados, vale o menor");
		assert.equal(describeD20Pool("3d20kh + 5"), "3 dados, vale o maior + 5");
		assert.equal(describeD20Pool("1d20"), "1 dado");
	});
	it("não mexe em fórmulas que não são de teste d20", () => {
		assert.equal(describeD20Pool("2d6 + 3"), "2d6 + 3");
		assert.equal(describeD20Pool("2d4+3"), "2d4+3");
	});
});

describe("canApplyDamage", () => {
	const base = { viewerId: "u1", authorId: "u1", mode: "attacker-click" };
	it("GM sempre pode", () => {
		assert.equal(canApplyDamage({ ...base, viewerIsGM: true, viewerId: "gm", mode: "manual-gm" }), true);
	});
	it("autor pode no modo attacker-click e auto", () => {
		assert.equal(canApplyDamage({ ...base, viewerIsGM: false }), true);
		assert.equal(canApplyDamage({ ...base, viewerIsGM: false, mode: "auto" }), true);
	});
	it("autor não pode no modo manual-gm; outro jogador nunca", () => {
		assert.equal(canApplyDamage({ ...base, viewerIsGM: false, mode: "manual-gm" }), false);
		assert.equal(canApplyDamage({ ...base, viewerIsGM: false, viewerId: "u2" }), false);
	});
});

describe("validateCardDamageRequest", () => {
	const ok = {
		sender: { isGM: false, id: "u1" },
		message: { authorId: "u1", damageTarget: { actorUuid: "Actor.x" }, damageApplied: null },
		attackHit: { hit: true, revealed: true },
		mode: "attacker-click",
		senderOwnsAttacker: true,
	};
	it("aceita o autor com ataque que acertou", () => {
		assert.deepEqual(validateCardDamageRequest(ok), { ok: true });
	});
	it("recusa: já aplicado, sem alvo, outro usuário, não dono, ataque errado ou pendente, modo manual", () => {
		const bad = (patch) => validateCardDamageRequest({ ...ok, ...patch }).reason;
		assert.equal(bad({ message: { ...ok.message, damageApplied: { at: 1 } } }), "already-applied");
		assert.equal(bad({ message: { ...ok.message, damageTarget: null } }), "no-target");
		assert.equal(bad({ sender: { isGM: false, id: "u2" } }), "not-author");
		assert.equal(bad({ senderOwnsAttacker: false }), "not-owner");
		assert.equal(bad({ attackHit: { hit: false, revealed: true } }), "not-hit");
		assert.equal(bad({ attackHit: { hit: true, revealed: false } }), "not-hit");
		assert.equal(bad({ attackHit: null }), "no-attack");
		assert.equal(bad({ mode: "manual-gm" }), "mode");
	});
	it("GM passa sem checar o ataque, mas não reaplica", () => {
		const gm = { ...ok, sender: { isGM: true, id: "gm" }, attackHit: null, senderOwnsAttacker: false };
		assert.deepEqual(validateCardDamageRequest(gm), { ok: true });
		assert.equal(validateCardDamageRequest({ ...gm, message: { ...ok.message, damageApplied: {} } }).reason, "already-applied");
	});
	it("volley: basta um golpe revelado que acertou", () => {
		const volley = { attackResults: [{ hit: false, revealed: true }, { hit: true, revealed: true }] };
		assert.equal(validateCardDamageRequest({ ...ok, attackHit: volley }).ok, true);
	});
});

describe("damageStateKey", () => {
	it("faixas por PV restante", () => {
		assert.equal(damageStateKey(60, 70), "felt");
		assert.equal(damageStateKey(30, 70), "hurt");
		assert.equal(damageStateKey(10, 70), "veryHurt");
		assert.equal(damageStateKey(0, 70), "down");
	});
});

describe("shouldDisplayMessage (notas de versão)", () => {
	const msg = { title: "8.0.2", display: "once" };
	it("jogador não recebe nota do GM", () => {
		assert.equal(shouldDisplayMessage(msg, { isGM: false, patchNotesDisabled: false, seenTitles: [] }), false);
	});
	it("GM vê uma vez só", () => {
		assert.equal(shouldDisplayMessage(msg, { isGM: true, patchNotesDisabled: false, seenTitles: [] }), true);
		assert.equal(shouldDisplayMessage(msg, { isGM: true, patchNotesDisabled: false, seenTitles: ["8.0.2"] }), false);
	});
	it("opção de desligar vale para todos", () => {
		assert.equal(shouldDisplayMessage(msg, { isGM: true, patchNotesDisabled: true, seenTitles: [] }), false);
	});
	it("audience all chega ao jogador", () => {
		assert.equal(
			shouldDisplayMessage({ ...msg, audience: "all" }, { isGM: false, patchNotesDisabled: false, seenTitles: [] }),
			true
		);
	});
});

describe("shouldNoticeChatMessage", () => {
	const base = { combatStarted: true, activeTab: "combat", authorId: "a", viewerId: "b", visible: true };
	it("avisa em combate quando o chat não está aberto", () => {
		assert.equal(shouldNoticeChatMessage(base), true);
	});
	it("não avisa com chat aberto, fora de combate, mensagem própria ou invisível", () => {
		assert.equal(shouldNoticeChatMessage({ ...base, activeTab: "chat" }), false);
		assert.equal(shouldNoticeChatMessage({ ...base, combatStarted: false }), false);
		assert.equal(shouldNoticeChatMessage({ ...base, authorId: "b" }), false);
		assert.equal(shouldNoticeChatMessage({ ...base, visible: false }), false);
	});
});

describe("arquivos de tradução", () => {
	it("nenhuma chave é prefixo de outra (o Foundry quebra o idioma inteiro)", async () => {
		const fs = await import("node:fs");
		const path = await import("node:path");
		for (const file of ["pt-BR.json", "en.json"]) {
			const lang = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../lang", file), "utf8"));
			for (const key of Object.keys(lang)) {
				const parts = key.split(".");
				for (let i = 1; i < parts.length; i++) {
					const prefix = parts.slice(0, i).join(".");
					assert.notEqual(typeof lang[prefix], "string", `${file}: "${prefix}" é texto e também prefixo de "${key}"`);
				}
			}
		}
	});
});

describe("onboarding do jogador", () => {
	it("avisa visão desligada só para token de jogador em cena com visão de token", async () => {
		const { tokenNeedsVisionWarning } = await import("../../module/helpers/player-onboarding.mjs");
		assert.equal(tokenNeedsVisionWarning({ sceneTokenVision: true, tokenSightEnabled: false, ownedByPlayer: true }), true);
		assert.equal(tokenNeedsVisionWarning({ sceneTokenVision: true, tokenSightEnabled: true, ownedByPlayer: true }), false);
		assert.equal(tokenNeedsVisionWarning({ sceneTokenVision: false, tokenSightEnabled: false, ownedByPlayer: true }), false);
		assert.equal(tokenNeedsVisionWarning({ sceneTokenVision: true, tokenSightEnabled: false, ownedByPlayer: false }), false);
	});
	it("enche só os recursos que ainda estão no valor inicial", async () => {
		const { resourcesToFill } = await import("../../module/helpers/player-onboarding.mjs");
		const system = {
			PV: { value: 5, max: 37 },
			PE: { value: 5, max: 0 },
			PD: { value: 12, max: 15 },
			SAN: { value: 5, max: 18 },
		};
		assert.deepEqual(resourcesToFill(system), { "system.PV.value": 37, "system.SAN.value": 18 });
	});
});

describe("canUndoDamage", async () => {
	const { canUndoDamage } = await import("../../module/helpers/card-damage-rules.mjs");
	const base = { isGM: true, now: 100_000, appliedAt: 90_000, currentPv: 15, pvAfter: 15 };
	it("GM dentro da janela e PV inalterado", () => {
		assert.deepEqual(canUndoDamage(base), { ok: true });
	});
	it("recusa jogador, janela vencida e PV alterado depois", () => {
		assert.equal(canUndoDamage({ ...base, isGM: false }).reason, "not-gm");
		assert.equal(canUndoDamage({ ...base, now: 90_000 + 121_000 }).reason, "expired");
		assert.equal(canUndoDamage({ ...base, currentPv: 10 }).reason, "changed");
	});
});

describe("Defesa oculta aos jogadores", async () => {
	const { shouldShowDefenseValue, stripDefenseFields, hasDefenseFields, gmDefenseValue } = await import(
		"../../module/helpers/visibility.mjs"
	);
	const { scrubDodgeText, deletionKeys } = await import("../../module/helpers/defense-privacy.mjs");
	it("só o mestre vê o número da Defesa, nem o dono do alvo", () => {
		assert.equal(shouldShowDefenseValue({ viewerIsGM: true }), true);
		assert.equal(shouldShowDefenseValue({ viewerIsGM: false, viewerOwnsTarget: true }), false);
		assert.equal(shouldShowDefenseValue({ viewerIsGM: false }), false);
	});
	it("stripDefenseFields remove o número, inclusive em volleys", () => {
		const hr = {
			hit: true,
			targetDefense: 15,
			baseDefense: 15,
			actorUuid: "Actor.x",
			attackResults: [{ hit: true, targetDefense: 15 }, { hit: false, baseDefense: 15 }],
		};
		assert.equal(hasDefenseFields(hr), true);
		const clean = stripDefenseFields(hr);
		assert.equal(hasDefenseFields(clean), false);
		assert.deepEqual(clean.attackResults, [{ hit: true }, { hit: false }]);
		assert.equal(clean.actorUuid, "Actor.x");
		assert.equal(hr.targetDefense, 15, "não altera o original");
	});
	it("gmDefenseValue: valor legado, senão Defesa atual + esquiva", () => {
		assert.equal(gmDefenseValue({ legacy: 12, live: 99 }), 12);
		assert.equal(gmDefenseValue({ legacy: null, live: 11, dodgeBonus: 4 }), 15);
		assert.equal(gmDefenseValue({ legacy: null, live: null }), null);
	});
	it("limpa o histórico: mensagem pública de esquiva antiga fica sem número", () => {
		const old = "<strong>Ana</strong> esquivou (+4 Reflexos): nova Defesa 15 → <strong>FALHA</strong>.";
		assert.equal(scrubDodgeText(old), "<strong>Ana</strong> esquivou: o ataque <strong>errou</strong>.");
		assert.equal(scrubDodgeText(old.replace("FALHA", "ACERTO")).includes("acertou"), true);
		assert.equal(scrubDodgeText("outra mensagem"), "outra mensagem");
	});
	it("deletionKeys apaga os dois campos", () => {
		assert.deepEqual(deletionKeys("flags.x.hitResult"), {
			"flags.x.hitResult.-=targetDefense": null,
			"flags.x.hitResult.-=baseDefense": null,
		});
	});
});

describe("aviso do mestre", async () => {
	const { gmNoticeHtml } = await import("../../module/helpers/gm-notice.mjs");
	it("uma linha com o rótulo Mestre e texto escapado", () => {
		assert.equal(gmNoticeHtml("QA1 aplicou 8 de dano"), '<p class="gm-notice-line"><strong>Mestre</strong> · QA1 aplicou 8 de dano</p>');
		assert.ok(gmNoticeHtml("<img src=x onerror=1> & co").includes("&lt;img src=x onerror=1&gt; &amp; co"));
	});
});
