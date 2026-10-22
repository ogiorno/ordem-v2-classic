// Modelo de exibição do painel (puro): recebe o painel salvo e um tradutor `t(chave, dados)`.
import { ROW_STATE, canApply, effectiveAmount, pendingCount, rowEdited } from "./threat-ability-panel.mjs";

const RESOURCE = { pv: "PV", san: "SAN", pe: "PE", other: "—" };

function changeLabel(change, t) {
	if (!change.supported) return t("op.threatPanel.unsupported", { reason: change.reason ?? "" });
	const kind = change.kind === "heal" ? t("op.threatPanel.heal") : t("op.threatPanel.damage");
	const type = change.type ? ` (${change.type.replace("Damage", "")})` : "";
	return `${kind} ${RESOURCE[change.resource] ?? change.resource}${type}`;
}

function effectLabel(fx, t) {
	if (!fx.applies) return null;
	const where = fx.durationRounds ? t("op.threatPanel.rounds", { n: fx.durationRounds }) : fx.durationKind === "scene" ? t("op.threatPanel.untilSceneEnd") : fx.durationKind === "untilSaved" ? t("op.threatPanel.untilSaved") : fx.durationKind === "unspecified" ? t("op.threatPanel.unspecified") : "";
	return { label: fx.condition?.label ?? "", duration: where, manual: !!fx.manual, manualText: fx.manual ? t("op.threatPanel.manualEffect") : "" };
}

export function buildPanelView(panel, t) {
	const rows = panel.rows.map((row, index) => {
		const save = row.save && row.save.attempts?.length
			? { text: t("op.threatPanel.saveLine", { skill: row.save.skill ?? row.save.skillLabel ?? "", total: row.save.attempts.at(-1).total ?? "—", dc: row.save.dc ?? "—" }), passed: row.save.passed, resultLabel: row.save.passed === null ? t("op.threatPanel.saveManual") : row.save.passed ? t("op.threatPanel.passed") : t("op.threatPanel.failed"), mode: t(`op.threatPanel.mode.${row.save.mode ?? "full"}`) }
			: null;
		return {
			index, name: row.name, img: row.img, state: row.state, stateLabel: t(`op.threatPanel.state.${row.state}`),
			save,
			changes: row.changes.map((c, i) => ({
				index: i, label: changeLabel(c, t), supported: c.supported, original: c.original, amount: effectiveAmount(c),
				edited: c.edited !== null && c.edited !== undefined && c.edited !== c.original, editable: canApply(row) && c.supported,
				before: c.before ?? null, after: c.after ?? null
			})),
			effects: row.effects.map((fx) => effectLabel(fx, t)).filter(Boolean),
			notes: [...(row.notes ?? []), ...(row.disabledReason ? [row.disabledReason] : [])],
			applied: row.applied ? { records: row.applied.records.filter((r) => r.supported).map((r) => ({ resource: RESOURCE[r.resource] ?? r.resource, before: r.before, after: r.after })) } : null,
			canApply: row.state === ROW_STATE.PENDING, canIgnore: row.state === ROW_STATE.PENDING,
			canUndo: row.state === ROW_STATE.APPLIED, canRestore: row.state === ROW_STATE.IGNORED || row.state === ROW_STATE.DISABLED,
			isEdited: rowEdited(row)
		};
	});
	const pending = pendingCount(panel.rows);
	return { itemName: panel.itemName, sourceName: panel.sourceName, rows, pending, applyAllDisabled: pending === 0, empty: rows.length === 0 };
}
