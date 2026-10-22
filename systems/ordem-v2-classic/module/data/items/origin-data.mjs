export class OriginData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const fields = foundry.data.fields;
		return {
			id: new fields.NumberField({ required: true, integer: true, initial: 0 }),
			description: new fields.HTMLField({ initial: game.i18n.localize("op.itemDescriptionPlaceholder") }),
			chatDescription: new fields.HTMLField({ initial: "" }),
		};
	}

	static get metadata() {
		return {
			singleton: true,
		};
	}

	// Dentro do seu arquivo base do Actor (ex: mySystemActor.js)
	async _preCreateItem(item, data, options, userId) {
		// Roda o comportamento nativo primeiro
		await super._preCreateItem(item, data, options, userId);

		// Puxa o DataModel referente ao tipo de item que o jogador está tentando criar
		const dataModel = CONFIG.Item.dataModels[item.type];

		// Checa se a marcação "singleton" existe no modelo e é verdadeira
		const isSingleton = dataModel?.metadata?.singleton ?? false;

		// Se for um item restrito E o ator já possuir pelo menos 1 item desse mesmo tipo...
		if (isSingleton && this.itemTypes[item.type].length > 0) {
			const typeLabel = game.i18n.localize(`TYPES.Item.${item.type}`);
			ui.notifications.error(game.i18n.format("WARN.singletonItemExists", { type: typeLabel }));
			// Retornar false cancela a gravação no banco de dados instantaneamente
			return false;
		}
	}

	static migrateData(data) {
		return super.migrateData(data);
	}
}
