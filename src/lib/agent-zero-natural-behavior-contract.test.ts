import { describe, expect, it } from 'vitest'
import {
  buildAgentZeroReadOnlyContext,
  buildAgentZeroReadOnlyPrompt,
  sanitizeAgentZeroOwnerReply,
} from './agent-zero-bridge'

const naturalOwnerPrompts = [
  'What tools can you see right now?',
  'What models can you use?',
  'Which integrations are available?',
  'What skills do you have?',
  'Which agents can you see?',
  'Which providers are currently configured?',
  'Can you see Mission Control?',
  'Can you see Bridge and MCP?',
  'Can you see OpenRouter?',
  'Can you see OpenCloud?',
  'Can you see Build-Wiki?',
  'Can you see the farmer status?',
  'Can you see Obsidian?',
  'Can you see MemPalace?',
  'Can you see Graphify?',
  'Can you see the Brain system?',
  'Tell me what is connected.',
  'Tell me what is blocked.',
  'Tell me what is configured but not connected.',
  'Tell me what is visible through Mission Control.',
  'Do not execute anything. What would you do next?',
  'Do not execute anything. List available tools.',
  'Do not execute anything. Explain the model registry.',
  'Do not execute anything. Explain the skill registry.',
  'Do not execute anything. Explain the integration registry.',
  'Can you create a report?',
  'Can you make a PDF report?',
  'Can you attach a PDF in Telegram?',
  'Can you send a report to Google Drive?',
  'Can you send a report to OneDrive?',
  'Create a capability report, but do not execute anything.',
  'Create a report and make it available in Mission Control.',
  'Create a report and send it to OneDrive if possible.',
  'Create a report and send it to Google Drive if possible.',
  'Create a report and attach it in Telegram if possible.',
  'If a connector is blocked, say the exact blocker.',
  'If a file already exists, do not ask me to send it again.',
  'If you cannot upload, do not say done.',
  'If you cannot execute, say what is blocked.',
  'Answer naturally in one short paragraph.',
  'No status labels, please.',
  'No tool dumps.',
  'No runtime trace.',
  'No local paths.',
  'No task IDs unless I ask.',
  'Tell me whether Google Drive is configured.',
  'Tell me whether OneDrive is configured.',
  'Tell me whether Telegram attachment is configured.',
  'Tell me whether Zapier is visible.',
  'Tell me whether HeyGen schema is visible.',
  'Tell me whether HeyGen execution is enabled.',
  'Tell me whether SMB is mounted.',
  'Tell me whether Fork 2 can run.',
  'Tell me whether Build-Wiki Run Now needs a Bridge Session.',
  'Tell me whether you can run Build-Wiki without approval.',
  'Tell me whether external farmers are enabled.',
  'Tell me whether broad shell is available.',
  'Tell me whether Docker socket is available.',
  'Tell me whether root access is available.',
  'Tell me whether secrets are exposed.',
  'Tell me whether MCP tools can execute.',
  'Tell me whether MCP schemas are visible.',
  'Tell me whether Zapier tools are visible.',
  'Tell me whether OpenAI is configured.',
  'Tell me whether OpenRouter is configured.',
  'Tell me whether local models are configured.',
  'Tell me whether Agent Zero can write Obsidian.',
  'Tell me whether Agent Zero can write MemPalace.',
  'Tell me whether Agent Zero can read Obsidian.',
  'Tell me whether Agent Zero can read MemPalace.',
  'Tell me whether reports can be delivered through Mission Control.',
  'Tell me whether reports can be delivered through OneDrive.',
  'Tell me whether reports can be delivered through Google Drive.',
  'Tell me whether reports can be delivered through Telegram.',
  'What would you recommend next?',
  'What is the safest next step?',
  'What can you do without a Bridge Session?',
  'What needs a Bridge Session?',
  'What needs owner approval?',
  'What is blocked by credentials?',
  'What is blocked by missing connector?',
  'What is blocked by SMB?',
  'What is blocked by external write approval?',
  'Can you remember a task result?',
  'Can you remember an owner preference?',
  'Can you update a safe memory summary?',
  'Can you link memory to a report?',
  'Can you write raw private memory?',
  'Can you dump memory records?',
  'Can you read raw filesystem paths?',
  'Can you access the vault directly?',
  'Can you call Zapier writes?',
  'Can you run HeyGen?',
  'Can you send an external webhook?',
  'Can you push a repo?',
  'Can you modify production config?',
  'Can you execute protected actions?',
  'Can you run OpenCloud docs farmer now?',
  'Can you answer as a normal assistant?',
  'Summarize what you can see without sounding robotic.',
]

