# Option A engineering scaffold (DDR-Gateway-003)

If the Designer Department resolves DDR-Gateway-003 as **Option A**
("15-tab top-rail is canonical; strip the 10-tab GatewayShell wrapper"),
CloudCode applies the changes below. Nothing in this file is shipped
until that resolution lands.

The mock HTML/CSS/JS is NOT modified by any step below. The wrapper
files are removed; the mocks themselves are byte-identical to v1-FINAL.

## What changes

| Operation | File | Reason |
| --- | --- | --- |
| **Remove** | `gateway-dropin/src/app/gateway/page.tsx` | No longer needed — Next serves the mock directly |
| **Remove** | `gateway-dropin/src/components/gateway/GatewayShell.tsx` | DDR-Gateway-003 says the 10-tab wrapper is not canonical |
| **Remove** | `gateway-dropin/tests/gateway-shell.test.ts` | Tests target the removed wrapper |
| **Replace** | `gateway-dropin/next.config.partial.js` | Use the Option-A rewrite block below instead of the current one |
| **Keep** | `gateway-dropin/public/design/gateway/**` (all 31 files) | Untouched — they ARE the production UI now |
| **Keep** | `gateway-dropin/middleware.gateway-csp.partial.ts` | Still needed for `/design/gateway/*` |
| **Keep** | `gateway-dropin/design-lock/*` + scripts | Still the integrity guard |
| **Keep** | `gateway-dropin/tests/csp-scope.test.ts`, `design-lock.test.ts` | Still valid |

## Option-A next.config rewrites (drop-in replacement)

```js
// gateway-dropin/next.config.partial.js — Option-A variant
//
// Each /gateway/<segment> is rewritten directly to the matching designer
// mock under /design/gateway/<file>.html. No React wrapper. The top-rail
// inside each mock is the canonical Gateway navigation.

module.exports = {
  async rewrites() {
    return [
      // Top-of-section: /gateway lands on the sprint index (or Gateway Overview;
      // designer confirms in DDR-Gateway-003 ack which one is the home).
      { source: '/gateway',                  destination: '/design/gateway/index.html' },

      // The 12 segments whose targets exist in v1-FINAL:
      { source: '/gateway/overview',         destination: '/design/gateway/Gateway%20Overview.html' },
      { source: '/gateway/routes',           destination: '/design/gateway/Gateway%20Routes.html' },
      { source: '/gateway/registry',         destination: '/design/gateway/Gateway%20Registry.html' },
      { source: '/gateway/policies',         destination: '/design/gateway/Gateway%20Policies.html' },
      { source: '/gateway/health',           destination: '/design/gateway/Gateway%20Health.html' },
      { source: '/gateway/agent-zero',       destination: '/design/gateway/Agent%20Zero%20Commander.html' },
      { source: '/gateway/hermes',           destination: '/design/gateway/Hermes%20Lieutenant.html' },
      { source: '/gateway/opencloud',        destination: '/design/gateway/OpenCloud%20Workers.html' },
      { source: '/gateway/openclaw',         destination: '/design/gateway/OpenClaw%2B%20Skills.html' },
      { source: '/gateway/brain',            destination: '/design/gateway/Brain%20Systems.html' },
      { source: '/gateway/connectors',       destination: '/design/gateway/Delivery%20Connectors.html' },

      // The three top-rail tabs that point to nonexistent files — held
      // pending DDR-Gateway-004. Commented out until the designer picks
      // a target.
      // { source: '/gateway/node-spec',     destination: '/design/gateway/?' },
      // { source: '/gateway/legend',        destination: '/design/gateway/?' },
      // { source: '/gateway/mobile',        destination: '/design/gateway/?' },
    ]
  },
}
```

## Operator-side apply (under Option A)

```bash
ssh srv1568353
cd /home/tony/mission-control

# (a) Drop the wrapper:
git rm src/app/gateway/page.tsx \
       src/components/gateway/GatewayShell.tsx \
       tests/gateway/gateway-shell.test.ts

# (b) Replace next.config rewrites block with the Option-A variant
#     (paste from gateway-dropin/options/option-A-engineering-scaffold.md).

# (c) Re-run the same verification suite:
pnpm install
pnpm typecheck
pnpm test -- tests/gateway
pnpm build
node scripts/verify-design-lock.mjs

# (d) Deploy/restart via the operator-approved release path.

# (e) Production proofs (the same curl pack, but expect HTML body
#     to be the raw designer mock — no React wrapper around it):
curl -fsS "https://<domain>/gateway" | head -3                         # expect: index.html title
curl -fsS "https://<domain>/gateway/overview" | head -3                # expect: Gateway · Overview title
curl -fsS "https://<domain>/gateway/agent-zero" | head -3              # expect: Agent Zero Commander title
```

## Rollback (under Option A)

```bash
# Single revert reverts both the wrapper removal and the rewrite swap:
git revert <option-A-commit-sha>
```

Or restore the C+C-state wrapper:

```bash
git checkout 7c51e68 -- src/app/gateway/page.tsx \
                         src/components/gateway/GatewayShell.tsx \
                         tests/gateway/gateway-shell.test.ts
# then restore the original next.config rewrites block from the same commit
git commit -m "revert: restore C+C GatewayShell wrapper"
```

## What this scaffold does NOT do

- No mock HTML/CSS/JS edit.
- No designer file rename.
- No status grammar change.
- No tab order change in any mock.
- No new visual state.
- No CSP weakening.
- No SSH or deploy from CloudCode — operator runs the apply.

This file is **proposed engineering only**. It is not active until the
Designer Department resolves DDR-Gateway-003 as Option A AND Luis
authorises the swap.
