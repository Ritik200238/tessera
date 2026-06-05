## What & why

<!-- What does this change, and why is it needed? Link any issue. -->

## Surface

- [ ] Web app
- [ ] Risk agent
- [ ] Vault / contracts
- [ ] Docs / infra

## Checklist

- [ ] `pnpm --filter @tessera/agent run test` passes
- [ ] `pnpm --filter @tessera/web run test` passes
- [ ] `cargo test --workspace` passes (if contracts changed)
- [ ] `forge test` passes (if Solidity changed)
- [ ] Typecheck is clean (`typecheck` scripts)
- [ ] No secrets committed (`.env*` stays gitignored)

## Notes

<!-- Screenshots, tx links, follow-ups, or anything a reviewer should know. -->
