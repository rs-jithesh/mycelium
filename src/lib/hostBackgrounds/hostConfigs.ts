export interface SvgPathDef {
  id: string
  d: string
  strokeWidth: number
  role: 'primary' | 'secondary' | 'tertiary'
}

export interface SeedPoint {
  x: number
  y: number
}

export interface HostConfig {
  id: string
  name: string
  palette: {
    intact: string
    consumed: string
    elementColor: string
    elementColorAlt: string
  }
  topology: {
    type: 'radial' | 'branching' | 'grid' | 'network' | 'field' | 'atmospheric'
    originX: number
    originY: number
    paths: SvgPathDef[]
  }
  mycelium: {
    seedPoints: SeedPoint[]
    maxStrokeWidth: number
    fruitingScale: number
    corruptionRate: number
    hyphaeColor: string
    fruitingColor: string
  }
  animation: {
    shimmerSpeed: number
    pulseElements: string[]
  }
  topoOpacity: number
}

export const hostConfigs: Record<string, HostConfig> = {
  fallen_leaf: {
    id: 'fallen_leaf',
    name: 'The Fallen Leaf',
    palette: {
      intact: '#0d1a08',
      consumed: '#1a0d00',
      elementColor: '#c8a040',
      elementColorAlt: '#a07830',
    },
    topology: {
      type: 'branching',
      originX: 400,
      originY: 225,
      paths: [
        { id: 'midrib', role: 'primary', strokeWidth: 3.5, d: 'M80 225 C200 220 350 222 400 225 C450 228 600 230 720 225' },
        { id: 'vein-l1', role: 'secondary', strokeWidth: 1.8, d: 'M200 223 C210 200 230 175 255 155' },
        { id: 'vein-r1', role: 'secondary', strokeWidth: 1.8, d: 'M200 227 C210 250 230 275 255 295' },
        { id: 'vein-l2', role: 'secondary', strokeWidth: 1.8, d: 'M300 222 C315 195 340 168 370 148' },
        { id: 'vein-r2', role: 'secondary', strokeWidth: 1.8, d: 'M300 228 C315 255 340 282 370 302' },
        { id: 'vein-l3', role: 'secondary', strokeWidth: 1.8, d: 'M420 224 C440 195 465 168 495 150' },
        { id: 'vein-r3', role: 'secondary', strokeWidth: 1.8, d: 'M420 226 C440 255 465 282 495 300' },
        { id: 'vein-l4', role: 'secondary', strokeWidth: 1.4, d: 'M540 223 C558 200 578 178 605 162' },
        { id: 'vein-r4', role: 'secondary', strokeWidth: 1.4, d: 'M540 227 C558 250 578 272 605 288' },
        { id: 'tert-1', role: 'tertiary', strokeWidth: 0.6, d: 'M255 155 C275 175 285 195 300 222' },
        { id: 'tert-2', role: 'tertiary', strokeWidth: 0.6, d: 'M255 295 C275 275 285 255 300 228' },
        { id: 'tert-3', role: 'tertiary', strokeWidth: 0.6, d: 'M370 148 C385 170 395 195 420 224' },
        { id: 'tert-4', role: 'tertiary', strokeWidth: 0.6, d: 'M370 302 C385 280 395 255 420 226' },
        { id: 'margin', role: 'primary', strokeWidth: 1.2, d: 'M80 225 C100 160 200 80 400 60 C600 80 700 160 720 225 C700 290 600 370 400 390 C200 370 100 290 80 225 Z' },
      ],
    },
    mycelium: {
      seedPoints: [
        { x: 255, y: 155 },
        { x: 255, y: 295 },
        { x: 370, y: 148 },
        { x: 370, y: 302 },
        { x: 495, y: 150 },
        { x: 495, y: 300 },
      ],
      maxStrokeWidth: 2.0,
      fruitingScale: 2.5,
      corruptionRate: 0.8,
      hyphaeColor: '#7a5818',
      fruitingColor: '#5a3808',
    },
    animation: {
      shimmerSpeed: 0,
      pulseElements: ['margin'],
    },
    topoOpacity: 0,
  },

  woodlouse: {
    id: 'woodlouse',
    name: 'The Woodlouse',
    palette: {
      intact: '#0a1208',
      consumed: '#180d00',
      elementColor: '#7a9060',
      elementColorAlt: '#506040',
    },
    topology: {
      type: 'radial',
      originX: 400,
      originY: 225,
      paths: [
        { id: 'seg-1', role: 'primary', strokeWidth: 2.0, d: 'M160 225 C160 180 230 155 280 155 C330 155 370 180 370 225 C370 270 330 295 280 295 C230 295 160 270 160 225' },
        { id: 'seg-2', role: 'primary', strokeWidth: 2.0, d: 'M220 225 C220 185 285 162 330 162 C375 162 420 185 420 225 C420 265 375 288 330 288 C285 288 220 265 220 225' },
        { id: 'seg-3', role: 'primary', strokeWidth: 2.0, d: 'M280 225 C280 188 340 166 385 166 C430 166 475 188 475 225 C475 262 430 284 385 284 C340 284 280 262 280 225' },
        { id: 'seg-4', role: 'primary', strokeWidth: 2.0, d: 'M340 225 C340 190 395 170 438 170 C481 170 530 190 530 225 C530 260 481 280 438 280 C395 280 340 260 340 225' },
        { id: 'seg-5', role: 'primary', strokeWidth: 2.0, d: 'M400 225 C400 192 452 174 492 174 C532 174 580 192 580 225 C580 258 532 276 492 276 C452 276 400 258 400 225' },
        { id: 'seg-6', role: 'secondary', strokeWidth: 1.5, d: 'M460 225 C460 194 508 178 545 178 C582 178 625 194 625 225 C625 256 582 272 545 272 C508 272 460 256 460 225' },
        { id: 'seg-7', role: 'secondary', strokeWidth: 1.5, d: 'M520 225 C520 197 562 182 596 182 C630 182 668 197 668 225 C668 253 630 268 596 268 C562 268 520 253 520 225' },
        { id: 'antenna-l', role: 'tertiary', strokeWidth: 0.8, d: 'M175 215 C150 190 120 165 90 140' },
        { id: 'antenna-r', role: 'tertiary', strokeWidth: 0.8, d: 'M175 235 C150 260 120 285 90 310' },
        { id: 'legs', role: 'tertiary', strokeWidth: 0.6, d: 'M220 268 L200 290 M280 272 L265 296 M340 274 L328 299 M400 274 L390 300 M460 272 L452 297 M520 268 L514 294 M575 262 L572 287' },
      ],
    },
    mycelium: {
      seedPoints: [
        { x: 280, y: 155 },
        { x: 400, y: 174 },
        { x: 545, y: 178 },
        { x: 220, y: 295 },
        { x: 438, y: 280 },
        { x: 596, y: 268 },
      ],
      maxStrokeWidth: 2.2,
      fruitingScale: 2.8,
      corruptionRate: 1.0,
      hyphaeColor: '#8a6020',
      fruitingColor: '#604010',
    },
    animation: {
      shimmerSpeed: 0,
      pulseElements: ['seg-1', 'seg-4', 'seg-7'],
    },
    topoOpacity: 0,
  },

  ant_colony: {
    id: 'ant_colony',
    name: 'The Ant Colony',
    palette: {
      intact: '#0e1408',
      consumed: '#1c0d00',
      elementColor: '#c8a850',
      elementColorAlt: '#a08038',
    },
    topology: {
      type: 'network',
      originX: 400,
      originY: 380,
      paths: [
        { id: 'queen-chamber', role: 'primary', strokeWidth: 2.5, d: 'M330 370 C330 345 362 330 400 330 C438 330 470 345 470 370 C470 395 438 410 400 410 C362 410 330 395 330 370' },
        { id: 'trunk-l', role: 'primary', strokeWidth: 2.8, d: 'M370 330 C355 280 330 220 310 160 C295 110 270 70 250 30' },
        { id: 'trunk-c', role: 'primary', strokeWidth: 3.2, d: 'M400 330 C400 270 400 200 400 130 C400 85 400 50 400 10' },
        { id: 'trunk-r', role: 'primary', strokeWidth: 2.8, d: 'M430 330 C445 280 470 220 490 160 C505 110 530 70 550 30' },
        { id: 'branch-ll', role: 'secondary', strokeWidth: 1.5, d: 'M330 200 C290 190 240 185 190 180 C150 176 110 175 70 175' },
        { id: 'branch-lm', role: 'secondary', strokeWidth: 1.5, d: 'M320 130 C280 118 230 112 180 108 C140 105 100 104 60 104' },
        { id: 'branch-rl', role: 'secondary', strokeWidth: 1.5, d: 'M470 200 C510 190 560 185 610 180 C650 176 690 175 730 175' },
        { id: 'branch-rm', role: 'secondary', strokeWidth: 1.5, d: 'M480 130 C520 118 570 112 620 108 C660 105 700 104 740 104' },
        { id: 'branch-top', role: 'secondary', strokeWidth: 1.5, d: 'M375 60 C340 55 295 52 250 52 C210 52 175 54 140 58' },
        { id: 'branch-topr', role: 'secondary', strokeWidth: 1.5, d: 'M425 60 C460 55 505 52 550 52 C590 52 625 54 660 58' },
        { id: 'chamber-1', role: 'tertiary', strokeWidth: 1.0, d: 'M165 172 C165 162 175 156 185 156 C195 156 205 162 205 172 C205 182 195 188 185 188 C175 188 165 182 165 172' },
        { id: 'chamber-2', role: 'tertiary', strokeWidth: 1.0, d: 'M155 100 C155 90 165 84 175 84 C185 84 195 90 195 100 C195 110 185 116 175 116 C165 116 155 110 155 100' },
        { id: 'chamber-3', role: 'tertiary', strokeWidth: 1.0, d: 'M595 172 C595 162 605 156 615 156 C625 156 635 162 635 172 C635 182 625 188 615 188 C605 188 595 182 595 172' },
        { id: 'chamber-4', role: 'tertiary', strokeWidth: 1.0, d: 'M605 100 C605 90 615 84 625 84 C635 84 645 90 645 100 C645 110 635 116 625 116 C615 116 605 110 605 100' },
      ],
    },
    mycelium: {
      seedPoints: [
        { x: 400, y: 380 },
        { x: 185, y: 172 },
        { x: 175, y: 100 },
        { x: 615, y: 172 },
        { x: 625, y: 100 },
        { x: 400, y: 130 },
      ],
      maxStrokeWidth: 2.5,
      fruitingScale: 3.0,
      corruptionRate: 1.2,
      hyphaeColor: '#906820',
      fruitingColor: '#6a4808',
    },
    animation: {
      shimmerSpeed: 0,
      pulseElements: ['queen-chamber', 'trunk-c'],
    },
    topoOpacity: 0,
  },

  rotting_elm: {
    id: 'rotting_elm',
    name: 'The Rotting Elm',
    palette: {
      intact: '#0a1405',
      consumed: '#1a0c00',
      elementColor: '#6a8840',
      elementColorAlt: '#486028',
    },
    topology: {
      type: 'branching',
      originX: 400,
      originY: 420,
      paths: [
        { id: 'trunk', role: 'primary', strokeWidth: 14, d: 'M400 450 C400 400 398 350 395 290 C393 240 390 195 390 150' },
        { id: 'bough-l1', role: 'primary', strokeWidth: 7, d: 'M393 260 C360 240 310 220 265 200 C230 184 195 170 155 158' },
        { id: 'bough-r1', role: 'primary', strokeWidth: 7, d: 'M394 260 C427 240 477 220 522 200 C557 184 592 170 632 158' },
        { id: 'bough-l2', role: 'primary', strokeWidth: 5, d: 'M391 195 C355 175 305 155 255 138 C215 124 170 112 125 102' },
        { id: 'bough-r2', role: 'primary', strokeWidth: 5, d: 'M391 195 C427 175 477 155 527 138 C567 124 612 112 657 102' },
        { id: 'branch-ll1', role: 'secondary', strokeWidth: 2.5, d: 'M265 200 C240 175 215 148 190 120 C172 99 152 80 130 60' },
        { id: 'branch-ll2', role: 'secondary', strokeWidth: 2.0, d: 'M210 170 C185 148 158 125 132 102 C112 84 90 68 65 52' },
        { id: 'branch-lm', role: 'secondary', strokeWidth: 2.0, d: 'M155 158 C135 132 115 105 100 75 C88 52 80 28 75 5' },
        { id: 'branch-rl1', role: 'secondary', strokeWidth: 2.5, d: 'M535 200 C560 175 585 148 610 120 C628 99 648 80 670 60' },
        { id: 'branch-rl2', role: 'secondary', strokeWidth: 2.0, d: 'M590 170 C615 148 642 125 668 102 C688 84 710 68 735 52' },
        { id: 'branch-rm', role: 'secondary', strokeWidth: 2.0, d: 'M645 158 C665 132 685 105 700 75 C712 52 720 28 725 5' },
        { id: 'twig-l1', role: 'tertiary', strokeWidth: 0.8, d: 'M190 120 C175 105 160 90 145 72 M190 120 C180 102 172 85 162 68' },
        { id: 'twig-l2', role: 'tertiary', strokeWidth: 0.8, d: 'M125 102 C108 88 95 72 80 55 M125 102 C115 85 108 68 100 50' },
        { id: 'twig-r1', role: 'tertiary', strokeWidth: 0.8, d: 'M610 120 C625 105 640 90 655 72 M610 120 C620 102 628 85 638 68' },
        { id: 'twig-r2', role: 'tertiary', strokeWidth: 0.8, d: 'M675 102 C692 88 705 72 720 55 M675 102 C685 85 692 68 700 50' },
        { id: 'root-l', role: 'tertiary', strokeWidth: 1.8, d: 'M385 420 C360 430 320 438 280 442 C248 445 215 444 185 440' },
        { id: 'root-r', role: 'tertiary', strokeWidth: 1.8, d: 'M415 420 C440 430 480 438 520 442 C552 445 585 444 615 440' },
        { id: 'root-dl', role: 'tertiary', strokeWidth: 1.2, d: 'M370 440 C345 448 310 452 270 450' },
        { id: 'root-dr', role: 'tertiary', strokeWidth: 1.2, d: 'M430 440 C455 448 490 452 530 450' },
      ],
    },
    mycelium: {
      seedPoints: [
        { x: 400, y: 290 },
        { x: 265, y: 200 },
        { x: 535, y: 200 },
        { x: 155, y: 158 },
        { x: 632, y: 158 },
        { x: 390, y: 150 },
      ],
      maxStrokeWidth: 3.0,
      fruitingScale: 3.5,
      corruptionRate: 1.4,
      hyphaeColor: '#8a5c18',
      fruitingColor: '#6a3c08',
    },
    animation: {
      shimmerSpeed: 0,
      pulseElements: ['trunk', 'bough-l1', 'bough-r1'],
    },
    topoOpacity: 0.12,
  },

  corvid: {
    id: 'corvid',
    name: 'The Corvid',
    palette: {
      intact: '#080c12',
      consumed: '#180a00',
      elementColor: '#8890b0',
      elementColorAlt: '#606888',
    },
    topology: {
      type: 'radial',
      originX: 400,
      originY: 200,
      paths: [
        { id: 'spine', role: 'primary', strokeWidth: 2.5, d: 'M340 180 C355 190 375 200 400 205 C425 210 455 208 475 200 C495 192 510 182 520 170' },
        { id: 'skull', role: 'primary', strokeWidth: 1.8, d: 'M290 155 C290 120 320 100 350 100 C380 100 410 120 415 148 C420 170 408 188 395 195 C378 204 355 205 340 195 C318 180 290 175 290 155' },
        { id: 'beak', role: 'secondary', strokeWidth: 1.5, d: 'M290 155 C268 148 248 142 225 138 C210 135 200 136 195 140' },
        { id: 'wing-l', role: 'primary', strokeWidth: 2.0, d: 'M360 195 C320 185 260 172 190 162 C140 155 95 154 45 158 C25 160 10 165 0 172' },
        { id: 'wing-r', role: 'primary', strokeWidth: 2.0, d: 'M440 195 C480 185 540 172 610 162 C660 155 705 154 755 158 C775 160 790 165 800 172' },
        { id: 'feather-l1', role: 'secondary', strokeWidth: 0.9, d: 'M260 170 C255 185 248 198 240 212 C233 224 224 234 215 242' },
        { id: 'feather-l2', role: 'secondary', strokeWidth: 0.9, d: 'M190 162 C182 178 174 194 165 208 C157 220 148 230 138 240' },
        { id: 'feather-l3', role: 'secondary', strokeWidth: 0.9, d: 'M120 156 C110 172 100 188 90 202 C81 214 70 225 58 234' },
        { id: 'feather-r1', role: 'secondary', strokeWidth: 0.9, d: 'M540 170 C545 185 552 198 560 212 C567 224 576 234 585 242' },
        { id: 'feather-r2', role: 'secondary', strokeWidth: 0.9, d: 'M610 162 C618 178 626 194 635 208 C643 220 652 230 662 240' },
        { id: 'feather-r3', role: 'secondary', strokeWidth: 0.9, d: 'M680 156 C690 172 700 188 710 202 C719 214 730 225 742 234' },
        { id: 'leg-l', role: 'tertiary', strokeWidth: 1.2, d: 'M375 210 C370 240 365 268 360 295 C357 310 355 325 355 340' },
        { id: 'leg-r', role: 'tertiary', strokeWidth: 1.2, d: 'M425 210 C430 240 435 268 440 295 C443 310 445 325 445 340' },
        { id: 'talon-l', role: 'tertiary', strokeWidth: 0.8, d: 'M355 340 C340 348 322 352 305 350 M355 340 C348 355 340 368 330 378 M355 340 C358 355 360 368 360 382' },
        { id: 'talon-r', role: 'tertiary', strokeWidth: 0.8, d: 'M445 340 C460 348 478 352 495 350 M445 340 C452 355 460 368 470 378 M445 340 C442 355 440 368 440 382' },
        { id: 'neural-1', role: 'tertiary', strokeWidth: 0.5, d: 'M350 110 C342 95 330 82 318 70 C308 60 296 52 282 46' },
        { id: 'neural-2', role: 'tertiary', strokeWidth: 0.5, d: 'M370 102 C365 85 358 70 350 56 C342 44 332 34 320 26' },
        { id: 'neural-3', role: 'tertiary', strokeWidth: 0.5, d: 'M395 100 C395 82 394 65 392 48 C390 34 386 21 380 10' },
      ],
    },
    mycelium: {
      seedPoints: [
        { x: 400, y: 205 },
        { x: 290, y: 155 },
        { x: 190, y: 162 },
        { x: 610, y: 162 },
        { x: 360, y: 295 },
        { x: 440, y: 295 },
      ],
      maxStrokeWidth: 2.0,
      fruitingScale: 2.8,
      corruptionRate: 1.1,
      hyphaeColor: '#7a5c28',
      fruitingColor: '#5a3c10',
    },
    animation: {
      shimmerSpeed: 0,
      pulseElements: ['skull', 'neural-1', 'neural-2', 'neural-3'],
    },
    topoOpacity: 0,
  },

  boar: {
    id: 'boar',
    name: 'The Boar',
    palette: {
      intact: '#0c1008',
      consumed: '#1e0c00',
      elementColor: '#a09060',
      elementColorAlt: '#786840',
    },
    topology: {
      type: 'radial',
      originX: 400,
      originY: 240,
      paths: [
        { id: 'body-outline', role: 'primary', strokeWidth: 2.0, d: 'M120 240 C120 180 160 130 220 110 C265 95 315 92 370 95 C410 97 445 105 470 118 C510 136 540 165 555 195 C575 232 570 265 555 290 C535 322 500 340 460 348 C420 356 375 355 335 348 C290 340 250 325 220 305 C170 278 120 268 120 240' },
        { id: 'head', role: 'primary', strokeWidth: 1.8, d: 'M120 240 C105 228 88 215 70 205 C55 196 40 192 25 192 C15 192 8 196 5 202' },
        { id: 'snout', role: 'secondary', strokeWidth: 1.2, d: 'M25 192 C18 185 14 176 14 168 C14 158 20 150 30 148 C40 146 50 150 55 158' },
        { id: 'tusk-t', role: 'secondary', strokeWidth: 1.5, d: 'M30 148 C22 138 18 125 20 112 C22 102 28 95 36 92' },
        { id: 'tusk-b', role: 'secondary', strokeWidth: 1.0, d: 'M35 158 C28 150 24 140 26 130' },
        { id: 'spine', role: 'secondary', strokeWidth: 1.5, d: 'M200 95 C240 85 295 80 350 80 C400 80 440 84 475 92' },
        { id: 'vasc-spine', role: 'secondary', strokeWidth: 1.8, d: 'M340 180 C350 195 368 210 390 220 C410 228 432 232 450 228 C468 224 480 212 485 198' },
        { id: 'vasc-fore-l', role: 'secondary', strokeWidth: 1.4, d: 'M220 240 C210 265 205 295 205 325 C205 348 208 368 212 385' },
        { id: 'vasc-fore-r', role: 'secondary', strokeWidth: 1.4, d: 'M310 245 C308 270 308 298 310 325 C312 350 316 370 320 388' },
        { id: 'vasc-hind-l', role: 'secondary', strokeWidth: 1.4, d: 'M420 340 C418 362 418 385 420 405 C422 422 426 436 430 448' },
        { id: 'vasc-hind-r', role: 'secondary', strokeWidth: 1.4, d: 'M490 330 C492 352 494 375 496 395 C498 412 502 428 506 442' },
        { id: 'cap-1', role: 'tertiary', strokeWidth: 0.5, d: 'M280 150 C295 162 308 175 318 190 C326 202 330 215 330 228' },
        { id: 'cap-2', role: 'tertiary', strokeWidth: 0.5, d: 'M360 130 C368 148 374 168 378 188 C381 205 382 222 382 240' },
        { id: 'cap-3', role: 'tertiary', strokeWidth: 0.5, d: 'M430 140 C438 158 444 178 448 198 C451 215 452 232 450 250' },
        { id: 'cap-4', role: 'tertiary', strokeWidth: 0.5, d: 'M240 210 C258 220 272 232 282 248 C290 261 294 275 294 290' },
        { id: 'cap-5', role: 'tertiary', strokeWidth: 0.5, d: 'M460 220 C472 232 482 246 488 262 C493 275 494 290 492 305' },
      ],
    },
    mycelium: {
      seedPoints: [
        { x: 390, y: 220 },
        { x: 220, y: 240 },
        { x: 420, y: 340 },
        { x: 490, y: 330 },
        { x: 340, y: 180 },
        { x: 200, y: 95 },
      ],
      maxStrokeWidth: 3.2,
      fruitingScale: 3.8,
      corruptionRate: 1.5,
      hyphaeColor: '#905820',
      fruitingColor: '#6a3c0a',
    },
    animation: {
      shimmerSpeed: 0,
      pulseElements: ['vasc-spine', 'body-outline'],
    },
    topoOpacity: 0,
  },

  river_network: {
    id: 'river_network',
    name: 'The River Network',
    palette: {
      intact: '#0a0e0d',
      consumed: '#1a0d00',
      elementColor: '#4a8faa',
      elementColorAlt: '#2a6080',
    },
    topology: {
      type: 'network',
      originX: 400,
      originY: 225,
      paths: [
        { id: 'trunk', role: 'primary', strokeWidth: 4.0, d: 'M400 0 C398 80 410 140 400 225 C390 310 405 370 400 450' },
        { id: 'trib-l1', role: 'secondary', strokeWidth: 2.5, d: 'M180 0 C200 40 240 80 300 130 C340 165 370 195 400 225' },
        { id: 'trib-l2', role: 'secondary', strokeWidth: 1.8, d: 'M60 55 C120 88 200 128 280 168 C330 192 368 210 400 225' },
        { id: 'trib-l3', role: 'tertiary', strokeWidth: 1.2, d: 'M0 175 C80 185 180 198 280 210 C330 215 368 220 400 225' },
        { id: 'trib-r1', role: 'secondary', strokeWidth: 2.5, d: 'M620 0 C600 40 560 80 500 130 C460 165 430 195 400 225' },
        { id: 'trib-r2', role: 'secondary', strokeWidth: 1.8, d: 'M740 55 C680 88 600 128 520 168 C470 192 432 210 400 225' },
        { id: 'trib-r3', role: 'tertiary', strokeWidth: 1.2, d: 'M800 175 C720 185 620 198 520 210 C470 215 432 220 400 225' },
        { id: 'dist-l', role: 'secondary', strokeWidth: 2.5, d: 'M400 225 C370 280 310 330 220 390 C165 425 95 445 30 450' },
        { id: 'dist-r', role: 'secondary', strokeWidth: 2.5, d: 'M400 225 C430 280 490 330 580 390 C635 425 705 445 770 450' },
        { id: 'dist-cl', role: 'tertiary', strokeWidth: 1.2, d: 'M400 225 C385 290 365 345 340 390 C320 425 295 442 265 450' },
        { id: 'dist-cr', role: 'tertiary', strokeWidth: 1.2, d: 'M400 225 C415 290 435 345 460 390 C480 425 505 442 535 450' },
      ],
    },
    mycelium: {
      seedPoints: [
        { x: 400, y: 225 },
        { x: 300, y: 130 },
        { x: 500, y: 130 },
        { x: 220, y: 390 },
        { x: 580, y: 390 },
        { x: 150, y: 180 },
      ],
      maxStrokeWidth: 2.8,
      fruitingScale: 3.2,
      corruptionRate: 1.3,
      hyphaeColor: '#8a6020',
      fruitingColor: '#6a4010',
    },
    animation: {
      shimmerSpeed: 3.5,
      pulseElements: ['trunk', 'dist-l', 'dist-r'],
    },
    topoOpacity: 0.18,
  },

  old_growth_forest: {
    id: 'old_growth_forest',
    name: 'The Old-Growth Forest',
    palette: {
      intact: '#060e04',
      consumed: '#1c0c00',
      elementColor: '#3a6828',
      elementColorAlt: '#284c18',
    },
    topology: {
      type: 'network',
      originX: 400,
      originY: 380,
      paths: [
        { id: 'tree-1', role: 'primary', strokeWidth: 1.5, d: 'M150 120 C150 75 185 48 220 48 C255 48 290 75 290 120 C290 165 255 192 220 192 C185 192 150 165 150 120' },
        { id: 'tree-2', role: 'primary', strokeWidth: 1.5, d: 'M310 80 C310 38 342 12 375 12 C408 12 440 38 440 80 C440 122 408 148 375 148 C342 148 310 122 310 80' },
        { id: 'tree-3', role: 'primary', strokeWidth: 1.5, d: 'M475 100 C475 58 507 32 540 32 C573 32 605 58 605 100 C605 142 573 168 540 168 C507 168 475 142 475 100' },
        { id: 'tree-4', role: 'primary', strokeWidth: 1.5, d: 'M620 155 C620 115 650 90 678 90 C706 90 735 115 735 155 C735 195 706 220 678 220 C650 220 620 195 620 155' },
        { id: 'tree-5', role: 'primary', strokeWidth: 1.5, d: 'M60 220 C60 182 88 158 114 158 C140 158 168 182 168 220 C168 258 140 282 114 282 C88 282 60 258 60 220' },
        { id: 'tree-6', role: 'primary', strokeWidth: 1.5, d: 'M200 305 C200 270 226 248 250 248 C274 248 300 270 300 305 C300 340 274 362 250 362 C226 362 200 340 200 305' },
        { id: 'tree-7', role: 'primary', strokeWidth: 1.5, d: 'M500 290 C500 255 526 233 550 233 C574 233 600 255 600 290 C600 325 574 347 550 347 C526 347 500 325 500 290' },
        { id: 'root-1', role: 'secondary', strokeWidth: 0.8, d: 'M220 192 C215 220 210 250 205 278 C201 300 198 320 196 340' },
        { id: 'root-2', role: 'secondary', strokeWidth: 0.8, d: 'M375 148 C372 178 368 210 365 240 C362 265 360 288 358 310' },
        { id: 'root-3', role: 'secondary', strokeWidth: 0.8, d: 'M540 168 C538 198 536 230 534 260 C532 285 530 308 528 330' },
        { id: 'root-4', role: 'secondary', strokeWidth: 0.8, d: 'M678 220 C674 248 670 278 666 305 C662 328 658 350 654 368' },
        { id: 'root-5', role: 'secondary', strokeWidth: 0.8, d: 'M114 282 C114 308 115 335 116 360 C117 380 118 398 120 415' },
        { id: 'root-6', role: 'secondary', strokeWidth: 0.8, d: 'M250 362 C250 382 250 400 250 418 C250 432 250 444 250 455' },
        { id: 'root-7', role: 'secondary', strokeWidth: 0.8, d: 'M550 347 C549 368 548 388 546 408 C545 424 543 438 540 450' },
        { id: 'wwweb-1', role: 'tertiary', strokeWidth: 0.6, d: 'M205 310 C250 320 305 328 360 330 C400 331 430 330 460 325' },
        { id: 'wwweb-2', role: 'tertiary', strokeWidth: 0.6, d: 'M196 350 C230 358 275 364 325 366 C365 367 400 365 435 360' },
        { id: 'wwweb-3', role: 'tertiary', strokeWidth: 0.6, d: 'M360 330 C400 335 445 338 490 338 C520 337 548 334 575 328' },
        { id: 'wwweb-4', role: 'tertiary', strokeWidth: 0.6, d: 'M120 380 C165 385 218 390 272 392 C315 393 355 392 395 388' },
        { id: 'wwweb-5', role: 'tertiary', strokeWidth: 0.6, d: 'M460 325 C500 320 540 318 578 318 C608 318 638 320 662 325' },
      ],
    },
    mycelium: {
      seedPoints: [
        { x: 400, y: 380 },
        { x: 205, y: 310 },
        { x: 360, y: 330 },
        { x: 540, y: 320 },
        { x: 120, y: 380 },
        { x: 660, y: 340 },
      ],
      maxStrokeWidth: 2.2,
      fruitingScale: 3.0,
      corruptionRate: 0.9,
      hyphaeColor: '#7a5c18',
      fruitingColor: '#5a3c08',
    },
    animation: {
      shimmerSpeed: 0,
      pulseElements: ['wwweb-1', 'wwweb-2', 'wwweb-3', 'wwweb-4', 'wwweb-5'],
    },
    topoOpacity: 0.15,
  },

  agricultural_system: {
    id: 'agricultural_system',
    name: 'The Agricultural System',
    palette: {
      intact: '#0c1008',
      consumed: '#200e00',
      elementColor: '#a0b840',
      elementColorAlt: '#708028',
    },
    topology: {
      type: 'grid',
      originX: 400,
      originY: 225,
      paths: [
        { id: 'field-1', role: 'primary', strokeWidth: 1.0, d: 'M40 40 L280 40 L280 200 L40 200 Z' },
        { id: 'field-2', role: 'primary', strokeWidth: 1.0, d: 'M295 40 L520 40 L520 200 L295 200 Z' },
        { id: 'field-3', role: 'primary', strokeWidth: 1.0, d: 'M535 40 L760 40 L760 200 L535 200 Z' },
        { id: 'field-4', role: 'primary', strokeWidth: 1.0, d: 'M40 215 L190 215 L190 380 L40 380 Z' },
        { id: 'field-5', role: 'primary', strokeWidth: 1.0, d: 'M205 215 L450 215 L450 410 L205 410 Z' },
        { id: 'field-6', role: 'primary', strokeWidth: 1.0, d: 'M465 215 L640 215 L640 380 L465 380 Z' },
        { id: 'field-7', role: 'primary', strokeWidth: 1.0, d: 'M655 215 L760 215 L760 380 L655 380 Z' },
        { id: 'rows-1', role: 'tertiary', strokeWidth: 0.4, d: 'M40 65 L280 65 M40 90 L280 90 M40 115 L280 115 M40 140 L280 140 M40 165 L280 165' },
        { id: 'rows-2', role: 'tertiary', strokeWidth: 0.4, d: 'M295 65 L520 65 M295 90 L520 90 M295 115 L520 115 M295 140 L520 140 M295 165 L520 165' },
        { id: 'rows-3', role: 'tertiary', strokeWidth: 0.4, d: 'M205 240 L450 240 M205 265 L450 265 M205 290 L450 290 M205 315 L450 315 M205 340 L450 340 M205 365 L450 365 M205 390 L450 390' },
        { id: 'irrig-main', role: 'secondary', strokeWidth: 2.2, d: 'M400 0 L400 450' },
        { id: 'irrig-h1', role: 'secondary', strokeWidth: 1.6, d: 'M0 120 L800 120' },
        { id: 'irrig-h2', role: 'secondary', strokeWidth: 1.6, d: 'M0 310 L800 310' },
        { id: 'irrig-branch-l', role: 'secondary', strokeWidth: 1.0, d: 'M160 120 L160 310' },
        { id: 'irrig-branch-r', role: 'secondary', strokeWidth: 1.0, d: 'M640 120 L640 310' },
        { id: 'road-v', role: 'secondary', strokeWidth: 1.4, d: 'M285 0 L285 450' },
        { id: 'road-h', role: 'secondary', strokeWidth: 1.4, d: 'M0 205 L800 205' },
        { id: 'silo-1', role: 'primary', strokeWidth: 1.2, d: 'M350 85 L395 85 L395 118 L350 118 Z' },
        { id: 'silo-2', role: 'primary', strokeWidth: 1.2, d: 'M410 85 L455 85 L455 118 L410 118 Z' },
        { id: 'silo-3', role: 'primary', strokeWidth: 1.2, d: 'M348 295 L398 295 L398 348 L348 348 Z' },
        { id: 'supply-route', role: 'secondary', strokeWidth: 1.8, d: 'M0 0 C80 50 180 110 285 165 C360 205 400 225 450 265 C540 330 660 395 800 450' },
      ],
    },
    mycelium: {
      seedPoints: [
        { x: 400, y: 225 },
        { x: 160, y: 215 },
        { x: 640, y: 215 },
        { x: 285, y: 310 },
        { x: 400, y: 120 },
        { x: 515, y: 310 },
      ],
      maxStrokeWidth: 2.5,
      fruitingScale: 3.5,
      corruptionRate: 1.6,
      hyphaeColor: '#8a6818',
      fruitingColor: '#684809',
    },
    animation: {
      shimmerSpeed: 0,
      pulseElements: ['irrig-main', 'irrig-h1', 'irrig-h2', 'supply-route'],
    },
    topoOpacity: 0.08,
  },

  urban_microbiome: {
    id: 'urban_microbiome',
    name: 'The Urban Microbiome',
    palette: {
      intact: '#080c10',
      consumed: '#1c0a00',
      elementColor: '#6878a8',
      elementColorAlt: '#485888',
    },
    topology: {
      type: 'grid',
      originX: 400,
      originY: 225,
      paths: [
        { id: 'block-1', role: 'tertiary', strokeWidth: 0.5, d: 'M60 60 L180 60 L180 140 L60 140 Z' },
        { id: 'block-2', role: 'tertiary', strokeWidth: 0.5, d: 'M200 60 L310 60 L310 100 L200 100 Z' },
        { id: 'block-3', role: 'tertiary', strokeWidth: 0.5, d: 'M200 115 L310 115 L310 190 L200 190 Z' },
        { id: 'block-4', role: 'tertiary', strokeWidth: 0.5, d: 'M330 60 L490 60 L490 180 L330 180 Z' },
        { id: 'block-5', role: 'tertiary', strokeWidth: 0.5, d: 'M510 60 L640 60 L640 120 L510 120 Z' },
        { id: 'block-6', role: 'tertiary', strokeWidth: 0.5, d: 'M510 135 L620 135 L620 200 L510 200 Z' },
        { id: 'block-7', role: 'tertiary', strokeWidth: 0.5, d: 'M655 60 L760 60 L760 200 L655 200 Z' },
        { id: 'block-8', role: 'tertiary', strokeWidth: 0.5, d: 'M60 200 L160 200 L160 320 L60 320 Z' },
        { id: 'block-9', role: 'tertiary', strokeWidth: 0.5, d: 'M60 335 L200 335 L200 420 L60 420 Z' },
        { id: 'block-10', role: 'tertiary', strokeWidth: 0.5, d: 'M600 280 L760 280 L760 420 L600 420 Z' },
        { id: 'transit-h1', role: 'primary', strokeWidth: 3.0, d: 'M0 155 C100 155 200 157 320 160 C380 162 400 162 440 162 C560 162 660 160 800 158' },
        { id: 'transit-h2', role: 'primary', strokeWidth: 2.5, d: 'M0 260 C120 258 250 256 380 255 C400 255 420 255 450 256 C580 258 680 260 800 262' },
        { id: 'transit-v1', role: 'primary', strokeWidth: 2.5, d: 'M185 0 C184 80 183 155 182 225 C181 295 180 360 180 450' },
        { id: 'transit-v2', role: 'primary', strokeWidth: 3.0, d: 'M400 0 C400 80 400 155 400 225 C400 295 400 360 400 450' },
        { id: 'transit-v3', role: 'primary', strokeWidth: 2.5, d: 'M635 0 C635 80 636 155 637 225 C638 295 638 360 638 450' },
        { id: 'power-1', role: 'secondary', strokeWidth: 0.8, d: 'M0 0 L182 155 L400 225 L637 158 L800 0' },
        { id: 'power-2', role: 'secondary', strokeWidth: 0.8, d: 'M0 450 L182 260 L400 225 L637 258 L800 450' },
        { id: 'data-1', role: 'tertiary', strokeWidth: 0.4, d: 'M400 225 C360 200 310 175 255 152 C210 133 160 118 105 105' },
        { id: 'data-2', role: 'tertiary', strokeWidth: 0.4, d: 'M400 225 C440 200 490 175 545 152 C590 133 640 118 695 105' },
        { id: 'data-3', role: 'tertiary', strokeWidth: 0.4, d: 'M400 225 C375 255 340 285 295 312 C258 335 215 355 165 372' },
        { id: 'data-4', role: 'tertiary', strokeWidth: 0.4, d: 'M400 225 C425 255 460 285 505 312 C542 335 585 355 635 372' },
        { id: 'hub-center', role: 'primary', strokeWidth: 1.5, d: 'M385 210 L415 210 L415 240 L385 240 Z' },
        { id: 'hub-nw', role: 'secondary', strokeWidth: 1.2, d: 'M168 142 L196 142 L196 168 L168 168 Z' },
        { id: 'hub-ne', role: 'secondary', strokeWidth: 1.2, d: 'M623 145 L651 145 L651 171 L623 171 Z' },
        { id: 'hub-sw', role: 'secondary', strokeWidth: 1.2, d: 'M168 242 L196 242 L196 268 L168 268 Z' },
        { id: 'hub-se', role: 'secondary', strokeWidth: 1.2, d: 'M623 242 L651 242 L651 268 L623 268 Z' },
      ],
    },
    mycelium: {
      seedPoints: [
        { x: 400, y: 225 },
        { x: 182, y: 155 },
        { x: 637, y: 158 },
        { x: 182, y: 260 },
        { x: 637, y: 258 },
        { x: 400, y: 162 },
      ],
      maxStrokeWidth: 2.0,
      fruitingScale: 2.5,
      corruptionRate: 1.8,
      hyphaeColor: '#886030',
      fruitingColor: '#684018',
    },
    animation: {
      shimmerSpeed: 2.0,
      pulseElements: ['hub-center', 'transit-h1', 'transit-v2', 'power-1', 'power-2'],
    },
    topoOpacity: 0.05,
  },

  biosphere: {
    id: 'biosphere',
    name: 'The Biosphere',
    palette: {
      intact: '#04080e',
      consumed: '#1e0800',
      elementColor: '#2860a0',
      elementColorAlt: '#184880',
    },
    topology: {
      type: 'atmospheric',
      originX: 400,
      originY: 225,
      paths: [
        { id: 'atmos-1', role: 'tertiary', strokeWidth: 0.6, d: 'M0 75 C200 70 400 72 600 70 C680 69 740 70 800 72' },
        { id: 'atmos-2', role: 'tertiary', strokeWidth: 0.6, d: 'M0 150 C200 148 400 150 600 148 C680 147 740 148 800 150' },
        { id: 'atmos-3', role: 'tertiary', strokeWidth: 0.6, d: 'M0 300 C200 302 400 300 600 302 C680 303 740 302 800 300' },
        { id: 'atmos-4', role: 'tertiary', strokeWidth: 0.6, d: 'M0 375 C200 378 400 375 600 378 C680 379 740 378 800 375' },
        { id: 'continent-1', role: 'primary', strokeWidth: 1.5, d: 'M80 100 C100 80 140 68 185 72 C230 76 268 95 290 122 C312 150 315 180 300 205 C282 232 250 245 215 242 C175 238 140 220 115 195 C88 168 68 128 80 100' },
        { id: 'continent-2', role: 'primary', strokeWidth: 1.5, d: 'M310 80 C340 58 388 48 430 55 C472 62 505 85 518 115 C532 148 522 182 498 205 C472 230 435 238 398 232 C358 225 325 205 312 178 C298 148 296 108 310 80' },
        { id: 'continent-3', role: 'primary', strokeWidth: 1.5, d: 'M540 95 C565 72 608 62 648 70 C688 78 715 102 720 132 C726 162 710 192 685 208 C658 226 622 228 592 215 C560 200 540 175 535 148 C530 122 522 112 540 95' },
        { id: 'continent-4', role: 'primary', strokeWidth: 1.5, d: 'M120 270 C145 248 188 240 228 248 C268 256 298 278 308 308 C318 338 305 368 280 382 C252 397 215 396 185 382 C152 366 130 338 122 308 C115 282 102 285 120 270' },
        { id: 'continent-5', role: 'primary', strokeWidth: 1.5, d: 'M380 285 C410 258 458 248 500 258 C542 268 568 295 572 325 C576 358 555 385 522 398 C488 412 448 408 420 392 C390 374 368 345 368 315 C368 302 358 305 380 285' },
        { id: 'continent-6', role: 'primary', strokeWidth: 1.5, d: 'M610 268 C638 248 678 242 712 252 C746 262 765 288 762 318 C759 348 740 372 712 382 C682 392 648 385 626 368 C602 350 592 322 596 298 C600 278 590 282 610 268' },
        { id: 'current-n', role: 'secondary', strokeWidth: 1.2, d: 'M60 120 C150 108 260 102 370 105 C430 107 480 112 530 118 C600 128 660 138 730 132' },
        { id: 'current-s', role: 'secondary', strokeWidth: 1.2, d: 'M60 340 C150 355 265 360 375 356 C435 353 485 348 535 342 C605 334 660 328 730 335' },
        { id: 'polar-n', role: 'secondary', strokeWidth: 1.0, d: 'M0 30 C120 22 260 18 400 20 C540 22 680 26 800 30 C780 45 660 50 540 48 C420 46 300 44 180 46 C100 48 40 44 0 30' },
        { id: 'polar-s', role: 'secondary', strokeWidth: 1.0, d: 'M0 420 C120 430 260 434 400 432 C540 430 680 426 800 420 C780 410 660 406 540 408 C420 410 300 412 180 410 C100 408 40 412 0 420' },
        { id: 'integration-ring', role: 'primary', strokeWidth: 2.5, d: 'M400 225 m -160 0 a 160 160 0 1 1 0 0.01' },
      ],
    },
    mycelium: {
      seedPoints: [
        { x: 400, y: 225 },
        { x: 185, y: 142 },
        { x: 420, y: 135 },
        { x: 648, y: 132 },
        { x: 228, y: 318 },
        { x: 500, y: 328 },
        { x: 712, y: 318 },
      ],
      maxStrokeWidth: 2.5,
      fruitingScale: 4.0,
      corruptionRate: 2.0,
      hyphaeColor: '#904818',
      fruitingColor: '#702808',
    },
    animation: {
      shimmerSpeed: 8.0,
      pulseElements: ['integration-ring', 'atmos-1', 'atmos-2', 'atmos-3', 'atmos-4'],
    },
    topoOpacity: 0.2,
  },
}

export function getHostConfigById(id: string): HostConfig | undefined {
  return hostConfigs[id]
}
