# Identity Face and Voice Secure Operator Procedure

## Purpose
This procedure defines how Mission Control should analyze and use face recognition and voice recognition without fake readiness, raw secret exposure, raw media storage, or unauthorized camera/microphone access.

## Current State
- Mission Control identity verification is a control-plane lane.
- Face and voice enrollment are owner-permission gated.
- Mission Control must not open the camera or microphone from the server.
- Mission Control must not persist raw camera frames, microphone audio, biometric samples, cookies, tokens, passwords, or `.env` values.
- High-trust actions remain blocked until owner identity reaches `owner_verified` and Jarvis concurrence is present.

## Required Preflight
1. Confirm `/login` returns `200`.
2. Confirm protected identity routes return `401` when unauthenticated.
3. Confirm the owner is authenticated in Mission Control before any permission request.
4. Confirm `mission-control.service` is active and not running from a deleted Next standalone bundle.
5. Confirm `.env` diff is clean.
6. Confirm no DNS, Caddy, Tailscale, firewall, or public exposure changes are part of the identity lane.

## Operator Routes
- `GET /api/bridge/identity/status`
- `GET /api/bridge/identity/project-status`
- `GET /api/bridge/identity/operator-procedure`
- `GET /api/bridge/identity/devices`
- `POST /api/bridge/identity/devices/register`
- `GET /api/bridge/identity/policy`
- `POST /api/bridge/identity/check-action`
- `POST /api/bridge/identity/challenge/start`
- `POST /api/bridge/identity/challenge/verify`
- `GET /api/bridge/identity/camera/status`
- `POST /api/bridge/identity/camera/request`
- `POST /api/bridge/identity/camera/capture-proof`
- `POST /api/bridge/identity/face/enroll`
- `POST /api/bridge/identity/voice/enroll`
- `POST /api/bridge/identity/final-certification`

## Face Recognition Steps
1. Open Mission Control through an authenticated owner session.
2. Read `GET /api/bridge/identity/operator-procedure`.
3. Register or verify the owner device through `POST /api/bridge/identity/devices/register`.
4. Request camera permission through `POST /api/bridge/identity/camera/request`.
5. Do not continue if the blocker is `owner_device_action_required`.
6. After explicit owner camera approval, run only the scoped face enrollment route.
7. Confirm the route does not persist raw media and does not expose secrets.
8. Record visible Mission Control task proof with audit and rollback IDs.

## Voice Recognition Steps
1. Open Mission Control through an authenticated owner session.
2. Confirm microphone permission is explicitly granted by the owner.
3. Do not continue if the blocker is `owner_microphone_or_voice_sample_permission_required`.
4. After explicit owner microphone approval, run only the scoped voice enrollment route.
5. Confirm no raw audio, token, cookie, password, or `.env` value is printed or persisted.
6. Record visible Mission Control task proof with audit and rollback IDs.

## Hard Stops
- Raw secret access.
- Credential injection.
- Printing tokens, cookies, passwords, or `.env` values.
- Camera or microphone access without owner prompt.
- Biometric capture without owner permission.
- Raw media persistence.
- Public exposure, DNS, Caddy, Tailscale, or firewall changes.
- Destructive deletion.
- Disabling auth, audit, rollback, or redaction.

## Rollback
Archive the identity Mission Control task/events and delete `identity-verification-state.json`. There is no raw media, camera, microphone, biometric, credential, or public exposure state to remove.
