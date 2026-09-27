import { calculateSkillProficiency } from "../../helpers/actor-calculations.mjs";
import {
	bruisedThreshold,
	fixLegacySkillAttrs,
	formatTest,
	formatTestHtml,
	isBruised,
	movementLabel,
	sizeInfo,
	squaresFromMeters,
	testFormula,
	totalBonus,
} from "../../helpers/threat-calc.mjs";

const defaultAttrs = {
	fighting: "str",
	aim: "dex",
	resilience: "vit",
	reflexes: "dex",
	will: "pre",
	initiative: "dex",
	perception: "pre",
	freeSkill: "int",
};

function skillField(defaultAttr = "dex") {
	const fields = foundry.data.fields;
	return new fields.SchemaField({
		value: new fields.NumberField({ required: true, integer: true, initial: 0 }),
		attr: new fields.ArrayField(new fields.StringField(), { initial: [defaultAttr] }),
		degree: new fields.SchemaField({
			label: new fields.StringField({ initial: "untrained" }),
			// `value` is *derived* from `label` by default (calculateSkillProficiency),
			// or from `override` when the GM wants an arbitrary number (homebrew /
			// non-standard stat blocks). Both fields are stored; the override wins
			// in prepareDerivedData. Setting override to null restores the derived
			// behaviour.
			value: new fields.NumberField({ required: true, integer: true, initial: 0 }),
			override: new fields.NumberField({
				required: false,
				nullable: true,
				integer: true,
				initial: null,
			}),
		}),
	});
}

function freeSkillField() {
	const fields = foundry.data.fields;
	return new fields.SchemaField({
		value: new fields.NumberField({ required: true, integer: true, initial: 0 }),
		name: new fields.StringField({ initial: "" }),
		attr: new fields.ArrayField(new fields.StringField(), { initial: ["int"] }),
		degree: new fields.SchemaField({
			label: new fields.StringField({ initial: "untrained" }),
			value: new fields.NumberField({ required: true, integer: true, initial: 0 }),
			override: new fields.NumberField({
				required: false,
				nullable: true,
				integer: true,
				initial: null,
			}),
		}),
	});
}

function resistanceField() {
	const fields = foundry.data.fields;
	return new fields.SchemaField({
		value: new fields.NumberField({ integer: true, initial: 0 }),
		vulnerable: new fields.BooleanField({ initial: false }),
		immune: new fields.BooleanField({ initial: false }),
	});
}

