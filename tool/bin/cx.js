#!/usr/bin/env node

/**
 * CraftSquad Codex CLI (`cx`)
 * Standalone multi-account switcher and token manager for OpenAI Codex.
 */

const path = require('path');
const { codexManager } = require('../lib/codex-manager');

const args = process.argv.slice(2);
const command = args[0] || 'list';

function printHelp() {
  console.log(`
============================================================
 CraftSquad Codex Account Switcher (cx)
============================================================
Usage:
  cx [command] [options]
  node tool/bin/cx.js [command] [options]

Commands:
  list, ls                 List all saved profiles and token expiry
  current, whoami          Show current active profile and claims
  switch <alias|#>         Switch active Codex account (with 2-way sync)
  rotate, next             Rotate to next valid account
  save <alias>             Save current login as a named profile
  remove, rm <alias|#>     Delete a profile from storage
  sync                     Sync current auth.json back to profile
  restart                  Restart Codex background daemon
  doctor                   Run environment health check
  help                     Show this help message

Options:
  --no-daemon              Skip restarting the app-server daemon
  -r, --resume             Resume session after switching (codex resume --last)
`);
}

async function main() {
  try {
    switch (command) {
      case 'list':
      case 'ls': {
        const data = codexManager.listProfiles();
        console.log(`\n============================================================`);
        console.log(` Saved Codex Profiles (${data.totalCount})`);
        console.log(` Active Profile: ${data.activeProfile || '(none)'}`);
        console.log(`============================================================`);
        console.log(`#    Alias               Email                     Expires In       Status`);
        console.log(`----------------------------------------------------------------------------`);
        data.profiles.forEach((p) => {
          const activeMark = p.isActive ? '[ACTIVE]' : '';
          const status = p.isExpired ? 'EXPIRED' : p.timeRemainingStr;
          console.log(`[${p.index}]  ${p.alias.padEnd(18)}  ${p.email.padEnd(24)}  ${status.padEnd(15)}  ${activeMark}`);
        });
        console.log(`----------------------------------------------------------------------------\n`);
        break;
      }

      case 'current':
      case 'whoami': {
        const live = codexManager.listProfiles().liveAuth;
        const state = codexManager.getState();
        console.log(`\n--- Active Codex Account ---`);
        console.log(`Profile Alias: ${state.active_profile || 'unmanaged'}`);
        console.log(`Email:         ${live.email}`);
        console.log(`Name:          ${live.name}`);
        console.log(`Auth Mode:     ${live.authMode}`);
        console.log(`Expires At:    ${live.expiresAtStr}`);
        console.log(`Time Left:     ${live.timeRemainingStr}`);
        console.log(`Expired:       ${live.isExpired ? 'YES' : 'NO'}\n`);
        break;
      }

      case 'switch': {
        const target = args[1];
        if (!target) {
          console.error('Error: Profile alias or number required: cx switch <alias|#>');
          process.exit(1);
        }
        const noDaemon = args.includes('--no-daemon');
        const res = codexManager.switchProfile(target, { restartDaemon: !noDaemon });
        console.log(`\n✅ Switched to account: [${res.activeProfile}] (${res.email})`);
        console.log(`   Token validity: ${res.timeLeft}`);
        if (res.syncedProfile) console.log(`   Synced previous tokens to: [${res.syncedProfile}]`);
        if (res.daemon) console.log(`   Daemon status: ${res.daemon.message}`);
        console.log();
        break;
      }

      case 'rotate':
      case 'next': {
        const noDaemon = args.includes('--no-daemon');
        const res = codexManager.rotateNext({ restartDaemon: !noDaemon });
        console.log(`\n🔄 Rotated to account: [${res.activeProfile}] (${res.email})`);
        console.log(`   Token validity: ${res.timeLeft}\n`);
        break;
      }

      case 'save': {
        const alias = args[1];
        if (!alias) {
          console.error('Error: Profile alias required: cx save <alias>');
          process.exit(1);
        }
        const res = codexManager.saveCurrentAsProfile(alias);
        console.log(`\n✅ Saved current credentials as profile: [${res.alias}] (${res.email})\n`);
        break;
      }

      case 'remove':
      case 'rm': {
        const alias = args[1];
        if (!alias) {
          console.error('Error: Profile alias required: cx remove <alias|#>');
          process.exit(1);
        }
        const res = codexManager.removeProfile(alias);
        console.log(`\n🗑️ Removed profile: [${res.removed}]\n`);
        break;
      }

      case 'sync': {
        const synced = codexManager.syncCurrentAuthToProfile();
        if (synced) {
          console.log(`\n✅ Synced current tokens back to profile: [${synced}]\n`);
        } else {
          console.log(`\nℹ️ No matching profile to sync.\n`);
        }
        break;
      }

      case 'restart': {
        const { restartDaemon } = require('../lib/codex-manager');
        const r = restartDaemon();
        console.log(`\nDaemon status: ${r.message}\n`);
        break;
      }

      case 'doctor': {
        const doc = codexManager.doctor();
        console.log(`\n============================================================`);
        console.log(` Codex Health Doctor`);
        console.log(`============================================================`);
        console.log(`Executable:     ${doc.codexBinary}`);
        console.log(`Version:        ${doc.codexVersion}`);
        console.log(`Codex Home:     ${doc.codexHome}`);
        console.log(`Active Profile: ${doc.activeProfile}`);
        console.log(`Account Email:  ${doc.currentEmail}`);
        console.log(`Token Status:   ${doc.tokenStatus}`);
        console.log(`Saved Profiles: ${doc.validProfiles}/${doc.totalProfiles} Valid\n`);
        break;
      }

      case 'help':
      case '--help':
      case '-h':
      default:
        // Check if command is an alias or index directly: `cx acc2` or `cx 1`
        if (command && command !== 'help' && !command.startsWith('-')) {
          try {
            const noDaemon = args.includes('--no-daemon');
            const res = codexManager.switchProfile(command, { restartDaemon: !noDaemon });
            console.log(`\n✅ Switched to account: [${res.activeProfile}] (${res.email})`);
            console.log(`   Token validity: ${res.timeLeft}\n`);
            return;
          } catch (_) {}
        }
        printHelp();
        break;
    }
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}\n`);
    process.exit(1);
  }
}

main();
