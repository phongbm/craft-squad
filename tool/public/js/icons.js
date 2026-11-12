// Inline line icons (24x24 grid, stroke only). Built with createElementNS so no markup strings are parsed.

const PATHS = {
  refresh: ['M20.5 12a8.5 8.5 0 1 1-2.6-6.1', 'M20.5 4v5h-5'],
  plus: ['M12 5v14', 'M5 12h14'],
  trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12', 'M9 7V4h6v3'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  copy: ['M9 9h10v10H9z', 'M5 15V5h10'],
  swap: ['M7 8h12l-3-3', 'M17 16H5l3 3'],
  terminal: ['M4 7l5 5-5 5', 'M12 18h8'],
  spark: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 17v4', 'M17 19h4'],
  alert: ['M12 9v4', 'M12 16.5v.01', 'M10.3 4.2l-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0z'],
  external: ['M14 5h5v5', 'M19 5l-8 8', 'M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.5 20a7.5 7.5 0 0 1 15 0']
};

const NS = 'http://www.w3.org/2000/svg';

export function icon(name, size = 16) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', name === 'more' ? '2.6' : '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon');
  for (const d of PATHS[name] || []) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
