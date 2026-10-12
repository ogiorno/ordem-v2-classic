/**
 * Compatibilidade: as macros de armas viraram macros de barra para armas, rituais e habilidades
 * (helpers/hotbar-macros.mjs e helpers/hotbar-rules.mjs, docs/arquivo/spec-hotbar-automatica.md).
 */
export { registerHotbarMacroHooks as registerWeaponMacroHooks } from "./hotbar-macros.mjs";
export { freeHotbarSlot, hotbarSlotsOf, hotbarMacroData as weaponMacroData, hotbarMacroInfo as weaponMacroInfo, WEAPON_FLAG as WEAPON_MACRO_FLAG } from "./hotbar-rules.mjs";
