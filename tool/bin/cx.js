#!/usr/bin/env node

/**
 * CraftSquad account switcher (`cx`)
 * Codex accounts by default (`cx codex ...` is the same), Claude Code accounts under `cx claude ...`.
 * Accounts are identified by their email: no aliases. Select with an email, an email prefix, or the list number.
 */

const { CodexService } = require('../lib/codex/store');
const { runClaudeCli, printClaudeHelp } = require('./cx-claude');
const { printTable, awaitLogin } = require('./cx-util');

function printHelp() {
  console.log(`
CraftSquad Account Switcher (cx)

Usage:
  cx [command]                  OpenAI Codex accounts (default provider)
  cx codex [command]            Same as above, explicit
  cx claude [command]           Claude Code accounts (see below)

Codex commands:
  list, ls                      List saved accounts; "in use" matches the live ~/.codex login
  current, whoami               Show the live login and whether it is saved
  add                           Sign in a new account in your browser (live login is not touched)
  save                          Save the live login (new account, or refresh an existing one)
  switch <email|#> [--no-daemon]  Make an account the live login (saves and backs up the old one first)
  rotate [--no-daemon]          Switch to the next ready account
  remove, rm <email|#>          Remove a saved account
  sync                          Copy refreshed tokens from the live login back to its saved account
  restart                       Restart the Codex background daemon
  doctor                        Check the Codex CLI and accounts

Select accounts by email, an email prefix, or the list number. "cx <email|#>" is a shortcut for switch.
`);
  printClaudeHelp();
}

const SELECTOR = /^(\d+|[^\s@]+@[^\s@]*)$/;

async function runCodexCli(args, service = new CodexService()) {
  const command = args[0] || 'list';
  const restartDaemon = !args.includes('--no-daemon');
  const report = (r) => {
    console.log(`Switched to ${r.email}`);
    if (r.autoSaved) console.log(`Saved your previous login (${r.autoSaved}) first.`);
    if (r.alreadyActive) console.log('That account was already in use.');
    if (r.daemon) console.log(`Daemon: ${r.daemon.message}`);
    if (r.openProcesses) console.log(`${r.openProcesses} Codex process(es) are running. Restart open Codex windows to pick up the new account.`);
  };

  try {
    switch (command) {
      case 'list':
      case 'ls': {
        const data = service.list();
        if (!data.accounts.length) console.log('No saved accounts. Run "cx add" or "cx save".');
        else {
          printTable(data.accounts, [
            { title: '#', get: (a) => a.index },
            { title: 'Account', get: (a) => a.email },
            { title: 'Plan', get: (a) => a.plan || '-' },
            { title: 'Status', get: (a) => (a.status === 'ready' ? 'ready' : 'needs sign-in') },
            { title: '', get: (a) => (a.isActive ? 'IN USE' : '') }
          ]);
        }
        if (!data.liveSaved) console.log(`\nThe live login (${data.live.email}) is not saved. Run "cx save".`);
        data.notes.forEach((n) => console.log(`Note: ${n}`));
        return 0;
      }
      case 'current':
      case 'whoami': {
        const { live, liveSaved } = service.list();
        console.log(live ? `${live.email}${live.plan ? ` (${live.plan})` : ''}${liveSaved ? '' : ' - not saved'}` : 'No Codex login found.');
        return 0;
      }
      case 'add': {
        await awaitLogin(service, await service.add(), 'Codex');
        return 0;
      }
      case 'save': {
        const r = service.saveLive();
        console.log(r.created ? `Saved ${r.email}` : `Updated ${r.email}`);
        return 0;
      }
      case 'switch': {
        if (!args[1]) throw new Error('Choose an account: cx switch <email|#>');
        report(await service.switchTo(args[1], { restartDaemon }));
        return 0;
      }
      case 'rotate':
      case 'next':
        report(await service.rotate({ restartDaemon }));
        return 0;
      case 'remove':
      case 'rm': {
        if (!args[1]) throw new Error('Choose an account: cx remove <email|#>');
        console.log(`Removed ${service.remove(args[1]).email}`);
        return 0;
      }
      case 'sync': {
        const r = service.sync();
        console.log(r.synced ? `Synced tokens to ${r.email}` : 'Nothing to sync.');
        return 0;
      }
      case 'restart': {
        const r = await require('../lib/codex/runtime').restartDaemon();
        console.log(r.message);
        return r.success ? 0 : 1;
      }
      case 'doctor': {
        const d = await service.doctor();
        console.log(`CLI:          ${d.binary}\nVersion:      ${d.version}\nCodex home:   ${d.codexHome}\nAccounts:     ${d.accounts}\nLive login:   ${d.liveAccount}${d.liveSaved ? '' : ' (not saved)'}\nFolder:       ${d.accountsRoot}\nRunning:      ${d.openProcesses} process(es)`);
        return 0;
      }
      case 'help':
      case '--help':
      case '-h':
        printHelp();
        return 0;
      default:
        if (SELECTOR.test(command)) {
          report(await service.switchTo(command, { restartDaemon }));
          return 0;
        }
        console.error(`Unknown command "${command}".`);
        printHelp();
        return 1;
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return 1;
  }
}

async function main() {
  let args = process.argv.slice(2);
  if (args[0] === 'codex') args = args.slice(1);
  process.exitCode = args[0] === 'claude' ? await runClaudeCli(args.slice(1)) : await runCodexCli(args);
}

if (require.main === module) main();

module.exports = { runCodexCli, main };
