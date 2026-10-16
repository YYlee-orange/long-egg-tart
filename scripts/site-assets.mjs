// Only files used by the playable game are included in the published website.
export const siteAssets = [
  'assets/backgrounds/picnic-cloth-flat-v1.png',
  'assets/food/custard-carton-custom-v1.png',
  'assets/food/custard-carton-48-v6.png',
  'assets/ui/title-long-egg-tart.png',
  'assets/snake/head/tart-snake-head-right-v7.png',
  'assets/snake/head/tart-snake-head-right-closed-v1.png',
  'assets/snake/head/head-states-v1.json',
  'assets/snake/source/decal-shapes-v5.json',
  'assets/snake/source/body-geometry-v2.mjs',
  'assets/ui/PHOSPHOR-LICENSE.txt',
  ...['play', 'pause', 'house', 'arrow-clockwise'].map(name => `assets/ui/${name}-fill.svg`),
  ...['panel-frame-v1.png', 'mascot-480-v1.png',
    ...['home', 'play', 'retry', 'pause'].map(name => `icon-${name}-v1.svg`),
    ...['primary', 'secondary'].flatMap(kind => ['default', 'hover', 'pressed', 'disabled'].map(state => `button-${kind}-${state}-v1.png`)),
  ].map(name => `assets/ui/dialogs/${name}`),
];
