import * as d3 from 'd3';
import PropTypes from 'prop-types';
import React, { useEffect, useRef } from 'react';


// Centralized color control
// Toggle which parts receive palette-driven colors (no geometry changes).
const COLOR_CONFIG = Object.freeze({
  applyAxes: true,
  applyLabels: true,
  applyModeStrokes: true,
  applyNodeStroke: true,
  applyNodeFill: false, // off by default to preserve authored fills; set true to enforce palette fill
  applyUsagePictoColors: true, // color controller for usages pictograms
  applyModePictosAndValuesColor: true, // single color for all mode pictograms and V% texts
  showModeValueTexts: true // toggle to show/hide the V% texts
});

// Spline mode de transport Max Value — contrôle la taille (strokeWidth) max des courbes par modes de transport.
const MODE_SPLINE_MAX_STROKE = 15;

// Pictos usages — échelle de taille (min/max) appliquée selon la valeur en % (0..100)
const USAGE_PICTO_MIN_SCALE = 0.1;
const USAGE_PICTO_MAX_SCALE = 2;
// Courbe logistique pour l'échelle des pictos: f(x) = 1/(1+e^{-k(x-x0)})
// k (pente): plus grand => transition plus raide au milieu; x0: point milieu (0..1), 0.5 par défaut
const USAGE_PICTO_SIGMOID_K = 7; // pente par défaut
const USAGE_PICTO_SIGMOID_X0 = 0.4; // milieu de la courbe (dans le style logistic curve)*
// ====
// Courbe logistique peut-être pas une solution de ouf si il ne faut pas comparer les usages mais juste dire les plus cités.

// Légende — constantes de contrôle d'effet hover
// Opacité appliquée aux éléments non ciblés lors du survol d'un item de légende
const LEGEND_HOVER_DIM_OPACITY = 0.25;
// Couleur de surlignage optionnelle (ex. pour bordures d'items survolés)
const LEGEND_HOVER_STROKE = '#00000055';

// Mode légende — contrôle des couleurs par mode (laisser null pour utiliser la palette THEME.modes)
const MODE_LEGEND_COLORS = Object.freeze({
  car: null,
  transit: null,
  bike: null,
  foot: null
});
// Mode légende — opacité lors du survol d'un mode (pour les items non ciblés)
const MODE_LEGEND_HOVER_DIM_OPACITY = 0.25;

function makeTheme(vizColors) {
  // Pull palette safely with fallbacks
  const Cmain = vizColors?.Cmain || {};
  const Ccomplementary = vizColors?.Ccomplementary || {};
  const greys = ['#f5f5f5', '#dcdcdc', '#c4c4c4', '#a9a9a9', '#808080', '#5a5a5a'];

  return Object.freeze({
  modeIconsAndValues: Cmain.base || '#FF7A00',
    modes: {
      // Explicit mapping to avoid dynamic object access
      car: Ccomplementary.contrast || '#07070791',
      transit: Ccomplementary.contrast || '#07070791',
      bike: Ccomplementary.contrast || '#07070791',
      foot: Ccomplementary.contrast || '#07070791'
    },
    usages: {
      // Couleurs des pictos usages (palette || fallback)
      shopping: Cmain.light1 || '#07070791',
      work: Cmain.light1 || '#07070791',
      modal: Cmain.light1 || '#07070791',
      leisure: Cmain.light1 || '#07070791'
    },
    nodes: {
      stroke: Cmain.light1 || '#FF7A00',
      fill: Cmain.light2 || '#FFE8D2'
    },
    labels: {
      fill: '#000000ff' // Nom des destinations
    },
    axes: {
      stroke: greys[1]
    }
  });
}

function scaleForPercent(val) {
  // Map 0..100 => 0..15 px (clamped)
  const v = Number.isFinite(val) ? Math.max(0, Math.min(100, val)) : 0;
  return d3.scaleLinear().domain([0, 100]).range([0, MODE_SPLINE_MAX_STROKE])(v);
}

