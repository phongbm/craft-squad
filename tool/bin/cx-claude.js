/**
 * CraftSquad `cx claude` - Claude Code accounts (one isolated CLAUDE_CONFIG_DIR per account, no aliases).
 */

const { ClaudeService } = require('../lib/claude/store');
const { printTable, flag, awaitLogin } = require('./cx-util');

function printClaudeHelp() {
  console.log(`
Claude Code accounts (each account is an isolated CLAUDE_CONFIG_DIR):
  cx claude list, ls               List accounts; "in use" is the one CraftSquad dispatch uses
  cx claude add [--email <email>]  Sign in a new account in your browser
  cx claude use <email|#|system>   Choose the account CraftSquad dispatch uses
  cx claude run <email|#> [args]   Run Claude Code as that account (extra args pass through)
  cx claude env <email|#> [--shell powershell|cmd|sh]
                                   Print a command that starts Claude Code as that account
  cx claude remove, rm <email|#>   Remove an account and its stored login
  cx claude current                Show the account in use
  cx claude doctor                 Check the claude CLI and accounts

Accounts are selected by email, an email prefix, or the list number. Each account needs its own sign-in;
tokens are never copied between accounts.
`);
}

/** @returns {Promise<number>} exit code */
async function runClaudeCli(args, service = new ClaudeService()) {
  const sub = args[0] || 'list';
  try {
    switch (sub) {
      case 'list':
      case 'ls': {
        const data = service.list();
        printTable(data.accounts, [
          { title: '#', get: (a) => (a.isSystem ? '-' : a.index) },
          { title: 'Account', get: (a) => (a.isSystem ? `System default${a.email ? ` (${a.email})` : ''}` : a.email) },
          { title: 'Plan', get: (a) => a.plan || '-' },
          { title: 'Status', get: (a) => (a.status === 'ready' ? 'ready' : 'needs sign-in') },
          { title: '', get: (a) => (a.isActive ? 'IN USE' : '') }
        ]);
        data.notes.forEach((n) => console.log(`Note: ${n}`));
        return 0;
      }
      case 'add': {
        const started = await service.add({ email: flag(args, '--email') });
        await awaitLogin(service, started, 'Claude');
        return 0;
      }
      case 'use': {
        const r = service.use(args[1]);
        console.log(`Now using ${r.email || 'the system default login'} for CraftSquad dispatch.`);
        return 0;
      }
      case 'run': {
        if (!args[1]) throw new Error('Choose an account: cx claude run <email|#> [args]');
        const rest = args.slice(2);
        return (await service.run(args[1], rest[0] === '--' ? rest.slice(1) : rest)).code;
      }
      case 'env': {
        if (!args[1]) throw new Error('Choose an account: cx claude env <email|#>');
        console.log(service.launchCommand(args[1], flag(args, '--shell')).command);
        return 0;
      }
      case 'remove':
      case 'rm': {
        if (!args[1]) throw new Error('Choose an account: cx claude remove <email|#>');
        console.log(`Removed ${service.remove(args[1]).email}`);
        return 0;
      }
      case 'current':
      case 'whoami': {
        const active = service.list().accounts.find((a) => a.isActive);
        console.log(active.isSystem ? `System default${active.email ? ` (${active.email})` : ''}` : active.email);
        return 0;
      }
      case 'doctor': {
        const d = await service.doctor();
        console.log(`CLI:        ${d.binary}\nVersion:    ${d.version}\nAccounts:   ${d.accounts}\nSystem:     ${d.systemAccount}\nIn use:     ${d.inUse}\nFolder:     ${d.accountsRoot}`);
        if (d.note) console.log(`Note:       ${d.note}`);
        return 0;
      }
      case 'help':
      case '--help':
      case '-h':
        printClaudeHelp();
        return 0;
      default:
        console.error(`Unknown command "${sub}".`);
        printClaudeHelp();
        return 1;
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return 1;
  }
}

module.exports = { runClaudeCli, printClaudeHelp };
