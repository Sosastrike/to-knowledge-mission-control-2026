# Mission Control Identity Roadmap

Date: 2026-05-02
Mission: 17 - release security posture report

## Scope

Report-only security posture note. No auth routes, credentials, environment files, role rules, session code, or provider settings were modified.

## Current Security State

- Mission Control remains auth-gated.
- Unauthenticated protected API calls return 401.
- Canonical owner approval decisions remain outside web approval routes where required.
- Web approval decisions stay locked where protected-action decisions must remain Telegram-only.
- Service remains local-bound behind the current deployment boundary.

## Identity Roadmap

Future hardening items, not implemented in this mission:

- Google Workspace login completion after owner confirms credentials and allowed users.
- Microsoft 365 / Entra login after owner provides tenant, client, and secret setup.
- SAML after owner provides IdP metadata, ACS, SP entity ID, certificate, and attribute mapping.
- TOTP QR setup/verification polish for owner/admin accounts.
- SMS MFA only as a fallback after owner approves provider and cost/security model.
- Role and audit review for invite-only users.
- Session duration and revocation review.

## Gaps Remaining

- Credentials-dependent SSO remains owner-blocked.
- DB migration work remains separately approval-gated.
- External identity changes must not be bundled with release-hygiene cleanup.

## Rollback

Report-only. If committed, rollback is:

```bash
git revert <commit-that-adds-this-report> && git push
```
