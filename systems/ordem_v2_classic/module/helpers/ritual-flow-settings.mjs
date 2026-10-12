// Configurações do fluxo de conjuração rápida (docs/arquivo/spec-fluxo-conjuracao-rapida.md, seção 8).

const SYSTEM = "ordem_v2_classic";

export const FLOW_SETTING = Object.freeze({
	confirmSpend: "conjuracaoConfirmarGasto",
	nameClick: "conjuracaoCliqueNoNome",
	advancedOpen: "conjuracaoAjustesAbertos",
	sound: "conjuracaoSom",
	areaApply: "conjuracaoAreaAplicacao",
});

const DEFAULTS = Object.freeze({
	[FLOW_SETTING.confirmSpend]: true,
	[FLOW_SETTING.nameClick]: "cast",
	[FLOW_SETTING.advancedOpen]: false,
	[FLOW_SETTING.sound]: false,
	[FLOW_SETTING.areaApply]: "manual",
});

/** Lê a configuração; se ainda não estiver registrada (testes, carga inicial) devolve o padrão. */
export function flowSetting(key) {
	try {
		return game.settings.get(SYSTEM, key);
	} catch {
		return DEFAULTS[key];
	}
}

export function registerRitualFlowSettings() {
	const register = (key, data) => game.settings.register(SYSTEM, key, { default: DEFAULTS[key], ...data });
	register(FLOW_SETTING.confirmSpend, {
		name: "SETTINGS.flowConfirmSpend", hint: "SETTINGS.flowConfirmSpendHint", scope: "client", config: true, type: Boolean,
	});
	register(FLOW_SETTING.nameClick, {
		name: "SETTINGS.flowNameClick", hint: "SETTINGS.flowNameClickHint", scope: "client", config: true, type: String,
		choices: { cast: "SETTINGS.flowNameClickCast", describe: "SETTINGS.flowNameClickDescribe" },
	});
	register(FLOW_SETTING.advancedOpen, { scope: "client", config: false, type: Boolean });
	register(FLOW_SETTING.sound, {
		name: "SETTINGS.flowSound", hint: "SETTINGS.flowSoundHint", scope: "client", config: true, type: Boolean,
	});
	register(FLOW_SETTING.areaApply, {
		name: "SETTINGS.flowAreaApply", hint: "SETTINGS.flowAreaApplyHint", scope: "world", config: true, type: String,
		choices: { manual: "SETTINGS.flowAreaApplyManual", automatic: "SETTINGS.flowAreaApplyAutomatic" },
	});
}
