import D20RollConfigurationDialog from "./d20-configuration-dialog.mjs";
import { peritoFor } from "../helpers/perito.mjs";
import { eclecticFor } from "../helpers/eclectic.mjs";
import { fearDieAvailable } from "../helpers/scars.mjs";
import { AFFINITY_ELEMENTS } from "../helpers/affinity-rules.mjs";

/**
 * @typedef {BasicRollConfigurationDialogOptions} SkillToolRollConfigurationDialogOptions
 * @property {boolean} chooseAbility  Should the ability be selectable?
 */

/**
 * Extended roll configuration dialog that allows selecting abilities.
 */
export default class SkillToolRollConfigurationDialog extends D20RollConfigurationDialog {
	/** @override */
	static DEFAULT_OPTIONS = {
		chooseAbility: true,
	};

	/* -------------------------------------------- */
	/*  Rendering                                   */
	/* -------------------------------------------- */

	/** @inheritDoc */
	async _prepareConfigurationContext(context, options) {
		context = await super._prepareConfigurationContext(context, options);
		if (this.options.chooseAbility)
			context.fields.unshift({
				field: new foundry.data.fields.StringField({
					label: game.i18n.localize("op.RollAttribute"),
					blank: false,
					required: true,
				}),
				name: "attribute",
				value: this.config.attributeId,
				options: Object.entries(CONFIG.op.attributes).map(([value, l]) => ({ value, label: game.i18n.localize(l) })),
			});
		const perito = this.config.skill ? peritoFor(this.config.subject, this.config.skill) : null;
		if (perito)
			context.fields.push({
				field: new foundry.data.fields.BooleanField({
					label: game.i18n.format("op.perito.label", { pe: perito.pe, die: perito.die, resource: perito.resource }),
					hint: perito.canPay ? "" : game.i18n.format("op.attackDialog.noBalance", { cost: perito.pe, balance: perito.pe - perito.missing, resource: perito.resource }),
				}),
				name: "perito",
				value: false,
			});
		const actor = this.config.subject;
		if (actor?.type === "agent" && fearDieAvailable({ withoutSanity: actor.usingWithoutSanityRule, names: actor.items.filter((i) => i.type === "ability").map((i) => i.name), skill: this.config.skill }))
			context.fields.push({
				field: new foundry.data.fields.BooleanField({ label: "Contra efeito de medo (Cicatrizes Psicológicas): +1 dado" }),
				name: "fear",
				value: false,
			});
		// Afinidade: o elemento do efeito que originou o teste (vem preenchido do ritual) dá +1 dado ou -1 dado
		if (actor?.type === "agent" && actor.system.paranormal?.affinity)
			context.fields.push({
				field: new foundry.data.fields.StringField({ label: "Contra efeito de…", hint: "Afinidade: +1 dado contra o seu elemento; -1 dado contra o elemento que o oprime.", blank: true }),
				name: "effectElement",
				value: this.config.effectElement ?? "",
				options: [{ value: "", label: "—" }].concat(Object.entries(AFFINITY_ELEMENTS).map(([value, { label }]) => ({ value, label }))),
			});
		const eclectic = this.config.skill ? eclecticFor(this.config.subject, this.config.skill) : [];
		if (eclectic.length)
			context.fields.push({
				field: new foundry.data.fields.StringField({ label: "Eclético: testar como…", hint: "Gasta PE e vale só para este teste; a ficha não muda.", blank: true }),
				name: "eclectic",
				value: "",
				options: [{ value: "", label: "—" }].concat(eclectic.map((o) => ({ value: o.degree, label: `${o.label} (${o.pe} ${o.resource})${o.canPay ? "" : " — sem saldo"}` }))),
			});
		context.fields.push({
			field: new foundry.data.fields.NumberField({
				label: game.i18n.localize("op.rollDT"),
				nullable: true,
				integer: true,
				min: 0,
			}),
			name: "target",
			value: this.config.rolls?.[0]?.options?.target ?? null,
		});
		return context;
	}

	/* -------------------------------------------- */
	/*  Event Listeners and Handlers                */
	/* -------------------------------------------- */

	/** @inheritDoc */
	_onChangeForm(formConfig, event) {
		super._onChangeForm(formConfig, event);
		const formData = new FormDataExtended(this.form);
		const raw = formData.get("target");
		this._target = raw !== null && raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : undefined;
		for (const roll of this.rolls) {
			roll.options.target = this._target;
		}
		if (this.config.skill && event.target?.name === "attribute") {
			const skillLabel = game.i18n.localize(CONFIG.op.skills[this.config.skill] ?? "");
			const ability = event.target.value ?? this.config.subject.skills[this.config.skill]?.attr[0] ?? "";
			const abilityLabel = game.i18n.localize(CONFIG.op.attributes[ability] ?? "");
			const flavor = game.i18n.format("op.SkillPromptTitle", { skill: skillLabel, ability: abilityLabel });
			foundry.utils.setProperty(this.message, "data.flavor", flavor);
			this._updateFrame({ window: { title: flavor } });
		}
	}

	/** @inheritDoc */
	_finalizeRolls(action) {
		const rolls = super._finalizeRolls(action);
		if (this._target !== undefined) {
			for (const roll of rolls) roll.options.target = this._target;
		}
		return rolls;
	}
}