function scaleUsageForPercent(val) {
  // Map 0..100 => min..max via courbe logistique normalisée
  const v = Number.isFinite(val) ? Math.max(0, Math.min(100, val)) : 0;
  const x = v / 100; // 0..1
  const k = USAGE_PICTO_SIGMOID_K;
  const x0 = USAGE_PICTO_SIGMOID_X0;
  const logistic = (t) => 1 / (1 + Math.exp(-k * (t - x0)));
  const g = logistic(x);
  // Normaliser pour que 0 -> 0 et 1 -> 1 (g0,g1 proches mais ≠ 0/1)
  const g0 = logistic(0);
  const g1 = logistic(1);
  const denom = g1 - g0;
  const gn = denom !== 0 ? (g - g0) / denom : x; // garde-fou linéaire si denom ~ 0
  return USAGE_PICTO_MIN_SCALE + (USAGE_PICTO_MAX_SCALE - USAGE_PICTO_MIN_SCALE) * Math.max(0, Math.min(1, gn));
}

export default function MobilityMegaGraph({ svgPath, data, vizColors, showModeValueTexts }) {
  const ref = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const root = d3.select(ref.current);
    if (!root.node()) return;

    // Clear previous render
    root.selectAll('*').remove();

    // Create an <object> to safely embed the authored SVG document without string injection.
    // Using <object> preserves viewBox and internal structure and lets us select its content after load.
    const obj = root
      .append('object')
      .attr('type', 'image/svg+xml')
      .attr('data', svgPath)
      .attr('aria-label', 'Mobility mega graph')
      .attr('tabindex', 0)
      .style('width', '100%')
      .style('height', 'auto')
      .style('display', 'block');

  function onLoad() {
      const doc = obj.node()?.contentDocument;
      if (!doc) return;
      const svg = d3.select(doc).select('svg');
      if (svg.empty()) return;

      // Disable native browser tooltips: move <title> text to data-title on all elements, then remove <title>
      svg.selectAll('*').each(function () {
        const first = this.firstElementChild;
        if (first && first.tagName && first.tagName.toLowerCase() === 'title') {
          const txt = (first.textContent || '').trim();
          if (txt) this.setAttribute('data-title', txt);
          try { this.removeChild(first); } catch (_) { /* ignore */ }
        }
      });

  // Data binding: for each destination and mode, set stroke-width & stroke color.
    const THEME = makeTheme(vizColors);

    function colorForMode(mode) {
        switch (mode) {
      case 'car': return THEME.modes.car;
      case 'transit': return THEME.modes.transit;
      case 'bike': return THEME.modes.bike;
      case 'foot': return THEME.modes.foot;
          default:
            return '#888888';
        }
      }

      function colorForUsage(usage) {
        switch (usage) {
          case 'shopping': return THEME.usages.shopping;
          case 'work': return THEME.usages.work;
          case 'modal': return THEME.usages.modal;
          default: return '#888888';
        }
      }

      // Helper: retrieve value for (key, mode)
      const getVal = (k, m) => {
        // Secure access: whitelist keys and modes, avoid dynamic object indexing without checks
        let src;
        switch (k) {
          case 'Quartier': src = data?.Quartier; break;
          case 'Nord1': src = data?.Nord1; break;
          case 'Nord2': src = data?.Nord2; break;
          case 'Sud1': src = data?.Sud1; break;
          case 'Sud2': src = data?.Sud2; break;
          case 'Est1': src = data?.Est1; break;
          case 'Est2': src = data?.Est2; break;
          case 'Ouest1': src = data?.Ouest1; break;
          case 'Ouest2': src = data?.Ouest2; break;
          default: src = undefined;
        }
        if (!src || !src.modes) return 0;
        let v;
        switch (m) {
          case 'car': v = src.modes.car?.value; break;
          case 'transit': v = src.modes.transit?.value; break;
          case 'bike': v = src.modes.bike?.value; break;
          case 'foot': v = src.modes.foot?.value; break;
          default: v = 0;
        }
        const num = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(num) ? num : 0;
      };

      // Helper: retrieve usage value for (key, usage)
      const getUsageVal = (k, usage) => {
        let src;
        switch (k) {
          case 'Quartier': src = data?.Quartier; break;
          case 'Nord1': src = data?.Nord1; break;
          case 'Nord2': src = data?.Nord2; break;
          case 'Sud1': src = data?.Sud1; break;
          case 'Sud2': src = data?.Sud2; break;
          case 'Est1': src = data?.Est1; break;
          case 'Est2': src = data?.Est2; break;
          case 'Ouest1': src = data?.Ouest1; break;
          case 'Ouest2': src = data?.Ouest2; break;
          default: src = undefined;
        }
        if (!src || !src.usages) return 0;
        let v;
        switch (usage) {
          case 'shopping': v = src.usages.shopping?.value; break;
          case 'work': v = src.usages.work?.value; break;
          case 'modal': v = src.usages.modal?.value; break;
          default: v = 0;
        }
        const num = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(num) ? num : 0;
      };

      // Map from data-key to data-dest value present in SVG
      function destForKey(k) {
        switch (k) {
          case 'Quartier': return 'Quartier';
          case 'Nord1': return 'NordProche';
          case 'Nord2': return 'NordLoin';
          case 'Sud1': return 'SudProche';
          case 'Sud2': return 'SudLoin';
          case 'Est1': return 'EstProche';
          case 'Est2': return 'EstLoin';
          case 'Ouest1': return 'OuestProche';
          case 'Ouest2': return 'OuestLoin';
          default: return null;
        }
      }

      // Map usage key to French title prefix used in SVG titles
      const usageTitlePrefix = (usage) =>
        usage === 'shopping' ? 'CoursesPictos' :
        usage === 'work' ? 'TravailPictos' :
        usage === 'leisure' ? 'SortiesPictos' : '';

      // Map mode to value title prefix used in SVG value placeholders
      const modeValueTitlePrefix = (mode) =>
        mode === 'car' ? 'VoitureValue' :
        mode === 'transit' ? 'MetroValue' :
        mode === 'bike' ? 'VeloValue' :
        mode === 'foot' ? 'PietonValue' : '';

      // Select elements by exact data-title attribute (set above)
      function selectGroupByExactTitle(title) {
        return svg.selectAll('g').filter(function () {
          return (this.getAttribute && this.getAttribute('data-title')) === title;
        });
      }
      function selectTextByExactTitle(title) {
        return svg.selectAll('text').filter(function () {
          return (this.getAttribute && this.getAttribute('data-title')) === title;
        });
      }
      function selectAnyByExactTitle(title, scopeSel = svg) {
        return scopeSel.selectAll('*').filter(function () {
          return (this.getAttribute && this.getAttribute('data-title')) === title;
        });
      }
      // Write value into <text> matched by data-title; replace content safely
      function writeValueIntoTextByTitle(title, value) {
        const content = `${Math.round(value)}%`;
        selectTextByExactTitle(title).each(function () {
          const el = this;
          // Remove all children and set a single text node
          while (el.firstChild) el.removeChild(el.firstChild);
          el.appendChild(el.ownerDocument.createTextNode(content));
        });
      }

  // Helper: scale pictograms around their own center without changing their position
  // Implementation: move all children (except <title>) into an internal <g.picto-scale-wrapper>
  // and apply a translate(cx,cy) scale(s) translate(-cx,-cy) transform on that inner wrapper.
  function applyCenteredPictoScale(groupSel, factor) {
    groupSel.each(function () {
      const g = this;
      // Remove any legacy CSS transform that could shift visuals
      g.style.transform = '';
      g.style.transformOrigin = '';
      g.style.transformBox = '';

      // Reuse or create the inner wrapper
      let wrapper = g.querySelector(':scope > g.picto-scale-wrapper');
      if (!wrapper) {
        wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        wrapper.setAttribute('class', 'picto-scale-wrapper');
        const children = Array.from(g.childNodes);
        for (const node of children) {
          if (node.nodeType === 1 && node.tagName) {
            const tag = node.tagName.toLowerCase();
            // Skip non-visual elements and keep them at the group level
            if (tag === 'title' || tag === 'defs' || tag === 'desc' || tag === 'metadata') {
              continue;
            }
          }
          wrapper.appendChild(node);
        }
        g.appendChild(wrapper);
      }

      // Compute center from current geometry
      let cx = 0, cy = 0;
      try {
        const bbox = wrapper.getBBox();
        cx = bbox.x + bbox.width / 2;
        cy = bbox.y + bbox.height / 2;
      } catch (_) {
        // If getBBox fails (display:none or empty), reset transform
        wrapper.removeAttribute('transform');
        return;
      }

      const f = Number.isFinite(factor) ? factor : 1;
      if (Math.abs(f - 1) < 1e-3) {
        wrapper.removeAttribute('transform');
      } else {
        wrapper.setAttribute('transform', `translate(${cx} ${cy}) scale(${f}) translate(${-cx} ${-cy})`);
      }
    });
  }

      // Axes styling (context only)
      if (COLOR_CONFIG.applyAxes) {
        svg.selectAll('#layer-axes ellipse').style('stroke', THEME.axes.stroke);
      }

      // Labels styling
      if (COLOR_CONFIG.applyLabels) {
        svg.selectAll('text.dest-label').style('fill', THEME.labels.fill);
      }

    // Update central rings (Quartier)
      ['car', 'transit', 'bike', 'foot'].forEach((mode) => {
        const val = getVal('Quartier', mode);
        const widthPx = scaleForPercent(val);
        svg
          .selectAll(`ellipse.mode-spline.mode--${mode}[data-dest="Quartier"]`)
          .style('stroke-width', widthPx)
      .style('stroke', colorForMode(mode));
      });

      // Update radiating splines for other destinations
      ['Quartier','Nord1','Nord2','Sud1','Sud2','Est1','Est2','Ouest1','Ouest2'].forEach((k) => {
        const dest = destForKey(k);
        if (!dest) return;
        ['car', 'transit', 'bike', 'foot'].forEach((mode) => {
          const val = getVal(k, mode);
          const widthPx = scaleForPercent(val);
          svg
            .selectAll(`.mode-spline.mode--${mode}[data-dest="${dest}"]`)
            .style('stroke-width', widthPx)
            .style('stroke', colorForMode(mode))
            .style('opacity', val > 0 ? 1 : 0.25);
        });
      });

      // Update destination nodes (stroke always, optional fill)
      if (COLOR_CONFIG.applyNodeStroke) {
        svg.selectAll('.dest-node').style('stroke', THEME.nodes.stroke).style('stroke-width', '2px');
      }
      if (COLOR_CONFIG.applyNodeFill) {
        svg.selectAll('.dest-node').style('fill', THEME.nodes.fill);
      }

      // Write mode values into their placeholders (V% text) without changing position
      ['Quartier','Nord1','Nord2','Sud1','Sud2','Est1','Est2','Ouest1','Ouest2'].forEach((k) => {
        const dest = destForKey(k);
        if (!dest) return;
        ['car', 'transit', 'bike', 'foot'].forEach((mode) => {
          const val = getVal(k, mode);
          const title = `${modeValueTitlePrefix(mode)}${dest}`; // e.g., "VoitureValueNordProche"
          writeValueIntoTextByTitle(title, val);
        });
      });

  // Apply unified color and initial visibility for mode pictograms and V% texts
  const SHOW_V_TEXTS = COLOR_CONFIG.showModeValueTexts; // initial state; runtime toggle handled in a separate effect via opacity only
  if (COLOR_CONFIG.applyModePictosAndValuesColor || SHOW_V_TEXTS === false) {
        const allKeys = ['Quartier','Nord1','Nord2','Sud1','Sud2','Est1','Est2','Ouest1','Ouest2'];
        const allModes = ['car', 'transit', 'bike', 'foot'];
        // Color and toggle V% texts
        allKeys.forEach((k) => {
          const dest = destForKey(k);
          if (!dest) return;
          allModes.forEach((mode) => {
            const title = `${modeValueTitlePrefix(mode)}${dest}`;
            const textSel = selectTextByExactTitle(title);
            if (COLOR_CONFIG.applyModePictosAndValuesColor) {
              textSel.style('fill', THEME.modeIconsAndValues);
            }
    textSel.style('opacity', SHOW_V_TEXTS ? 1 : 0);
          });
        });
        // Color central mode pictograms (Voiture/Pieton/Velo/Metro)
        if (COLOR_CONFIG.applyModePictosAndValuesColor) {
          const modePictoGroup = selectGroupByExactTitle('PictoQuartier');
          modePictoGroup.selectAll('path').style('fill', THEME.modeIconsAndValues);

          // Also color all distributed mode pictograms under <title>PictoModes</title>
          const pictoModesGroup = selectGroupByExactTitle('PictoModes');
          if (!pictoModesGroup.empty()) {
            const frenchPrefix = (mode) => (
              mode === 'car' ? 'Voiture' :
              mode === 'transit' ? 'Metro' :
              mode === 'bike' ? 'Velo' :
              mode === 'foot' ? 'Pieton' : ''
            );
            allKeys.forEach((k) => {
              const dest = destForKey(k);
              if (!dest) return;
              allModes.forEach((mode) => {
                const title = `${frenchPrefix(mode)}${dest}`; // e.g., "VeloNordProche"
                const nodeSel = selectAnyByExactTitle(title, pictoModesGroup);
                // If the titled element is a path, color it; else color its path descendants
                nodeSel.each(function () {
                  const el = this;
                  if (el.tagName && el.tagName.toLowerCase() === 'path') {
                    d3.select(el).style('fill', THEME.modeIconsAndValues);
                  } else {
                    d3.select(el).selectAll('path').style('fill', THEME.modeIconsAndValues);
                  }
                });
              });
            });
          }
        }
      }

      // Usage pictograms: scale size by usage value and color by THEME.usages
      const usageKeys = ['shopping', 'work', 'leisure'];
      const dataKeys = ['Quartier','Nord1','Nord2','Sud1','Sud2','Est1','Est2','Ouest1','Ouest2'];
      dataKeys.forEach((k) => {
        const dest = destForKey(k);
        if (!dest) return;
        usageKeys.forEach((u) => {
          const v = getUsageVal(k, u);
          const factor = scaleUsageForPercent(v);
          const groupTitle = `${usageTitlePrefix(u)}${dest}`; // e.g., "CoursesPictosNordProche"
          const g = selectGroupByExactTitle(groupTitle);
          // Apply centered scaling via inner wrapper (more cautious; no displacement)
          applyCenteredPictoScale(g, factor);
          if (COLOR_CONFIG.applyUsagePictoColors) {
            g.selectAll('path').style('fill', colorForUsage(u));
          }
        });
      });

      // Helper for legend hover dimming
      const legendItems = {
        shopping: { picto: 'CoursesLegende', text: 'CoursesTextLegend' },
        work: { picto: 'TravailLegende', text: 'TravailTextLegend' },
        leisure: { picto: 'SortiesLegende', text: 'SortiesTextLegend' }
      };
      const setLegendHover = (targetUsage /* string | null */, legendGroup) => {
        // Dim/undim usage pictograms across all destinations
        dataKeys.forEach((k) => {
          const dest = destForKey(k);
          if (!dest) return;
          usageKeys.forEach((u) => {
            const t = `${usageTitlePrefix(u)}${dest}`;
            const sel = selectGroupByExactTitle(t);
            if (targetUsage && u !== targetUsage) {
              sel.style('opacity', LEGEND_HOVER_DIM_OPACITY);
            } else {
              sel.style('opacity', null);
            }
          });
        });

        // Optional: dim non-hovered legend entries themselves
        Object.entries(legendItems).forEach(([u, titles]) => {
          const lp = selectAnyByExactTitle(titles.picto, legendGroup);
          const lt = selectTextByExactTitle(titles.text);
          const isOther = targetUsage && u !== targetUsage;
          lp.style('opacity', isOther ? LEGEND_HOVER_DIM_OPACITY : 1);
          lt.style('opacity', isOther ? LEGEND_HOVER_DIM_OPACITY : 1);
          // Small visual stroke on hovered pictos (doesn't affect text fill gradients)
          if (targetUsage && u === targetUsage) {
            lp.selectAll('path').style('stroke', LEGEND_HOVER_STROKE).style('stroke-width', 1);
          } else {
            lp.selectAll('path').style('stroke', null).style('stroke-width', null);
          }
        });
      };

      // ===== Legend hover: survol des entrées de légende Usages => effet sur tout le graphe =====
      const legendGroup = selectGroupByExactTitle('Legende');
      if (!legendGroup.empty()) {
        // Attach hover handlers to each legend pictogram and text
        Object.entries(legendItems).forEach(([u, titles]) => {
          const lp = selectAnyByExactTitle(titles.picto, legendGroup);
          const lt = selectTextByExactTitle(titles.text);
          const enter = () => setLegendHover(u, legendGroup);
          const leave = () => setLegendHover(null, legendGroup);
          lp.on('mouseenter', enter).on('mouseleave', leave);
          lt.on('mouseenter', enter).on('mouseleave', leave);
        });
      }

      // ===== Mode legend: color control and hover interactions per mode =====
      const modeLegendGroup = selectGroupByExactTitle('ModeLegende');
      if (!modeLegendGroup.empty()) {
        const allModes = ['car', 'transit', 'bike', 'foot'];
        const modeLegendTitles = (m) => {
          switch (m) {
            case 'foot': return { picto: 'PietonLegende', text: 'PietonTextLegend' };
            case 'car': return { picto: 'VoitureLegende', text: 'VoitureTextLegend' };
            case 'bike': return { picto: 'VeloLegende', text: 'VeloTextLegend' };
            case 'transit': return { picto: 'MetroLegende', text: 'MetroTextLegend' };
            default: return { picto: '', text: '' };
          }
        };
        const colorForModeLegend = (m) => {
          let override;
          switch (m) {
            case 'car': override = MODE_LEGEND_COLORS.car; break;
            case 'transit': override = MODE_LEGEND_COLORS.transit; break;
            case 'bike': override = MODE_LEGEND_COLORS.bike; break;
            case 'foot': override = MODE_LEGEND_COLORS.foot; break;
            default: override = null;
          }
          if (override && typeof override === 'string') return override;
          return colorForMode(m);
        };
        // Apply color to legend pictos and texts
        allModes.forEach((m) => {
          const titles = modeLegendTitles(m);
          const picto = selectAnyByExactTitle(titles.picto, modeLegendGroup);
          const text = selectTextByExactTitle(titles.text);
          const col = colorForModeLegend(m);
          picto.selectAll('path').style('fill', col);
          text.style('fill', col);
        });

        // Hover behavior: dim other modes' splines and legend items
        const setModeLegendHover = (targetMode /* string | null */) => {
          // Splines dimming
          allModes.forEach((m) => {
            const dim = !!targetMode && m !== targetMode;
            svg.selectAll(`.mode-spline.mode--${m}`).style('opacity', dim ? MODE_LEGEND_HOVER_DIM_OPACITY : 1);
          });
          // Legend entries dimming
          allModes.forEach((m) => {
            const titles = modeLegendTitles(m);
            const picto = selectAnyByExactTitle(titles.picto, modeLegendGroup);
            const text = selectTextByExactTitle(titles.text);
            const dim = !!targetMode && m !== targetMode;
            picto.style('opacity', dim ? MODE_LEGEND_HOVER_DIM_OPACITY : 1);
            text.style('opacity', dim ? MODE_LEGEND_HOVER_DIM_OPACITY : 1);
            // Highlight hovered
            if (targetMode && m === targetMode) {
              picto.selectAll('path').style('stroke', LEGEND_HOVER_STROKE).style('stroke-width', 1);
            } else {
              picto.selectAll('path').style('stroke', null).style('stroke-width', null);
            }
          });
        };

        // Bind handlers
        allModes.forEach((m) => {
          const titles = modeLegendTitles(m);
          const picto = selectAnyByExactTitle(titles.picto, modeLegendGroup);
          const text = selectTextByExactTitle(titles.text);
          const enter = () => setModeLegendHover(m);
          const leave = () => setModeLegendHover(null);
          picto.on('mouseenter', enter).on('mouseleave', leave);
          text.on('mouseenter', enter).on('mouseleave', leave);
        });
      }

      // Tooltip helpers (position relative to outer container, clamped)
      const containerEl = ref.current;
      const tipEl = tooltipRef.current;
      function clampToContainer(px, py) {
        if (!containerEl || !tipEl) return [px, py];
        const { width: cw, height: ch } = containerEl.getBoundingClientRect();
        const tw = tipEl.offsetWidth || 0;
        const th = tipEl.offsetHeight || 0;
        let x = px + 12;
        let y = py + 12;
        x = Math.min(Math.max(0, x), cw - tw);
        y = Math.min(Math.max(0, y), ch - th);
        return [x, y];
      }
      const MODE_LABELS = {
        car: data?.Quartier?.modes?.car?.label || 'Voiture, moto',
        transit: data?.Quartier?.modes?.transit?.label || 'Bus, tram, métro',
        bike: data?.Quartier?.modes?.bike?.label || 'Vélo',
        foot: data?.Quartier?.modes?.foot?.label || 'Piéton'
      };
      function modeLabelForKey(key) {
        switch (key) {
          case 'car': return MODE_LABELS.car;
          case 'transit': return MODE_LABELS.transit;
          case 'bike': return MODE_LABELS.bike;
          case 'foot': return MODE_LABELS.foot;
          default: return String(key || '');
        }
      }
      function destLabelForKey(key) {
        switch (key) {
          case 'Quartier': return data?.Quartier?.destination || 'Vers quartier';
          case 'Nord1': return data?.Nord1?.destination || 'Vers Nord proche';
          case 'Nord2': return data?.Nord2?.destination || 'Vers Nord loin';
          case 'Sud1': return data?.Sud1?.destination || 'Vers Sud proche';
          case 'Sud2': return data?.Sud2?.destination || 'Vers Sud loin';
          case 'Est1': return data?.Est1?.destination || 'Vers Est proche';
          case 'Est2': return data?.Est2?.destination || 'Vers Est loin';
          case 'Ouest1': return data?.Ouest1?.destination || 'Vers Ouest proche';
          case 'Ouest2': return data?.Ouest2?.destination || 'Vers Ouest loin';
          default: return '';
        }
      }
      function showTip(event, label, value) {
        if (!tipEl || !containerEl) return;
        const valueEl = tipEl.querySelector('.tooltip-value');
        const labelEl = tipEl.querySelector('.tooltip-label');
        if (valueEl) valueEl.textContent = `${Math.round(Number(value) || 0)}%`;
        if (labelEl) labelEl.textContent = String(label ?? '');
        // position using client coords relative to container, then clamp
        const rect = containerEl.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        // Make visible first to measure
        tipEl.style.display = 'block';
        const [cx, cy] = clampToContainer(px, py);
        tipEl.style.left = `${cx}px`;
        tipEl.style.top = `${cy}px`;
      }
      function hideTip() {
        if (!tipEl) return;
        tipEl.style.display = 'none';
      }

      // Create invisible hit clones for reliable interaction regardless of stroke width
      const originals = svg.selectAll('.mode-spline');
      originals.each(function () {
        const node = this;
        const clone = node.cloneNode(false);
        const sel = d3.select(clone);
        // Mark as hit layer
        sel.attr('class', `${node.getAttribute('class') || ''} mode-spline-hit`);
        sel
          .style('stroke', 'transparent')
          .style('fill', 'none')
          .style('stroke-width', 16)
          .style('pointer-events', 'stroke')
          .style('opacity', 1);
        node.parentNode?.insertBefore(clone, node.nextSibling);
      });

      // Hover highlight by mode + tooltip on individual splines (bind on hit clones)
      svg.selectAll('.mode-spline-hit')
        .style('pointer-events', 'stroke')
        .on('mouseenter', function (event) {
          const el = this;
          const cls = el.getAttribute('class') || '';
          const mode = cls.includes('mode--car') ? 'car' : cls.includes('mode--transit') ? 'transit' : cls.includes('mode--bike') ? 'bike' : cls.includes('mode--foot') ? 'foot' : null;
          if (!mode) return;
          svg.selectAll('.mode-spline').style('opacity', 0.25);
          svg.selectAll(`.mode-spline.mode--${mode}`).style('opacity', 1);

          const dest = el.getAttribute('data-dest') || d3.select(el.previousSibling).attr('data-dest') || '';
          // map back to data key
          const key = dest === 'Quartier' ? 'Quartier'
            : dest === 'NordProche' ? 'Nord1'
            : dest === 'NordLoin' ? 'Nord2'
            : dest === 'SudProche' ? 'Sud1'
            : dest === 'SudLoin' ? 'Sud2'
            : dest === 'EstProche' ? 'Est1'
            : dest === 'EstLoin' ? 'Est2'
            : dest === 'OuestProche' ? 'Ouest1'
            : dest === 'OuestLoin' ? 'Ouest2'
            : null;
          const val = key ? getVal(key, mode) : 0;
          const destLabel = key ? destLabelForKey(key) : String(dest);
          const modeLabel = modeLabelForKey(mode);
          showTip(event, `${destLabel} — ${modeLabel}`, val);
        })
  .on('mousemove', function (event) {
          const el = this;
          const cls = el.getAttribute('class') || '';
          const mode = cls.includes('mode--car') ? 'car' : cls.includes('mode--transit') ? 'transit' : cls.includes('mode--bike') ? 'bike' : cls.includes('mode--foot') ? 'foot' : null;
          const dest = el.getAttribute('data-dest') || d3.select(el.previousSibling).attr('data-dest') || '';
          const key = dest === 'Quartier' ? 'Quartier'
            : dest === 'NordProche' ? 'Nord1'
            : dest === 'NordLoin' ? 'Nord2'
            : dest === 'SudProche' ? 'Sud1'
            : dest === 'SudLoin' ? 'Sud2'
            : dest === 'EstProche' ? 'Est1'
            : dest === 'EstLoin' ? 'Est2'
            : dest === 'OuestProche' ? 'Ouest1'
            : dest === 'OuestLoin' ? 'Ouest2'
            : null;
          const val = mode && key ? getVal(key, mode) : 0;
          const destLabel = key ? destLabelForKey(key) : String(dest);
          const modeLabel = mode ? modeLabelForKey(mode) : '';
          showTip(event, `${destLabel} — ${modeLabel}`.trim(), val);
        })
  .on('mouseleave', () => {
          svg.selectAll('.mode-spline').style('opacity', null);
          hideTip();
        });

      svg.on('mouseleave', () => {
        svg.selectAll('.mode-spline').style('opacity', null);
        hideTip();
      });

      // Set focus outline within embedded doc for accessibility
      d3.select(doc.documentElement)
        .on('keydown', (event) => {
          if (event.key === 'Tab') {
            obj.style('outline', '2px solid #005fcc');
          }
        })
        .on('keyup', (event) => {
          if (event.key === 'Escape') {
            obj.style('outline', 'none');
          }
        });
    }

    const node = obj.node();
    // Attach load handler and add a fallback if already loaded from cache
    let loaded = false;
    const handleLoad = () => {
      if (loaded) return;
      loaded = true;
      try { onLoad(); } catch (_) { /* swallow */ }
    };
    node?.addEventListener('load', handleLoad);
    // Fallback: if contentDocument is already available (cache), render immediately
    if (node?.contentDocument && node.contentDocument.readyState === 'complete') {
      handleLoad();
    }
    return () => {
      try { node?.removeEventListener('load', handleLoad); } catch (e) { /* intentional no-op on cleanup */ }
    };
  }, [svgPath, data, vizColors]);

  // Lightweight toggle effect: only flips opacity of V% texts, no re-render
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const objEl = container.querySelector('object');
    const doc = objEl?.contentDocument;
    if (!doc) return;
    const svg = d3.select(doc).select('svg');
    if (svg.empty()) return;

    const SHOW = (typeof showModeValueTexts === 'boolean') ? showModeValueTexts : COLOR_CONFIG.showModeValueTexts;
    // title prefixes/suffixes used in SVG
    const modeValueTitlePrefix = (mode) =>
      mode === 'car' ? 'VoitureValue' :
      mode === 'transit' ? 'MetroValue' :
      mode === 'bike' ? 'VeloValue' :
      mode === 'foot' ? 'PietonValue' : '';
    const destForKey = (k) => (
      k === 'Quartier' ? 'Quartier' :
      k === 'Nord1' ? 'NordProche' :
      k === 'Nord2' ? 'NordLoin' :
      k === 'Sud1' ? 'SudProche' :
      k === 'Sud2' ? 'SudLoin' :
      k === 'Est1' ? 'EstProche' :
      k === 'Est2' ? 'EstLoin' :
      k === 'Ouest1' ? 'OuestProche' :
      k === 'Ouest2' ? 'OuestLoin' :
      null
    );
    const selectTextByExactTitle = (title) => svg
      .selectAll('text')
      .filter(function () {
        const first = this.firstElementChild;
        return !!first && first.tagName?.toLowerCase() === 'title' && (first.textContent || '').trim() === title;
      });
    const allKeys = ['Quartier','Nord1','Nord2','Sud1','Sud2','Est1','Est2','Ouest1','Ouest2'];
    const allModes = ['car', 'transit', 'bike', 'foot'];
    allKeys.forEach((k) => {
      const dest = destForKey(k);
      if (!dest) return;
      allModes.forEach((mode) => {
        const title = `${modeValueTitlePrefix(mode)}${dest}`;
        selectTextByExactTitle(title).style('opacity', SHOW ? 1 : 0);
      });
    });
  }, [showModeValueTexts]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Mobilité: liaisons par modes et destinations"
      style={{ width: '100%', maxWidth: 800, margin: '0 auto', position: 'relative' }}
    >
      <Tooltip ref={tooltipRef} />
    </div>
  );
}

MobilityMegaGraph.propTypes = {
  svgPath: PropTypes.string.isRequired, // path to the authored SVG file
  data: PropTypes.object.isRequired, // mobility data keyed by destination keys
  vizColors: PropTypes.object, // color set from mockData.vizColors or similar
  showModeValueTexts: PropTypes.bool
};
