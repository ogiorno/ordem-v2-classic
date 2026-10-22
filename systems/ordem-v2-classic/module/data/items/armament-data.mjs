import { curseEntryField } from "./curse-data.mjs";
import { WEAPON_MODIFICATIONS } from "../../helpers/item-categories.mjs";

export class ArmamentData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const fields = foundry.data.fields;
		return {
			description: new fields.HTMLField({ initial: game.i18n.localize("op.itemDescriptionPlaceholder") }),
			chatDescription: new fields.HTMLField({ initial: "" }),
			weight: new fields.NumberField({ required: true, integer: false, initial: 1 }),
			category: new fields.NumberField({ required: true, integer: true, initial: 0 }),
			// item escolhido para as habilidades que reduzem a categoria (A Favorita, Ferramentas Favoritas)
			favorite: new fields.BooleanField({ initial: false }),
			// cada modificação sobe a categoria do item em I (só informa na ficha, não trava)
			modifications: new fields.SetField(new fields.StringField({ choices: WEAPON_MODIFICATIONS })),
			// maldições paranormais do item (curse-rules.mjs): a primeira soma II à categoria, as seguintes I
			curses: curseEntryField(),
			using: new fields.SchemaField({
				state: new fields.BooleanField({ initial: true }),
				class: new fields.StringField({ initial: "fas" }),
			}),
			quantity: new fields.NumberField({ required: true, integer: true, initial: 1 }),
			proficiency: new fields.StringField({ required: true, initial: "" }),
			types: new fields.SchemaField({
				rangeType: new fields.SchemaField({
					name: new fields.StringField({ initial: "" }),
					subRangeType: new fields.StringField({ initial: "" }),
				}),
				ammunitionType: new fields.StringField({ initial: "" }),
				gripType: new fields.StringField({ initial: "" }),
			}),
			critical: new fields.StringField({ initial: "" }),
			range: new fields.StringField({ initial: "" }),
			formulas: new fields.SchemaField({
				attack: new fields.SchemaField({
					formula: new fields.StringField({ initial: "1d4" }),
					attr: new fields.StringField({ initial: "" }),
					skill: new fields.StringField({ initial: "" }),
					bonus: new fields.StringField({ initial: "" }),
				}),
				damage: new fields.SchemaField({
					formula: new fields.StringField({ initial: "1d4" }),
					attr: new fields.StringField({ initial: "" }),
					bonus: new fields.StringField({ initial: "" }),
					type: new fields.StringField({ initial: "" }),
					parts: new fields.ArrayField(new fields.ArrayField(new fields.StringField())),
				}),
				extraFormula: new fields.StringField({ initial: "1d4" }),
			}),
			penalty: new fields.StringField({ initial: "" }),
			actionType: new fields.StringField({ initial: "standard" }),
			numberOfAttacks: new fields.NumberField({ required: false, integer: true, initial: 1, min: 1, max: 8 }),
			rangeCategory: new fields.StringField({ initial: "" }),
			conditions: new fields.SchemaField({
				improvised: new fields.BooleanField({ initial: false }),
				throwable: new fields.BooleanField({ initial: false }),
				agile: new fields.BooleanField({ initial: false }),
				automatic: new fields.BooleanField({ initial: false }),
				adaptableGrip: new fields.BooleanField({ initial: false }),
				pistolBlow: new fields.BooleanField({ initial: false }),
			}),
		};
	}

	static migrateData(data) {
		return super.migrateData(data);
	}
}
