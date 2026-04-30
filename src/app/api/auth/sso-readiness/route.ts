import { NextRequest, NextResponse } from 'next/server'
import { AZURE_AD_SCOPES, getAzureAdRedirectUri, isAzureAdConfigured } from '@/lib/azure-ad-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ReadinessState = 'LIVE' | 'READY' | 'SETUP_REQUIRED' | 'DISABLED'

function hasEnv(name: string): boolean {
  return Boolean((process.env[name] || '').trim())
}

function missingEnv(names: string[]): string[] {
  return names.filter((name) => !hasEnv(name))
}

function envPresence(names: string[]): Record<string, boolean> {
  return Object.fromEntries(names.map((name) => [name, hasEnv(name)]))
}

function stateFromMissing(requiredMissing: string[]): ReadinessState {
  return requiredMissing.length === 0 ? 'READY' : 'SETUP_REQUIRED'
}

export async function GET(request: NextRequest) {
  const googleRequired = ['NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID']
  const googleConfigured = hasEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID') || hasEnv('GOOGLE_CLIENT_ID')
  const googleMissing = googleConfigured ? [] : googleRequired

  const microsoftRequired = ['AZURE_AD_CLIENT_ID', 'AZURE_AD_CLIENT_SECRET', 'AZURE_AD_TENANT_ID']
  const microsoftMissing = missingEnv(microsoftRequired)
  const microsoftConfigured = isAzureAdConfigured()

  return NextResponse.json({
    ok: true,
    mode: 'auth_sso_readiness_read_only',
    generated_at: new Date().toISOString(),
    no_secrets_exposed: true,
    env_values_exposed: false,
    canonical_login_url: 'https://tkmc.knowledge-vs-ai.com/login',
    session_policy: {
      tkmc: 'canonical_user_facing_mission_control_login',
      mc: 'separate_claudeclaw_owner_admin_dashboard',
      shared_session_enabled: false,
      redirect_mc_to_tkmc: false,
      note: 'mc stays separate until an owner-approved auth bridge, shared IdP, or Cloudflare Access policy is designed.',
    },
    providers: [
      {
        id: 'email_password',
        label: 'Email/password',
        state: 'LIVE' satisfies ReadinessState,
        visible: true,
        clickable_when_configured: true,
        login_endpoint: '/api/auth/login',
        callback_path: null,
        required_env_names: [],
        missing_env_names: [],
        owner_action_required: false,
        note: 'Owner/admin backup login remains available.',
      },
      {
        id: 'google_workspace',
        label: 'Google Workspace',
        state: stateFromMissing(googleMissing),
        visible: true,
        clickable_when_configured: googleConfigured,
        login_endpoint: '/api/auth/google',
        callback_path: null,
        required_env_names: googleRequired,
        env_present_by_name: envPresence(googleRequired),
        missing_env_names: googleMissing,
        owner_action_required: !googleConfigured,
        note: googleConfigured
          ? 'Google token verification can run with the configured client id.'
          : 'Button should remain visible but disabled/setup-pending until the owner configures Google Workspace OAuth.',
      },
      {
        id: 'microsoft_365',
        label: 'Microsoft 365 / Entra ID',
        state: microsoftConfigured ? 'READY' : 'SETUP_REQUIRED',
        visible: true,
        clickable_when_configured: microsoftConfigured,
        login_endpoint: '/api/auth/azure-ad',
        callback_path: '/api/auth/callback/azure-ad',
        computed_redirect_uri: getAzureAdRedirectUri(request),
        production_redirect_uri_needed: 'https://tkmc.knowledge-vs-ai.com/api/auth/callback/azure-ad',
        required_env_names: microsoftRequired,
        optional_env_names: ['AZURE_AD_REDIRECT_URI'],
        scopes: AZURE_AD_SCOPES,
        env_present_by_name: envPresence([...microsoftRequired, 'AZURE_AD_REDIRECT_URI']),
        missing_env_names: microsoftMissing,
        owner_action_required: !microsoftConfigured,
        note: microsoftConfigured
          ? 'Microsoft Entra OAuth is configured by environment name and can start the OAuth redirect.'
          : 'Button should remain visible but disabled/setup-pending until client id, tenant id, and client secret are configured through the approved secret path.',
      },
      {
        id: 'saml',
        label: 'SAML',
        state: 'DISABLED' satisfies ReadinessState,
        visible: false,
        clickable_when_configured: false,
        login_endpoint: null,
        callback_path: null,
        required_env_names: ['ENABLE_SAML'],
        missing_env_names: [],
        owner_action_required: false,
        note: 'SAML is not used in this phase and must not appear as Requires owner setup.',
      },
    ],
    invite_access: {
      state: 'READY_FOR_ADMIN_REVIEW',
      model: 'owner_approved_invited_users_only',
      request_endpoint: '/api/auth/access-requests',
      review_endpoint: '/api/auth/access-requests',
      reviewer_required_role: 'admin',
      direct_public_signup_enabled: false,
      note: 'SSO identities can create access requests; admin approval is required before Mission Control access.',
    },
    safe_ui_contract: {
      sso_buttons_stay_visible: true,
      setup_pending_buttons_disabled: true,
      never_fake_login_behavior: true,
      saml_hidden_this_phase: true,
      no_secret_values_in_response: true,
    },
  })
}
