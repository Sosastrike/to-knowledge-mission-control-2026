# Operator results — Gateway drop-in production application

Fill this in after running the steps in
[gateway-dropin/HANDOFF.md § 22](../gateway-dropin/HANDOFF.md). Reply
to CloudCode with the completed file. CloudCode then folds these
fields into the final HANDOFF.md closeout and the lane is fully
closed.

If any step fails, paste the failing command + last 30 lines of output
under "Notes / blockers" and stop. Do not edit the designer mock files
to make a check pass — file a fresh `DESIGNER_DECISION_REQUIRED`
instead.

---

## Operator identity

```
Operator name:
Operator workstation:
Time started (UTC):
Time finished (UTC):
```

## Apply method used

(Pick one — delete the others.)

- [ ] `git fetch <bundle-path> cloudcode/gateway-dropin-integration:cloudcode/gateway-dropin-integration`
- [ ] `git am cloudcode-gateway-dropin-handoff/patches/*.patch`
- [ ] `git apply cloudcode-gateway-dropin-handoff/cloudcode-gateway-dropin-combined.patch`
- [ ] `tar -xzf cloudcode-gateway-dropin.tar.gz` then manual move per `INTEGRATION-PATCH.md`

## Files changed in production tree

(Paste the output of `git diff --name-status main...HEAD` after applying.)

```
[paste here]
```

## Conflicts during apply

```
[paste here, or "none"]
```

## Server-side verification

### typecheck

```
$ pnpm typecheck
[paste tail]
exit: [code]
```

### tests

```
$ pnpm test -- tests/gateway
[paste tail — expect 29/29 passing]
exit: [code]
```

### build

```
$ pnpm build
[paste tail — expect success]
exit: [code]
```

### design-lock

```
$ node scripts/verify-design-lock.mjs
[paste output — expect "design-lock OK: 31 files match manifest"]
exit: [code]
```

### deploy / restart

(Operator-approved release path — systemctl, pm2, Docker, etc.)

```
[paste output]
deploy/restart result: SUCCESS | FAILED
```

## Production proofs (from operator workstation)

### Static mock URL

```
$ curl -fsS "https://<domain>/design/gateway/Agent%20Hub.html" | head -3
[paste output — expect "<!doctype html>...<title>Gateway · Agent Hub</title>"]
```

### /gateway

```
$ curl -fsS "https://<domain>/gateway" | grep -c gateway-shell
[paste output — expect 1]
```

### Deep links

```
$ for tab in overview agent-hub paperclip dispatcher token-governor \
             bridge-session health routes registry policies; do
    printf '%-30s ' "$tab"
    curl -fsS -o /dev/null -w '%{http_code}\n' "https://<domain>/gateway/$tab"
  done

[paste output — every tab should be 200]
```

### Browser-side proofs (visual)

| Check | Pass / Fail | Notes |
| --- | --- | --- |
| A. `/design/gateway/Agent Hub.html` renders the raw approved mock |  |  |
| B. `/gateway` renders GatewayShell |  |  |
| C. Left Gateway sub-rail shows 10 tabs |  |  |
| D. Each tab loads the matching mock in the iframe |  |  |
| E. No wrapper chrome around the iframe |  |  |
| F. No clipping |  |  |
| G. No nested scroll lock |  |  |
| H. No trapped page behavior |  |  |
| I. Mission Control left rail unchanged (Dashboard, Brain Sync, Agent Network, MiroFish, Meetings, Channels, Alerts, Schedule, Settings, Gateway) |  |  |
| J. SpaceAgent panel shows Browser Automation with Playwright MCP gray / not installed |  |  |
| K. No fake LIVE status anywhere |  |  |
| L. Mock HTML/CSS/JS unchanged |  | (design-lock above is the formal check) |

(Optional: paste screenshot URLs or attach images alongside this file.)

## Safety confirmations

| Confirmation | Status |
| --- | --- |
| No `.env` changes (run `git diff -- '*.env*' .env` and confirm empty) | confirmed / NOT confirmed |
| No secrets in any committed file | confirmed / NOT confirmed |
| No auth weakening | confirmed / NOT confirmed |
| No mock HTML/CSS/JS modified (design-lock proves it) | confirmed / NOT confirmed |
| No Zapier writes, no SMB / Fork-2, no external farmers | confirmed / NOT confirmed |

## Commit hash on production tree

```
$ git log -1 --format='%H %s'
[paste]
```

## Push / deploy result

```
Push to remote:    SUCCESS | NOT ATTEMPTED | FAILED — [reason]
Deployment:        SUCCESS | FAILED — [reason]
Restart:           SUCCESS | FAILED — [reason]
Public URL live:   YES | NO — [reason]
```

## Rollback command

If anything went wrong:

```bash
# A — drop the branch entirely:
git switch <previous-branch>
git branch -D cloudcode/gateway-dropin-integration

# B — revert by commit (single feat commit):
git revert <gateway-integration-commit-sha>

# C — surgical removal after integration:
git rm -rf public/design/gateway/ src/components/gateway/ src/app/gateway/
git rm design-lock/gateway-manifest.json
git rm scripts/compute-design-lock.mjs scripts/verify-design-lock.mjs
git rm tests/gateway/*.test.ts
# then revert next.config.js rewrites array + middleware.ts CSP scope
```

## Notes / blockers

```
[free-form: anything CloudCode should know before closing the lane]
```

---

**When complete:** send this file (or paste it back) to CloudCode. The
lane is closed once the operator returns a fully-filled-in version.
