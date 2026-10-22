// Gera o relatório de fechamento de um lote C0x: matriz por habilidade + resultado do teste de interface.
// Uso: node tools/report-threat-ability-batch.mjs C01 <resultado-ui.json> <pasta-saida> [<md-do-lote>]
// Se o md do lote for informado, marca as caixas das habilidades concluídas e acrescenta o estado.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const [batch, uiPath, outDir, mdPath] = process.argv.slice(2);
if (!batch || !uiPath || !outDir) { console.error("uso: C01 resultado-ui.json pasta-saida [md]"); process.exit(2); }
const sys = resolve(import.meta.dirname, "..");
const configs = JSON.parse(readFileSync(resolve(sys, "fixtures/threat-ability-configs-v1-3.json"), "utf8"));
const ui = JSON.parse(readFileSync(uiPath, "utf8"));
const uiBy = new Map(ui.results.map((r) => [r.id, r]));
const mine = configs.abilities.filter((a) => a.batch === batch);

const label = { automatic: "automática", assisted: "assistida", manual: "manual" };
const cell = (s) => String(s ?? "").replace(/\|/g, "/").replace(/\s+/g, " ").trim();
const ex = (a) => a.execution;
const target = (a) => (ex(a)?.targeting ? `${ex(a).targeting.kind}${ex(a).targeting.range != null ? ` ${ex(a).targeting.range} m` : ""}${ex(a).area ? ` · ${ex(a).area.shape} ${[ex(a).area.length, ex(a).area.width, ex(a).area.radius].filter((x) => x).join("×")} m` : ""}` : "—");
const gate = (a) => (ex(a) ? [ex(a).trigger ? `gatilho ${ex(a).trigger.event}` : "", ...ex(a).requirements.map((r) => r.kind + (r.count ? ` ${r.count}` : "") + (r.text ? ` (${r.text})` : r.ref ? ` (${r.ref})` : ""))].filter(Boolean).join("; ") || "—" : "—");
const saveText = (a) => (ex(a)?.save ? `${ex(a).save.skill} DT ${ex(a).save.dc}, sucesso: ${ex(a).save.onSuccess}${ex(a).save.retry ? ", repete" : ""}` : "—");
const dmgText = (a) => (ex(a)?.damage.length ? ex(a).damage.map((d) => `${d.kind === "heal" ? "cura " : ""}${d.formula} ${d.type || ""} (${d.resource})`.trim()).join("; ") : "—");
const fxText = (a) => (ex(a)?.effects.length ? ex(a).effects.map((e) => `${e.condition} ${e.duration.value ?? ""} ${e.duration.unit} [${e.onSave}${e.support === "marker" ? ", manual" : ""}]`).join("; ") : "—");
const uiText = (r) => (r ? (r.ok ? `OK (${r.steps.join("; ")})` : `FALHA: ${r.error ?? (r.issues ?? []).join("; ")}`) : "não executado");

mkdirSync(outDir, { recursive: true });
const counts = { automatic: 0, assisted: 0, manual: 0 };
for (const a of mine) counts[a.state]++;
const uiOk = mine.filter((a) => uiBy.get(a.id)?.ok).length;
let md = `# ${batch} — resultados\n\nGerado em ${new Date().toISOString()} por tools/report-threat-ability-batch.mjs.\n\n`;
md += `- Habilidades: **${mine.length}** (${counts.automatic} automáticas, ${counts.assisted} assistidas, ${counts.manual} manuais)\n`;
md += `- Teste unitário individual: um teste por habilidade em \`tests/unit/threat-ability-configs.test.mjs\` (nome: \`<id> <criatura> — <habilidade> [<estado>]\`)\n`;
md += `- Teste no Foundry pela interface: **${uiOk}/${mine.length}** OK (botão Usar da ficha, diálogos, mira, painel e aplicação; manuais: sem Usar + Mostrar no chat)\n`;
md += `- Fonte: regra extraída conferida contra a configuração por teste (DT, fórmulas, condições, durações, alcance). **Conferência no PDF do livro continua pendente** (\`source.reviewed = false\`); testes humanos de mesa não foram feitos.\n\n`;
md += "| ID | Criatura | Habilidade | Ação | Estado | Alvo/alcance/área | Gatilho/limite/pré-req. | Resistência | Dano/recurso | Condições/duração | Lacunas (manual) | UI |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n";
for (const a of mine) {
	md += `| ${a.id} | ${cell(a.creature)} | ${cell(a.name)} | ${a.activation} | ${label[a.state]} | ${cell(target(a))} | ${cell(gate(a))} | ${cell(saveText(a))} | ${cell(dmgText(a))} | ${cell(fxText(a))} | ${cell(a.gaps.join("; ")) || "—"} | ${cell(uiText(uiBy.get(a.id)))} |\n`;
}
md += "\n## Motivo do estado\n\n";
for (const a of mine) md += `- **${a.id} ${cell(a.name)}** (${label[a.state]}): ${cell(a.why)}${a.notes.length ? ` _Notas:_ ${cell(a.notes.join(" "))}` : ""}\n`;
writeFileSync(resolve(outDir, `${batch}-resultados.md`), md);
writeFileSync(resolve(outDir, `${batch}-ui.json`), JSON.stringify(ui, null, 1));

if (mdPath) {
	let text = readFileSync(mdPath, "utf8");
	const nl = text.includes("\r\n") ? "\r\n" : "\n";
	const lines = text.split(/\r?\n/);
	let creature = null, index = 0;
	const byCreature = new Map();
	for (const a of mine) (byCreature.get(a.creatureId) ?? byCreature.set(a.creatureId, []).get(a.creatureId)).push(a);
	for (let i = 0; i < lines.length; i++) {
		const h = lines[i].match(/^### .* — ID (\d+)/);
		if (h) { creature = h[1]; index = 0; continue; }
		if (creature && /^- \[[ x]\] \*\*/.test(lines[i])) {
			const a = byCreature.get(creature)?.[index++];
			if (!a) continue;
			const r = uiBy.get(a.id);
			const base = lines[i].replace(/^- \[[ x]\]/, "").replace(/ — \*\*Fechado:.*$/, "");
			lines[i] = `- [${r?.ok ? "x" : " "}]${base} — **Fechado:** ${a.id}, estado **${label[a.state]}**; unitário \`threat-ability-configs.test.mjs\`; UI ${r?.ok ? "OK" : "PENDENTE"}.`;
		}
	}
	writeFileSync(mdPath, lines.join(nl));
}
console.log(`${batch}: ${mine.length} habilidades, UI ${uiOk}/${mine.length}`);
