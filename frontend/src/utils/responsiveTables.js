/**
 * Responsive tables, app-wide.
 *
 * On phones (see the max-width: 640px rules in primitives.css) every
 * `table.common-table` is shown as a stack of cards, one per row, with each
 * cell as a "Label: value" line. The labels come from the table's own <th>
 * headers: this copies each header's text onto its column's cells as
 * `data-label`, which the CSS displays with ::before.
 *
 * Doing it here means none of the ~14 table pages need to repeat their column
 * names on every <td>. A MutationObserver keeps labels in sync as React adds or
 * re-renders rows. It watches only childList (not attributes), so writing
 * data-label can't trigger itself.
 */

let installed = false;
let scheduled = false;

function labelTable(table) {
  const headers = Array.from(table.querySelectorAll(':scope > thead th')).map(th => th.textContent.trim());
  if (headers.length === 0) return;

  table.querySelectorAll(':scope > tbody > tr').forEach(tr => {
    let col = 0;
    Array.from(tr.children).forEach(td => {
      const span = td.colSpan || 1;
      if (span > 1) {
        // Empty-state / "Loading…" rows span every column: show them full width
        td.classList.add('common-table__cell--full');
      } else {
        const label = headers[col] || '';
        if (td.getAttribute('data-label') !== label) td.setAttribute('data-label', label);
      }
      col += span;
    });
  });
}

function labelAll() {
  scheduled = false;
  document.querySelectorAll('table.common-table').forEach(labelTable);
}

export function installResponsiveTables() {
  if (installed || typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  installed = true;

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(labelAll);
  };

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
}