describe('Agent Zero natural behavior contract', () => {
  it('injects natural behavior rules for 100 common owner prompts', () => {
    expect(naturalOwnerPrompts).toHaveLength(100)
    const context = buildAgentZeroReadOnlyContext({
      providerIds: ['agent_zero', 'openrouter'],
      bridgeSessionAvailable: true,
      mcpVisible: true,
      googleDriveVisible: true,
      oneDriveVisible: true,
      zapierVisible: true,
      heygenVisible: true,
      heygenSchemaVisible: true,
      skillNames: ['reporting', 'bridge-review'],
    })

    for (const ownerPrompt of naturalOwnerPrompts) {
      const prompt = buildAgentZeroReadOnlyPrompt(ownerPrompt, context)
      expect(prompt).toContain(ownerPrompt)
      expect(prompt).toContain('Answer naturally')
      expect(prompt).toContain('Do not use robotic labels')
      expect(prompt).toContain('Do not expose raw error stage names')
      expect(prompt).toContain('Do not expose task IDs, local paths, raw filenames, traces, or tool dumps')
      expect(prompt).toContain('Do not say Done, completed, sent, or uploaded unless every requested outcome')
      expect(prompt).toContain('If a connector, upload, execution, or delivery is blocked, say the exact blocker once')
      expect(prompt).toContain('do not ask the owner to send it again')
      expect(prompt).toContain('execution is disabled')
      expect(prompt).toContain('Do not claim direct access beyond it')
    }
  })

  it('sanitizes raw paths, stage labels, task IDs, and fake done claims', () => {
    const cleaned = sanitizeAgentZeroOwnerReply({
      ownerMessage: 'Create a report and send it to OneDrive.',
      blocker: 'onedrive_upload_connector_not_configured',
      systemHasFile: true,
      text: [
        'Status: Done, Sir. Final report is ready: /home/tony/mission-control/runtime/agent-zero-reports/azr_123/report.pdf',
        'Failed stage: upload_to_onedrive',
        'Task ID: task-abc123456',
        'Please send the file again.',
      ].join('\n'),
    })

    expect(cleaned).not.toMatch(/^Done\b/i)
    expect(cleaned).not.toContain('/home/tony')
    expect(cleaned).not.toContain('runtime/agent-zero-reports')
    expect(cleaned).not.toContain('Failed stage')
    expect(cleaned).not.toMatch(/task-abc123456/i)
    expect(cleaned).not.toMatch(/send the file again/i)
    expect(cleaned).toContain('Blocked: onedrive upload connector not configured.')
    expect(cleaned).toContain('I can use the existing file')
  })

  it('preserves task IDs only when the owner asks for them', () => {
    const hidden = sanitizeAgentZeroOwnerReply({
      ownerMessage: 'Tell me what happened.',
      text: 'Result: Task ID: task-abc123456 is complete.',
    })
    const visible = sanitizeAgentZeroOwnerReply({
      ownerMessage: 'Show me the task ID.',
      text: 'Result: Task ID: task-abc123456 is complete.',
    })

    expect(hidden).not.toContain('task-abc123456')
    expect(visible).toContain('task-abc123456')
  })

  it('requires exact blockers for blocked connector and report delivery questions', () => {
    const oneDrive = sanitizeAgentZeroOwnerReply({
      ownerMessage: 'Send the report to OneDrive.',
      blocker: 'onedrive_upload_connector_not_configured',
      text: 'Done. I sent it.',
    })
    const googleDrive = sanitizeAgentZeroOwnerReply({
      ownerMessage: 'Send the report to Google Drive.',
      blocker: 'google_drive_upload_connector_not_configured',
      text: 'Result: Upload is unavailable.',
    })

    expect(oneDrive).not.toMatch(/^Done\b/i)
    expect(oneDrive).toContain('Blocked: onedrive upload connector not configured.')
    expect(googleDrive).toContain('Blocked: google drive upload connector not configured.')
  })
})