export class ThreatData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const fields = foundry.data.fields;
		return {
			attributes: new fields.SchemaField({
				hp: new fields.SchemaField({
					value: new fields.NumberField({ required: true, integer: true, initial: 10 }),
					max: new fields.NumberField({ required: true, integer: true, initial: 10 }),
				}),
				dex: new fields.SchemaField({ value: new fields.NumberField({ integer: true, initial: 1 }) }),
				int: new fields.SchemaField({ value: new fields.NumberField({ integer: true, initial: 1 }) }),
				pre: new fields.SchemaField({ value: new fields.NumberField({ integer: true, initial: 1 }) }),
				str: new fields.SchemaField({ value: new fields.NumberField({ integer: true, initial: 1 }) }),
				vit: new fields.SchemaField({ value: new fields.NumberField({ integer: true, initial: 1 }) }),
				movement: new fields.SchemaField({
					walk: new fields.NumberField({ integer: false, initial: 0 }),
					unit: new fields.StringField({ initial: "m" }),
					squares: new fields.NumberField({ integer: true, initial: 0 }),
				}),
				vd: new fields.SchemaField({
					value: new fields.NumberField({ integer: true, initial: 0 }),
				}),
			}),
			attacks: new fields.ObjectField({ initial: {} }),
			skills: new fields.SchemaField({
				fighting: skillField(defaultAttrs.fighting),
				aim: skillField(defaultAttrs.aim),
				resilience: skillField(defaultAttrs.resilience),
				reflexes: skillField(defaultAttrs.reflexes),
				will: skillField(defaultAttrs.will),
				initiative: skillField(defaultAttrs.initiative),
				perception: skillField(defaultAttrs.perception),
				freeSkill: freeSkillField(),
			}),
			elements: new fields.SchemaField({
				main: new fields.StringField({ initial: "" }),
				others: new fields.StringField({ initial: "" }),
			}),
			abilities: new fields.ArrayField(new fields.ObjectField()),
			size: new fields.StringField({ initial: "" }),
			disturbingPresence: new fields.SchemaField({
				dt: new fields.NumberField({ integer: true, initial: 0 }),
				mentalDamage: new fields.StringField({ initial: "" }),
				immuneNex: new fields.NumberField({ integer: true, initial: 0 }),
			}),
			senses: new fields.ArrayField(new fields.StringField()),
			defense: new fields.SchemaField({
				value: new fields.NumberField({ integer: true, initial: 0 }),
				skillResistances: new fields.ArrayField(new fields.StringField()),
				damageResistances: new fields.StringField({ initial: "" }),
			}),
			vulnerabilities: new fields.StringField({ initial: "" }),
			actions: new fields.ArrayField(new fields.ObjectField()),
			details: new fields.SchemaField({
				description: new fields.HTMLField({ initial: "" }),
				fearRiddle: new fields.HTMLField({ initial: "" }),
				creatureType: new fields.StringField({ initial: "" }),
			}),
			temporary: new fields.SchemaField({
				abilities: new fields.StringField({ initial: "" }),
				senses: new fields.StringField({ initial: "" }),
				defense: new fields.SchemaField({
					skillResistances: new fields.StringField({ initial: "" }),
					damageResistances: new fields.StringField({ initial: "" }),
				}),
				vulnerabilities: new fields.StringField({ initial: "" }),
				actions: new fields.StringField({ initial: "" }),
				characteristics: new fields.StringField({ initial: "" }),
			}),
			resistances: new fields.SchemaField({
				cuttingDamage: resistanceField(),
				impactDamage: resistanceField(),
				piercingDamage: resistanceField(),
				ballisticDamage: resistanceField(),
				fireDamage: resistanceField(),
				eletricDamage: resistanceField(),
				coldDamage: resistanceField(),
				chemicalDamage: resistanceField(),
				mentalDamage: resistanceField(),
				bloodDamage: resistanceField(),
				deathDamage: resistanceField(),
				knowledgeDamage: resistanceField(),
				energyDamage: resistanceField(),
				fearDamage: resistanceField(),
				damageDamage: resistanceField(),
			}),
			// Perícias além das cinco do bloco de defesa/sentidos (ex.: Crime 2O+5). Dados = atributo, salvo override.
			extraSkills: new fields.ArrayField(
				new fields.SchemaField({
					// Chave de perícia do sistema (ex.: "athleticism"); vazio = perícia personalizada (usa `name`).
					key: new fields.StringField({ initial: "" }),
					name: new fields.StringField({ initial: "" }),
					attr: new fields.StringField({ initial: "dex" }),
					diceOverride: new fields.NumberField({ required: false, nullable: true, integer: true, min: 0, initial: null }),
					bonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
					// Buff/penalidade temporária somada ao bônus (magias, rituais, condições).
					buff: new fields.NumberField({ required: true, integer: true, initial: 0 }),
				})
			),
			// "RD N/tipo": reduz N de todo dano, exceto dos tipos em `except`.
			genericRd: new fields.SchemaField({
				value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
				except: new fields.ArrayField(new fields.StringField()),
			}),
			// "Cura Acelerada N/tipo": recupera N PV por turno, salvo após dano dos tipos em `except`.
			fastHealing: new fields.SchemaField({
				value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
				except: new fields.ArrayField(new fields.StringField()),
			}),
			traits: new fields.SchemaField({
				smell: new fields.BooleanField({ initial: false }),
				acceleratedHealing: new fields.BooleanField({ initial: false }),
				incorporeal: new fields.BooleanField({ initial: false }),
				blindsight: new fields.BooleanField({ initial: false }),
				lowLightVision: new fields.BooleanField({ initial: false }),
				darkvision: new fields.BooleanField({ initial: false }),
			}),
		};
	}

	prepareDerivedData() {
		this._prepareBaseSkills();
		this._prepareThreatDerived();
	}

	/** Valores derivados no formato do livro: machucado, quadrados, tamanho e testes xO+y. */
	_prepareThreatDerived() {
		const hp = this.attributes.hp;
		hp.bruised = bruisedThreshold(hp.max);
		hp.isBruised = isBruised(hp.value, hp.max);

		const mv = this.attributes.movement;
		mv.squaresCalc = squaresFromMeters(mv.walk);
		mv.label = movementLabel(mv.walk);

		this.sizeData = sizeInfo(this.size);

		for (const skill of Object.values(this.skills)) {
			const attrValue = this.attributes[skill.attr?.[0]]?.value ?? 0;
			// Bônus base (grau/override) + buff (`skill.value`, o mesmo campo que as rolagens do sistema já somam)
			skill.base = skill.degree?.value ?? 0;
			skill.buff = skill.value ?? 0;
			const bonus = totalBonus(skill.base, skill.buff);
			skill.testLabel = formatTest(attrValue, bonus);
			skill.testHtml = formatTestHtml(attrValue, bonus);
			skill.formula = testFormula(attrValue, bonus);
		}

		for (const extra of this.extraSkills) {
			const attrValue = this.attributes[extra.attr]?.value ?? 0;
			const dice = extra.diceOverride ?? attrValue;
			const bonus = totalBonus(extra.bonus, extra.buff);
			extra.dice = dice;
			extra.total = bonus;
			extra.testLabel = formatTest(dice, bonus);
			extra.testHtml = formatTestHtml(dice, bonus);
			extra.formula = testFormula(dice, bonus);
		}
	}

	_prepareBaseSkills() {
		const attributes = this.attributes;
		const skills = this.skills;

		for (const [keySkill, skill] of Object.entries(skills)) {
			if (!skill.attr || skill.attr.length === 0) {
				const def = defaultAttrs[keySkill];
				if (def) skill.attr = [def];
			}
			if (skill && Array.isArray(skill.attr) && skill.attr.length > 0) {
				const requiredAttrKey = skill.attr[0];
				if (!Object.prototype.hasOwnProperty.call(attributes, requiredAttrKey)) {
					console.warn(
						`Atributo '${requiredAttrKey}' necessário para a perícia '${keySkill}' não foi encontrado em system.attributes.`
					);
				}

				if (!skill.degree) skill.degree = { value: 0, label: "untrained", override: null };

				// Override wins when set (any integer, including 0). Otherwise we
				// derive the proficiency bonus from the training label as before.
				// Homebrew threats / sourcebook stat blocks with non-standard
				// numbers use the override; the dropdown stays usable for the
				// common case.
				if (skill.degree.override != null && Number.isFinite(skill.degree.override)) {
					skill.degree.value = skill.degree.override;
				} else {
					skill.degree.value = calculateSkillProficiency(skill.degree.label);
				}

				if (keySkill === "freeSkill" && skill.name) {
					skill.label = skill.name;
				} else {
					const labelKey = CONFIG.op.skills[keySkill] || keySkill;
					skill.label = game.i18n.localize(labelKey) ?? keySkill;
				}
			}
		}
	}

	static migrateData(data) {
		// Legacy threats wrote "Tamanho" to system.details.size (ghost path), but
		// the schema only exposes size at top level. Lift the value back and drop
		// the orphan key so cleanData stops discarding it on every save.
		if (data?.details?.size && !data.size) {
			data.size = data.details.size;
		}
		if (data?.details && data.details.size !== undefined) {
			delete data.details.size;
		}
		// Ameaças antigas gravaram attr ["dex"] em todas as perícias (o padrão do schema estava errado):
		// Fortitude usava AGI em vez de VIG, Vontade/Percepção AGI em vez de PRE etc. Restaura o padrão do livro.
		if (data?.skills) fixLegacySkillAttrs(data.skills, defaultAttrs);
		return super.migrateData(data);
	}
}
