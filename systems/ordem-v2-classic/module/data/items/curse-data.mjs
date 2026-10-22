import { CURSES, ELEMENTS, KINDS } from "../../helpers/curse-rules.mjs";

/** Uma maldição guardada num item (armamento, proteção ou equipamento geral). */
export function curseEntryField() {
	const fields = foundry.data.fields;
	return new fields.ArrayField(
		new fields.SchemaField({
			key: new fields.StringField({ required: true, blank: false, choices: Object.keys(CURSES) }),
			// escolha da maldição: elemento (Antielemento, Proteção Elemental) ou nome do ritual (Ritualística, Conjuração)
			chosen: new fields.StringField({ blank: true, initial: "" }),
			// tempo do mundo (s) em que o item passou a ser usado: Esforço Adicional e Vitalidade só ligam um dia depois
			since: new fields.NumberField({ nullable: true, initial: null }),
		})
	);
}

/**
 * Maldição paranormal avulsa (compêndio "Maldições Paranormais"). Não fica na mochila: ao ser solta numa ficha ou num
 * item, o agente escolhe o item que vira amaldiçoado e a maldição passa para `system.curses` dele (ver curses.mjs).
 */
export class CurseData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const fields = foundry.data.fields;
		return {
			description: new fields.HTMLField({ initial: "" }),
			chatDescription: new fields.HTMLField({ initial: "" }),
			curseKey: new fields.StringField({ required: true, blank: true, initial: "" }),
			element: new fields.StringField({ initial: "knowledge", choices: Object.keys(ELEMENTS) }),
			// em que tipo de item a maldição pode ser colocada
			applies: new fields.StringField({ initial: "weapon", choices: Object.keys(KINDS) }),
			// auto, semi ou manual (o quanto o sistema faz sozinho)
			mode: new fields.StringField({ initial: "auto" }),
			// preço do Medo: definido pelo Mestre
			price: new fields.StringField({ initial: "" }),
		};
	}
}
