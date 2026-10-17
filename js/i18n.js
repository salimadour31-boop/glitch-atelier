/* i18n.js — Glitch Atelier interface texts: French (default), English, Taqbaylit (Kabyle, Latin script) with an
 * optional Tifinagh rendering of the Kabyle texts. Each entry is [fr, en, kab]; placeholders look like {n}.
 * The Kabyle texts are a first draft — corrections are very welcome. Original texts, MIT licence. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.I18N = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const S = {
    skip: ['Aller à l’aperçu', 'Skip to the preview', 'Ddu ɣer teskant'],
    tagline: ['Glitch art & pixel sorting — tout reste sur votre appareil', 'Glitch art & pixel sorting — everything stays on your device', 'Glitch art d usmizzwer n yipiksilen — kullec yeqqim ɣur-k'],
    language: ['Langue', 'Language', 'Tutlayt'],
    tifinagh: ['Tifinagh', 'Tifinagh', 'S tifinaɣ'],
    help: ['Aide', 'Help', 'Tallalt'],
    close: ['Fermer', 'Close', 'Mdel'],
    open: ['Ouvrir', 'Open', 'Ldi'],
    openTitle: ['Ouvrir une image (O)', 'Open an image (O)', 'Ldi tugna (O)'],
    demo: ['Démo', 'Demo', 'Amedya'],
    demoTitle: ['Image de démonstration générée', 'Generated demo image', 'Tugna n umedya yettwasegraven'],
    undo: ['Annuler (Ctrl+Z)', 'Undo (Ctrl+Z)', 'Sefsex (Ctrl+Z)'],
    redo: ['Rétablir (Ctrl+Y)', 'Redo (Ctrl+Y)', 'Err-d (Ctrl+Y)'],
    fit: ['Ajuster', 'Fit', 'Ṣeggem'],
    zoom100: ['100 %', '100 %', '100 %'],
    fitTitle: ['Ajuster à la fenêtre (F)', 'Fit to window (F)', 'Ṣeggem ɣef usfaylu (F)'],
    zoomTitle: ['Taille réelle, rendu pleine résolution (1)', 'Actual size, full-resolution render (1)', 'Teɣzi tilawt (1)'],
    compare: ['Avant / après', 'Before / after', 'Uqbel / deffir'],
    compareTitle: ['Comparer avant / après (C) — maintenir B pour voir l’original', 'Compare before / after (C) — hold B to see the original', 'Serwes uqbel / deffir (C)'],
    compareSlider: ['Position du comparateur', 'Compare slider position', 'Adeg n userwes'],
    before: ['Avant', 'Before', 'Uqbel'],
    after: ['Après', 'After', 'Deffir'],
    play: ['Animer', 'Animate', 'Smussu'],
    playTitle: ['Animer l’aperçu (P)', 'Animate the preview (P)', 'Smussu taskant (P)'],
    stageLabel: ['Aperçu de l’image glitchée', 'Preview of the glitched image', 'Taskant n tugna'],
    dropHint: ['Déposez, collez (Ctrl+V) ou ouvrez une image', 'Drop, paste (Ctrl+V) or open an image', 'Sers, senṭeḍ (Ctrl+V) neɣ ldi tugna'],
    dropNow: ['Relâchez pour charger l’image', 'Release to load the image', 'Serreḥ akken ad d-tali tugna'],
    presets: ['Préréglages', 'Presets', 'Iɣewwaren uzwiren'],
    surprise: ['Surprise', 'Surprise', 'Tawerdeṭ'],
    surpriseTitle: ['Pile aléatoire (S)', 'Random stack (S)', 'Tabaṭṭit tagacurant (S)'],
    seedTitle: ['Hasard', 'Randomness', 'Ugacur'],
    seed: ['Graine', 'Seed', 'Aɛeqqa'],
    reroll: ['Nouvelle graine (R)', 'New seed (R)', 'Aɛeqqa amaynut (R)'],
    previewSize: ['Taille d’aperçu', 'Preview size', 'Teɣzi n teskant'],
    stackTitle: ['Pile d’effets', 'Effect stack', 'Tabaṭṭit n yisemdan'],
    addEffect: ['Effet à ajouter', 'Effect to add', 'Asemdu ara ternuḍ'],
    add: ['Ajouter', 'Add', 'Rnu'],
    clear: ['Tout retirer', 'Remove all', 'Kkes kullec'],
    emptyStack: ['Aucun effet : choisissez un préréglage ou ajoutez un effet.', 'No effect yet: pick a preset or add an effect.', 'Ulac asemdu : fren aɣewwar neɣ rnu asemdu.'],
    layerOn: ['Activer le calque', 'Enable layer', 'Rmed tissi'],
    moveUp: ['Monter', 'Move up', 'Ali'],
    moveDown: ['Descendre', 'Move down', 'Ader'],
    duplicate: ['Dupliquer', 'Duplicate', 'Sleg'],
    remove: ['Supprimer', 'Remove', 'Kkes'],
    drag: ['Glisser pour réordonner (ou Alt+↑/↓)', 'Drag to reorder (or Alt+↑/↓)', 'Zuɣer i usmizzwer (neɣ Alt+↑/↓)'],
    mix: ['Dosage', 'Amount', 'Tasmekta'],
    blend: ['Fusion', 'Blend', 'Asmezdi'],
    layerSeed: ['Nouveau hasard pour ce calque', 'New randomness for this layer', 'Ugacur amaynut i tissi-a'],
    exportTitle: ['Exporter', 'Export', 'Sifeḍ'],
    exportPng: ['PNG pleine résolution', 'Full-resolution PNG', 'PNG s teɣzi tummidt'],
    exportJpg: ['JPG', 'JPG', 'JPG'],
    jpgQuality: ['Qualité JPG', 'JPG quality', 'Taɣara n JPG'],
    video: ['Boucle vidéo (WebM)', 'Video loop (WebM)', 'Tavidyut (WebM)'],
    duration: ['Durée', 'Duration', 'Tanzagt'],
    fps: ['Images / s', 'Frames / s', 'Tugniwin / tasint'],
    videoSize: ['Largeur', 'Width', 'Tehri'],
    varyRandom: ['Hasard différent à chaque image', 'New randomness every frame', 'Ugacur nniḍen i yal tugna'],
    exportWebm: ['Enregistrer la boucle WebM', 'Record the WebM loop', 'Sekles tavidyut WebM'],
    webmUnsupported: ['Ce navigateur ne sait pas enregistrer de vidéo WebM (MediaRecorder). Essayez Chrome, Edge ou Firefox.', 'This browser cannot record WebM video (MediaRecorder). Try Chrome, Edge or Firefox.', 'Iminig-a ur yezmir ara ad yesekles WebM. Ɛreḍ Chrome, Edge neɣ Firefox.'],
    settings: ['Réglages', 'Settings', 'Iɣewwaren'],
    exportJson: ['Exporter JSON', 'Export JSON', 'Sifeḍ JSON'],
    importJson: ['Importer JSON', 'Import JSON', 'Kter JSON'],
    shareLink: ['Copier le lien', 'Copy link', 'Nɣel aseɣwen'],
    shareNote: ['Le lien contient la pile d’effets, pas l’image.', 'The link holds the effect stack, not the image.', 'Aseɣwen yesɛa tabaṭṭit n yisemdan, mačči tugna.'],
    copied: ['Lien copié dans le presse-papiers', 'Link copied to the clipboard', 'Aseɣwen yettwanɣel'],
    copyManual: ['Copiez ce lien :', 'Copy this link:', 'Nɣel aseɣwen-a :'],
    imported: ['Réglages importés', 'Settings imported', 'Iɣewwaren ttwaketren'],
    importError: ['Fichier de réglages invalide', 'Invalid settings file', 'Afaylu n yiɣewwaren ur iṣeḥḥa ara'],
    hashLoaded: ['Pile restaurée depuis le lien', 'Stack restored from the link', 'Tabaṭṭit tettwarr-d seg useɣwen'],
    loaded: ['Image chargée : {w}×{h} px', 'Image loaded: {w}×{h} px', 'Tugna tuli-d : {w}×{h} px'],
    loadError: ['Impossible de lire cette image', 'Cannot read this image', 'Ur tezmir ara ad teɣreḍ tugna-a'],
    tooBig: ['Image réduite à {w}×{h} px (limite mémoire)', 'Image reduced to {w}×{h} px (memory limit)', 'Tugna tettwasemẓi ɣer {w}×{h} px'],
    renderFull: ['Rendu pleine résolution… {p} %', 'Full-resolution render… {p} %', 'Asekker s teɣzi tummidt… {p} %'],
    renderFrames: ['Images {i} / {n}…', 'Frames {i} / {n}…', 'Tugniwin {i} / {n}…'],
    recording: ['Enregistrement de la vidéo…', 'Recording the video…', 'Asekles n tvidyut…'],
    saved: ['Fichier prêt : {name}', 'File ready: {name}', 'Afaylu yewjed : {name}'],
    presetLoaded: ['Préréglage « {name} »', 'Preset “{name}”', 'Aɣewwar « {name} »'],
    info: ['{w}×{h} px · aperçu {pw}×{ph} · {ms} ms', '{w}×{h} px · preview {pw}×{ph} · {ms} ms', '{w}×{h} px · taskant {pw}×{ph} · {ms} ms'],
    nothingUndo: ['Rien à annuler', 'Nothing to undo', 'Ulac ara tesfesxeḍ'],
    nothingRedo: ['Rien à rétablir', 'Nothing to redo', 'Ulac ara d-terreḍ'],
    privacy: ['Vos images ne quittent jamais votre appareil : tout le traitement se fait dans le navigateur.', 'Your images never leave your device: all processing happens in the browser.', 'Tugniwin-ik ur ffɣent ara seg yibenk-ik : kullec yettwaxdam deg yiminig.'],
    licence: ['Logiciel libre, licence MIT', 'Free software, MIT licence', 'Aseɣzan ilelli, turagt MIT'],
    source: ['Code source', 'Source code', 'Tangalt taɣbalut'],
    helpTitle: ['Aide & raccourcis', 'Help & shortcuts', 'Tallalt d yinegzumen'],
    helpHtml: [
      `<p>Chargez une image (bouton <strong>Ouvrir</strong>, glisser-déposer ou <kbd>Ctrl</kbd>+<kbd>V</kbd>) ou gardez l’image de démo. Choisissez un <strong>préréglage</strong> ou empilez des effets : chaque calque a son dosage, son mode de fusion et ses réglages ; l’ordre compte (de haut en bas).</p>
<p>La <strong>graine</strong> rend le hasard reproductible : même graine + mêmes réglages = même image. L’aperçu est calculé en taille réduite, l’export PNG / JPG est recalculé en pleine résolution.</p>
<ul><li><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> (ou <kbd>Ctrl</kbd>+<kbd>Maj</kbd>+<kbd>Z</kbd>) : annuler / rétablir</li>
<li><kbd>R</kbd> : nouvelle graine · <kbd>S</kbd> : pile surprise · <kbd>P</kbd> : animer l’aperçu</li>
<li><kbd>C</kbd> : comparateur avant / après · maintenir <kbd>B</kbd> : voir l’original</li>
<li><kbd>F</kbd> : ajuster · <kbd>1</kbd> : 100 % · <kbd>O</kbd> : ouvrir · <kbd>Ctrl</kbd>+<kbd>S</kbd> : exporter le PNG</li>
<li><kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> sur un calque : le déplacer · <kbd>?</kbd> : cette aide</li></ul>
<p>Le lien de partage et le fichier JSON contiennent uniquement la pile d’effets et la graine, jamais l’image.</p>`,
      `<p>Load an image (<strong>Open</strong> button, drag & drop or <kbd>Ctrl</kbd>+<kbd>V</kbd>) or keep the demo image. Pick a <strong>preset</strong> or stack effects: each layer has its own amount, blend mode and settings; order matters (top to bottom).</p>
<p>The <strong>seed</strong> makes randomness reproducible: same seed + same settings = same image. The preview is computed at a reduced size; PNG / JPG export is re-rendered at full resolution.</p>
<ul><li><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> (or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>): undo / redo</li>
<li><kbd>R</kbd>: new seed · <kbd>S</kbd>: surprise stack · <kbd>P</kbd>: animate the preview</li>
<li><kbd>C</kbd>: before / after slider · hold <kbd>B</kbd>: show the original</li>
<li><kbd>F</kbd>: fit · <kbd>1</kbd>: 100 % · <kbd>O</kbd>: open · <kbd>Ctrl</kbd>+<kbd>S</kbd>: export PNG</li>
<li><kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> on a layer: move it · <kbd>?</kbd>: this help</li></ul>
<p>The share link and the JSON file only hold the effect stack and the seed, never the image.</p>`,
      `<p>Ldi tugna (<strong>Ldi</strong>, zuɣer-tt neɣ <kbd>Ctrl</kbd>+<kbd>V</kbd>) neɣ eǧǧ tugna n umedya. Fren <strong>aɣewwar</strong> neɣ rnu isemdan : yal tissi tesɛa tasmekta-ines, asmezdi d yiɣewwaren-ines.</p>
<p><strong>Aɛeqqa</strong> yettarra ugacur ad d-yuɣal : aɛeqqa yiwen + iɣewwaren yiwen = tugna yiwet. Asifeḍ PNG / JPG yettwaxdam s teɣzi tummidt.</p>
<ul><li><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> : sefsex / err-d</li>
<li><kbd>R</kbd> : aɛeqqa amaynut · <kbd>S</kbd> : tawerdeṭ · <kbd>P</kbd> : smussu</li>
<li><kbd>C</kbd> : uqbel / deffir · <kbd>B</kbd> : tugna taɣbalut</li>
<li><kbd>F</kbd> : ṣeggem · <kbd>1</kbd> : 100 % · <kbd>O</kbd> : ldi · <kbd>Ctrl</kbd>+<kbd>S</kbd> : PNG</li>
<li><kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> : smutti tissi · <kbd>?</kbd> : tallalt</li></ul>
<p>Aseɣwen d ufaylu JSON sɛan kan tabaṭṭit d uɛeqqa, mačči tugna.</p>`,
    ],
    // effects
    fx_sort: ['Pixel sorting', 'Pixel sorting', 'Asmizzwer n yipiksilen'],
    fx_rgb: ['Décalage RVB', 'RGB split', 'Asemmutti RVB'],
    fx_chroma: ['Aberration chromatique', 'Chromatic aberration', 'Tuccḍa n yiniten'],
    fx_slices: ['Tranches & blocs', 'Slices & blocks', 'Tiqeṭṭiɛin d yiḥedren'],
    fx_jpeg: ['Corruption JPEG', 'JPEG corruption', 'Asexseṛ JPEG'],
    fx_vhs: ['Bandes VHS', 'VHS tracking', 'Tasfift VHS'],
    fx_crt: ['Écran CRT', 'CRT screen', 'Agdil CRT'],
    fx_wave: ['Onde', 'Wave', 'Tamewjt'],
    fx_pixelate: ['Pixelisation / mosaïque', 'Pixelate / mosaic', 'Tamuzayikt'],
    fx_posterize: ['Postérisation / bit-crush', 'Posterize / bit-crush', 'Asenqes n yiniten'],
    fx_noise: ['Bruit / grain', 'Noise / grain', 'Tixerxert'],
    fx_mirror: ['Miroir / kaléidoscope', 'Mirror / kaleidoscope', 'Lemri / akalidu'],
    fx_melt: ['Fonte / coulure', 'Melt / drip', 'Tafsit'],
    // parameters
    p_key: ['Critère', 'Sort by', 'Amizzwer s'],
    p_dir: ['Direction', 'Direction', 'Tanila'],
    p_angle: ['Angle', 'Angle', 'Tiɣmert'],
    p_low: ['Seuil bas', 'Low threshold', 'Tilisa n wadda'],
    p_high: ['Seuil haut', 'High threshold', 'Tilisa n usawen'],
    p_mask: ['Masque', 'Mask', 'Tagmamt'],
    p_reverse: ['Ordre inversé', 'Reverse order', 'Amizzwer imitti'],
    p_maxLen: ['Longueur max (0 = illimitée)', 'Max length (0 = unlimited)', 'Teɣzi tafellayt (0 = war tilisa)'],
    p_jitter: ['Agitation', 'Jitter', 'Aserwes'],
    p_rx: ['Rouge X', 'Red X', 'Azeggaɣ X'], p_ry: ['Rouge Y', 'Red Y', 'Azeggaɣ Y'],
    p_gx: ['Vert X', 'Green X', 'Azegzaw X'], p_gy: ['Vert Y', 'Green Y', 'Azegzaw Y'],
    p_bx: ['Bleu X', 'Blue X', 'Anili X'], p_by: ['Bleu Y', 'Blue Y', 'Anili Y'],
    p_swap: ['Ordre des canaux', 'Channel order', 'Amizzwer n yibuda'],
    p_wrap: ['Boucler aux bords', 'Wrap around edges', 'Tuɣalin deg yiran'],
    p_amount: ['Intensité', 'Amount', 'Tazmert'],
    p_cx: ['Centre X', 'Centre X', 'Talemmast X'], p_cy: ['Centre Y', 'Centre Y', 'Talemmast Y'],
    p_falloff: ['Progression', 'Falloff', 'Asnerni'],
    p_count: ['Nombre', 'Count', 'Amḍan'],
    p_shift: ['Décalage max', 'Max shift', 'Asemmutti afellay'],
    p_thick: ['Épaisseur', 'Thickness', 'Tuzert'],
    p_blocks: ['Blocs rectangulaires', 'Rectangular blocks', 'Iḥedren'],
    p_chan: ['Part sur un seul canal', 'Single-channel share', 'Abud yiwen'],
    p_mode: ['Mode', 'Mode', 'Askar'],
    p_quality: ['Qualité', 'Quality', 'Taɣara'],
    p_corrupt: ['Corruption', 'Corruption', 'Asexseṛ'],
    p_drift: ['Dérive', 'Drift', 'Azuzer'],
    p_block: ['Taille de bloc', 'Block size', 'Teɣzi n uḥedri'],
    p_subsample: ['Sous-échantillonnage couleur', 'Chroma subsampling', 'Asenqes n yiniten'],
    p_bands: ['Bandes', 'Bands', 'Tiɛeṣṣabin'],
    p_bandH: ['Hauteur des bandes', 'Band height', 'Teɣzi n tɛeṣṣabin'],
    p_wobble: ['Tremblement', 'Wobble', 'Tergigit'],
    p_bleed: ['Bavure couleur', 'Colour bleed', 'Tazzla n yiniten'],
    p_desat: ['Désaturation', 'Desaturation', 'Asenqes n tɣawla'],
    p_noise: ['Bruit', 'Noise', 'Tixerxert'],
    p_head: ['Bruit de tête', 'Head switching', 'Tixerxert n uqerru'],
    p_roll: ['Défilement (tours / boucle)', 'Roll (passes / loop)', 'Tazzla (tikkal)'],
    p_lines: ['Lignes', 'Lines', 'Izirigen'],
    p_spacing: ['Espacement', 'Spacing', 'Tallunt'],
    p_curve: ['Courbure', 'Curvature', 'Aknaf'],
    p_vignette: ['Vignettage', 'Vignette', 'Tibbuct'],
    p_bright: ['Luminosité', 'Brightness', 'Tafat'],
    p_flicker: ['Scintillement', 'Flicker', 'Asemnenni'],
    p_axis: ['Axe', 'Axis', 'Agellus'],
    p_shape: ['Forme', 'Shape', 'Talɣa'],
    p_amp: ['Amplitude', 'Amplitude', 'Tazmert'],
    p_length: ['Longueur d’onde', 'Wavelength', 'Teɣzi n tmewjt'],
    p_phase: ['Phase', 'Phase', 'Tafult'],
    p_speed: ['Vitesse (cycles / boucle)', 'Speed (cycles / loop)', 'Arured (tikkal)'],
    p_split: ['Séparation RVB', 'RGB split', 'Abeṭṭu RVB'],
    p_size: ['Taille', 'Size', 'Teɣzi'],
    p_aspect: ['Proportion', 'Aspect', 'Assaɣ'],
    p_sample: ['Couleur de cellule', 'Cell colour', 'Ini n texxamt'],
    p_gap: ['Grille LED', 'LED gap', 'Tallunt LED'],
    p_levels: ['Niveaux', 'Levels', 'Iswiren'],
    p_dither: ['Tramage ordonné', 'Ordered dither', 'Asebrureq'],
    p_xor: ['Masque XOR', 'XOR mask', 'Tagmamt XOR'],
    p_bits: ['Bits supprimés', 'Dropped bits', 'Ibitten yettwakksen'],
    p_mono: ['Monochrome', 'Monochrome', 'Yiwen yini'],
    p_segments: ['Segments', 'Segments', 'Iḥricen'],
    p_rotate: ['Rotation', 'Rotation', 'Tuzzya'],
    p_tiles: ['Tuiles', 'Tiles', 'Tiferkiwin'],
    p_density: ['Densité', 'Density', 'Taneɣmert'],
    p_width: ['Largeur', 'Width', 'Tehri'],
    p_threshold: ['Seuil', 'Threshold', 'Tilisa'],
    p_stretch: ['Étirement', 'Stretch', 'Asaɣ'],
    // options
    o_luma: ['Luminosité', 'Brightness', 'Tafat'], o_hue: ['Teinte', 'Hue', 'Ini'], o_sat: ['Saturation', 'Saturation', 'Taɣawla'],
    o_red: ['Rouge', 'Red', 'Azeggaɣ'], o_green: ['Vert', 'Green', 'Azegzaw'], o_blue: ['Bleu', 'Blue', 'Anili'],
    o_h: ['Horizontale', 'Horizontal', 'S uglawan'], o_v: ['Verticale', 'Vertical', 'S ubeddu'], o_angle: ['Angle libre', 'Custom angle', 'Tiɣmert tilelli'],
    o_inside: ['Entre les seuils', 'Between thresholds', 'Gar tlisa'], o_outside: ['Hors des seuils', 'Outside thresholds', 'Beṛṛa n tlisa'],
    o_dct: ['Codec simulé (DCT)', 'Simulated codec (DCT)', 'Codec (DCT)'], o_bytes: ['Vrais octets JPEG', 'Real JPEG bytes', 'Ibiten n JPEG'],
    o_x: ['Horizontal', 'Horizontal', 'S uglawan'], o_y: ['Vertical', 'Vertical', 'S ubeddu'], o_both: ['Les deux', 'Both', 'Sin'],
    o_sine: ['Sinus', 'Sine', 'Sinus'], o_square: ['Carré', 'Square', 'Amkuẓ'], o_saw: ['Dent de scie', 'Saw', 'Tamessaṛt'], o_tri: ['Triangle', 'Triangle', 'Akerdis'],
    o_avg: ['Moyenne', 'Average', 'Alemmas'], o_center: ['Centre', 'Centre', 'Talemmast'],
    o_lr: ['Gauche → droite', 'Left → right', 'Azelmaḍ → ayeffus'], o_rl: ['Droite → gauche', 'Right → left', 'Ayeffus → azelmaḍ'],
    o_tb: ['Haut → bas', 'Top → bottom', 'Asawen → akessar'], o_bt: ['Bas → haut', 'Bottom → top', 'Akessar → asawen'],
    o_quad: ['Quatre quarts', 'Four quarters', 'Ukkuẓ'], o_kaleido: ['Kaléidoscope', 'Kaleidoscope', 'Akalidu'], o_tile: ['Tuiles miroir', 'Mirrored tiles', 'Tiferkiwin'],
    o_down: ['Vers le bas', 'Down', 'Ɣer wadda'], o_up: ['Vers le haut', 'Up', 'Ɣer usawen'],
    // blend modes
    b_normal: ['Normal', 'Normal', 'Amagnu'], b_screen: ['Superposition claire (écran)', 'Screen', 'Agdil'], b_multiply: ['Produit', 'Multiply', 'Asgat'],
    b_difference: ['Différence', 'Difference', 'Amgarad'], b_add: ['Addition', 'Add', 'Timerna'], b_lighten: ['Éclaircir', 'Lighten', 'Sfaw'],
    b_darken: ['Assombrir', 'Darken', 'Sberken'], b_overlay: ['Incrustation', 'Overlay', 'Asefsi'],
    // presets
    pr_vhs: ['VHS', 'VHS', 'VHS'], pr_datamosh: ['Datamosh', 'Datamosh', 'Datamosh'], pr_sortSoft: ['Sorting doux', 'Soft sorting', 'Asmizzwer arurad'],
    pr_cyber: ['Cyber', 'Cyber', 'Cyber'], pr_neonCrt: ['Néon CRT', 'Neon CRT', 'Neon CRT'], pr_kaleido: ['Kaléido', 'Kaleido', 'Akalidu'],
    pr_bitcrush: ['Bitcrush 8-bit', '8-bit bitcrush', 'Bitcrush 8-bit'], pr_liquid: ['Liquide', 'Liquid', 'Aman'],
    pr_lostSignal: ['Signal perdu', 'Lost signal', 'Asekkil yeɛreq'], pr_melt: ['Fonte', 'Melt', 'Tafsit'], pr_prism: ['Prisme', 'Prism', 'Tamenḍaṛt'],
  };
  const LANGS = ['fr', 'en', 'kab'];
  const idx = (lang) => Math.max(0, LANGS.indexOf(lang));

  // Kabyle Latin → Tifinagh (neo-Tifinagh as used for Taqbaylit). Acronyms, units, names and words with digits are kept.
  const TF = { a: 'ⴰ', b: 'ⴱ', c: 'ⵛ', č: 'ⵞ', d: 'ⴷ', ḍ: 'ⴹ', e: 'ⴻ', é: 'ⴻ', ɛ: 'ⵄ', f: 'ⴼ', g: 'ⴳ', ǧ: 'ⴵ', ɣ: 'ⵖ', h: 'ⵀ', ḥ: 'ⵃ', i: 'ⵉ', j: 'ⵊ', k: 'ⴽ', l: 'ⵍ', m: 'ⵎ', n: 'ⵏ',
    o: 'ⵓ', p: 'ⵒ', q: 'ⵇ', r: 'ⵔ', ṛ: 'ⵕ', s: 'ⵙ', ṣ: 'ⵚ', t: 'ⵜ', ṭ: 'ⵟ', u: 'ⵓ', v: 'ⵠ', w: 'ⵡ', x: 'ⵅ', y: 'ⵢ', z: 'ⵣ', ẓ: 'ⵥ' };
  const KEEP = /^(Glitch|art|Atelier|Ctrl|Alt|WebM|Chrome|Edge|Firefox|Cyber|Neon|Datamosh|Bitcrush|Codec|Sinus|kbd|strong|ul|li|p|px|MIT)$/;
  function toTifinagh(text) {
    return String(text).replace(/(<[^>]*>)|(\{[^}]*\})|([^<{]+)/g, (m, tag, ph, txt) => tag || ph || txt.replace(/[\p{L}\d-]+/gu, (w) => {
      if (/\d/.test(w) || (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w)) || KEEP.test(w)) return w;
      return Array.from(w.toLowerCase()).map((ch) => TF[ch] || ch).join('');
    }));
  }
  /** Translate key into lang; vars fill {placeholders}; tfng renders Kabyle in Tifinagh. Missing key → null-safe fallback. */
  function t(key, lang = 'fr', vars, tfng = false) {
    const e = S[key];
    let s = e ? e[idx(lang)] : key;
    if (lang === 'kab' && tfng) s = toTifinagh(s);
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }
  return { S, LANGS, t, toTifinagh, has: (k) => k in S };
});
