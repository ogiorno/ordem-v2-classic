import { curseEntryField } from "./curse-data.mjs";
import { PROTECTION_MODIFICATIONS } from "../../helpers/item-categories.mjs";

export class ProtectionData extends foundry.abstract.TypeDataModel {
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
			modifications: new fields.SetField(new fields.StringField({ choices: PROTECTION_MODIFICATIONS })),
			// maldições paranormais do item (curse-rules.mjs): a primeira soma II à categoria, as seguintes I
			curses: curseEntryField(),
			using: new fields.SchemaField({
				state: new fields.BooleanField({ initial: true }),
				class: new fields.StringField({ initial: "fas" }),
			}),
			defense: new fields.NumberField({ required: true, integer: true, initial: 0 }),
			penalty: new fields.StringField({ initial: "" }),
			quantity: new fields.NumberField({ required: true, integer: true, initial: 1 }),
		};
	}

	static migrateData(data) {
		return super.migrateData(data);
	}
}
