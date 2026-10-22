/**
 * Register all of the system's keybindings.
 */
export function registerSystemKeybindings() {
	game.keybindings.register("ordem-v2-classic", "skipDialogNormal", {
		name: "KEYBINDINGS.op.SkipDialogNormal",
		editable: [{ key: "ShiftLeft" }, { key: "ShiftRight" }],
	});

	game.keybindings.register("ordem-v2-classic", "skipDialogAdvantage", {
		name: "KEYBINDINGS.op.SkipDialogAdvantage",
		editable: [{ key: "AltLeft" }, { key: "AltRight" }],
	});

	game.keybindings.register("ordem-v2-classic", "skipDialogDisadvantage", {
		name: "KEYBINDINGS.op.SkipDialogDisadvantage",
		editable: [{ key: "ControlLeft" }, { key: "ControlRight" }, { key: "OsLeft" }, { key: "OsRight" }],
	});

	// game.keybindings.register('ordemparanormal', 'dragCopy', {
	// 	name: 'KEYBINDINGS.op.DragCopy',
	// 	editable: [{ key: 'ControlLeft' }, { key: 'ControlRight' }, { key: 'AltLeft' }, { key: 'AltRight' }]
	// });

	// game.keybindings.register('ordemparanormal', 'dragMove', {
	// 	name: 'KEYBINDINGS.op.DragMove',
	// 	editable: [{ key: 'ShiftLeft' }, { key: 'ShiftRight' }, { key: 'OsLeft' }, { key: 'OsRight' }]
	// });
}

/**
 * Register all of the system's settings.
 */
export default function registerSystemSettings() {
	/*
	 * Create a custom config setting
	 */
	// game.settings.register('ordem-v2-classic', 'mySettingName', {
	// 	name: 'My Setting',
	// 	hint: 'A description of the registered setting and its behavior.',
	// 	scope: 'world',     // "world" = sync to db, "client" = local storage
	// 	config: true,       // false if you dont want it to show in module config
	// 	type: Number,       // Number, Boolean, String, Object
	// 	default: 0,
	// 	onChange: value => { // value is the new value of the setting
	// 		console.log(value);
	// 	},
	// });

	// Internal System Migration Version
	game.settings.register("ordem-v2-classic", "systemMigrationVersion", {
		name: "System Migration Version",
		scope: "world",
		config: false,
		type: String,
		default: "",
	});

	game.settings.register("ordem-v2-classic", "seenNotes", {
		scope: "client",
		config: false,
		type: Array,
		default: [],
	});

	game.settings.register("ordem-v2-classic", "patchNotes", {
		name: "SETTINGS.opPatchNotes",
		hint: "SETTINGS.opPatchNotesHint",
		scope: "client", // "world" = sync to db, "client" = local storage
		config: true, // false if you dont want it to show in module config
		type: Boolean, // Number, Boolean, String, Object
		default: false,
	});

	game.settings.register("ordem-v2-classic", "globalProgressRules", {
		name: "SETTINGS.globalProgressRules",
		hint: "SETTINGS.globalProgressRulesHint",
		scope: "world", // "world" = sync to db, "client" = local storage
		config: false, // obsoleta: a progressão agora depende sempre do Nível (NEX é independente)
		type: Number, // Number, Boolean, String, Object
		default: 1,
		requiresReload: true, // true if you want to prompt the user to reload
		choices: {
			1: "SETTINGS.nexProgressRule",
			2: "SETTINGS.nexExpProgressRule",
			// 3: 'SETTINGS.patentesProgressRule'
		},
	});

	game.settings.register("ordem-v2-classic", "gmWhisperHighlight", {
		name: "SETTINGS.gmWhisperHighlight",
		hint: "SETTINGS.gmWhisperHighlightHint",
		scope: "client",
		config: true,
		type: Boolean,
		default: true,
	});

	game.settings.register("ordem-v2-classic", "damageApplication", {
		name: "SETTINGS.damageApplication",
		hint: "SETTINGS.damageApplicationHint",
		scope: "world",
		config: true,
		type: String,
		default: "attacker-click",
		choices: {
			"manual-gm": "SETTINGS.damageApplicationManual",
			"attacker-click": "SETTINGS.damageApplicationClick",
			auto: "SETTINGS.damageApplicationAuto",
		},
	});

	game.settings.register("ordem-v2-classic", "globalPlayingWithoutSanity", {
		name: "SETTINGS.globalPlayingWithoutSanity",
		hint: "SETTINGS.globalPlayingWithoutSanityHint",
		scope: "world", // "world" = sync to db, "client" = local storage
		config: true, // false if you dont want it to show in module config
		type: Boolean, // Number, Boolean, String, Object
		default: false,
		requiresReload: true, // true if you want to prompt the user to reload
	});

	game.settings.register("ordem-v2-classic", "initiativeTiebreaker", {
		name: "SETTINGS.initiativeTiebreaker",
		hint: "SETTINGS.initiativeTiebreakerHint",
		scope: "world",
		config: true,
		type: String,
		default: "dex",
		choices: {
			dex: "SETTINGS.tiebreakerDex",
			none: "SETTINGS.tiebreakerNone",
			reroll: "SETTINGS.tiebreakerReroll",
		},
		requiresReload: false,
	});
}
