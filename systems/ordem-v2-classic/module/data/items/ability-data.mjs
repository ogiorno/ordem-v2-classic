export class AbilityData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const fields = foundry.data.fields;
		return {
			id: new fields.NumberField({ required: true, integer: true, initial: 0 }),
			description: new fields.HTMLField({ initial: game.i18n.localize("op.itemDescriptionPlaceholder") }),
			chatDescription: new fields.HTMLField({ initial: "" }),
			abilityType: new fields.StringField({ initial: "" }),
			cost: new fields.NumberField({ integer: true, initial: 0 }),
			preRequisite: new fields.StringField({ initial: "" }),
			activation: new fields.StringField({ initial: "" }),
			costType: new fields.StringField({ initial: "PE" }),
			// Bloco opcional versionado (ver module/helpers/threat-ability-execution.mjs).
			// null/ausente = legado/manual; ObjectField preserva campos desconhecidos.
			execution: new fields.ObjectField({ required: false, nullable: true, initial: null }),
		};
	}

	static migrateData(data) {
		return super.migrateData(data);
	}
}
