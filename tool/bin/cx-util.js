/**
 * CraftSquad `cx` - shared CLI helpers.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function printTable(rows, columns) {
  const widths = columns.map((c) => Math.max(c.title.length, ...rows.map((r) => String(c.get(r)).length)));
  const line = (cells) => cells.map((cell, i) => String(cell).padEnd(widths[i])).join('  ').trimEnd();
  console.log(line(columns.map((c) => c.title)));
  console.log(line(widths.map((w) => '-'.repeat(w))));
  rows.forEach((r) => console.log(line(columns.map((c) => c.get(r)))));
}

function flag(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Wait for a browser sign-in started by service.add(); prints the link when the CLI reports one. */
async function awaitLogin(service, started, label) {
  console.log(`Opening ${label} sign-in in your browser. Finish signing in there (Ctrl+C to cancel).`);
  let shownUrl = false;
  const onSigint = () => {
    service.cancel(started.token);
    console.log('\nCancelled.');
    process.exit(130);
  };
  process.once('SIGINT', onSigint);
  try {
    for (;;) {
      const state = service.pending(started.token);
      if (state.url && !shownUrl) {
        shownUrl = true;
        console.log(`If the browser did not open, visit:\n  ${state.url}`);
      }
      if (state.status === 'done') {
        const r = state.result || {};
        console.log(r.created === false ? `Already added: ${r.email}` : `Added ${r.email}`);
        return r;
      }
      if (state.status !== 'waiting') throw new Error(state.message);
      await sleep(1000);
    }
  } finally {
    process.removeListener('SIGINT', onSigint);
  }
}

module.exports = { printTable, flag, awaitLogin };
