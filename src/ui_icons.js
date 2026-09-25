// Crisp engraved ability marks, independent of the platform emoji font.
const marks = {
 iaido:'M4 23L23 4M5 8l3-3 15 15-3 3zM3 26l5-5',
 ghostdraw:'M7 25V12a8 8 0 0116 0v13l-4-3-3 3-4-3zM12 12v3m8-3v3',
 threadsever:'M4 4l24 24M28 4L4 28M6 14l8-8m4 20l8-8',
 tempest:'M5 12c0-12 25-11 23 1-2 9-19 12-21 5-2-5 12-9 16-5 7 8-5 16-14 14',
 galestep:'M4 24c5-12 14-4 20-19M10 25c4-8 10-4 17-12M3 17l5-3',
 kaze:'M24 3C2 0-4 25 18 29 8 20 12 9 24 3z',
 oni:'M6 3l3 7M26 3l-3 7M7 9h18l2 10-11 9L5 19zM10 15l4 2m8-2l-4 2M12 22h8',
 bellquake:'M7 22h18l-3-5v-6a6 6 0 00-12 0v6zM13 26h6M3 12l-2 4m28-4l2 4',
 multishot:'M16 28V4M11 9l5-5 5 5M12 23L4 9M3 15l1-6 6 2M20 23l8-14M22 11l6-2 1 6',
 ghostflight:'M5 27L26 6M15 7l11-1-1 11M7 19l7 7M4 22l6 6',
 snare:'M4 24l5-14 7 10 7-10 5 14zM4 24h24M9 5l7 8 7-8',
 tether:'M10 19l-2 2a5 5 0 01-7-7l6-6a5 5 0 017 0M22 13l2-2a5 5 0 017 7l-6 6a5 5 0 01-7 0M10 22l12-12',
 rain:'M6 3v23m10-20v23m10-26v23M2 21l4 5 4-5m2 3l4 5 4-5m2-3l4 5 4-5',
 stormpin:'M18 2L7 17h8l-1 13 11-18h-8z',
 ricochet:'M3 25l12-9-6-9h18M22 2l5 5-5 5',
 needlerain:'M16 2v6m0 16v6M2 16h6m16 0h6M16 10a6 6 0 100 12 6 6 0 000-12z',
 nova:'M16 2v28M4 9l24 14M4 23L28 9M11 5l5 4 5-4M11 27l5-4 5 4M3 14l6-2-1-6M24 26l-1-6 6-2',
 chain:'M19 2L7 18h9l-3 12 12-17h-9zM3 5l4 2m18 20l4 2',
 familiar:'M6 13V4l7 6h6l7-6v9a10 10 0 01-20 0zM10 15h2m8 0h2M14 20h4',
 embergarden:'M16 29C-3 21 9 9 16 2c0 10 16 12 11 21-2 4-7 6-11 6zM16 27c-7-3-1-10 2-13 0 5 7 9-2 13',
 mothstorm:'M16 9v19M16 14C8-5-5 10 7 20l9-3M16 14C24-5 37 10 25 20l-9-3M16 20C2 15 6 30 16 25M16 20c14-5 10 10 0 5',
 stormthread:'M2 10c8-13 18 25 28 10M2 20C10 7 22 33 30 10M16 2v28',
 witherhex:'M16 2l12 7v14l-12 7-12-7V9zM8 8l16 16M24 8L8 24M16 10v12',
 glasscomet:'M16 2l5 15-5 13-5-13zM5 16h22M9 10l14 14M23 10L9 24',
};
export function abilityIcon(id, type='active') {
 const p=marks[id] || ({passive:'M16 5l4 7 8 4-8 4-4 7-4-7-8-4 8-4z',mod:'M7 7h18v18H7zM16 10v12M10 16h12',res:'M16 3C11 12 5 15 7 22a9 9 0 0018 0c2-7-4-10-9-19z',util:'M7 24L24 7M16 7h8v8M16 25H7v-8',key:'M16 3l4 9 9 4-9 4-4 9-4-9-9-4 9-4z'}[type]) || 'M16 3l12 13-12 13L4 16zM16 10v12M10 16h12';
 return `<svg class="ability-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="${p}"/></svg>`;
}
