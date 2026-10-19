export default [
	{
		ignores: [
			"**/packs/**",
			"**/lib/**",
			"**/node_modules/**",
		],
	},
	{
		files: ["modules/**/*.{js,mjs}", "systems/**/*.{js,mjs}"],
		linterOptions: { reportUnusedDisableDirectives: "off" },
		languageOptions: { ecmaVersion: "latest", sourceType: "module" },
		rules: {
			"constructor-super": "error",
			"no-constant-condition": "error",
			"no-dupe-args": "error",
			"no-dupe-else-if": "error",
			"no-duplicate-case": "error",
			"no-unreachable": "error",
			"no-unsafe-finally": "error",
			"valid-typeof": "error",
		},
	},
];
