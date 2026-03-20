// Connector catalog — all available MCP connectors and their actions

export let CONNECTOR_CATALOG = {
  apollo: {
    id: 'apollo', name: 'Apollo.io', icon: 'A', category: 'sales',
    description: 'Sales intelligence and engagement platform',
    actions: [
      { id: 'apollo_contacts_search', name: 'Search Contacts', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_contacts_search' },
      { id: 'apollo_contacts_create', name: 'Create Contact', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_contacts_create' },
      { id: 'apollo_contacts_update', name: 'Update Contact', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_contacts_update' },
      { id: 'apollo_accounts_create', name: 'Create Account', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_accounts_create' },
      { id: 'apollo_accounts_update', name: 'Update Account', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_accounts_update' },
      { id: 'apollo_mixed_people_api_search', name: 'Search People', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_mixed_people_api_search' },
      { id: 'apollo_mixed_companies_search', name: 'Search Companies', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_mixed_companies_search' },
      { id: 'apollo_people_match', name: 'Match Person', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_people_match' },
      { id: 'apollo_people_bulk_match', name: 'Bulk Match People', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_people_bulk_match' },
      { id: 'apollo_organizations_enrich', name: 'Enrich Organization', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_organizations_enrich' },
      { id: 'apollo_organizations_bulk_enrich', name: 'Bulk Enrich Orgs', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_organizations_bulk_enrich' },
      { id: 'apollo_organizations_job_postings', name: 'Job Postings', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_organizations_job_postings' },
      { id: 'apollo_email_accounts_index', name: 'List Email Accounts', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_email_accounts_index' },
      { id: 'apollo_emailer_campaigns_search', name: 'Search Campaigns', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_emailer_campaigns_search' },
      { id: 'apollo_emailer_campaigns_add_contact_ids', name: 'Add to Campaign', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_emailer_campaigns_add_contact_ids' },
      { id: 'apollo_emailer_campaigns_remove_or_stop_contact_ids', name: 'Remove from Campaign', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_emailer_campaigns_remove_or_stop_contact_ids' },
      { id: 'apollo_users_api_profile', name: 'User Profile', mcpTool: 'mcp__claude_ai_Apollo_io__apollo_users_api_profile' },
    ],
  },
  gmail: {
    id: 'gmail', name: 'Gmail', icon: 'M', category: 'communication',
    description: 'Read and draft emails via Gmail',
    actions: [
      { id: 'gmail_search_messages', name: 'Search Messages', mcpTool: 'mcp__claude_ai_Gmail__gmail_search_messages' },
      { id: 'gmail_read_message', name: 'Read Message', mcpTool: 'mcp__claude_ai_Gmail__gmail_read_message' },
      { id: 'gmail_read_thread', name: 'Read Thread', mcpTool: 'mcp__claude_ai_Gmail__gmail_read_thread' },
      { id: 'gmail_create_draft', name: 'Create Draft', mcpTool: 'mcp__claude_ai_Gmail__gmail_create_draft' },
      { id: 'gmail_list_drafts', name: 'List Drafts', mcpTool: 'mcp__claude_ai_Gmail__gmail_list_drafts' },
      { id: 'gmail_list_labels', name: 'List Labels', mcpTool: 'mcp__claude_ai_Gmail__gmail_list_labels' },
      { id: 'gmail_get_profile', name: 'Get Profile', mcpTool: 'mcp__claude_ai_Gmail__gmail_get_profile' },
    ],
  },
  'google-calendar': {
    id: 'google-calendar', name: 'Google Calendar', icon: 'C', category: 'productivity',
    description: 'Manage calendar events and find availability',
    actions: [
      { id: 'gcal_list_events', name: 'List Events', mcpTool: 'mcp__claude_ai_Google_Calendar__gcal_list_events' },
      { id: 'gcal_get_event', name: 'Get Event', mcpTool: 'mcp__claude_ai_Google_Calendar__gcal_get_event' },
      { id: 'gcal_create_event', name: 'Create Event', mcpTool: 'mcp__claude_ai_Google_Calendar__gcal_create_event' },
      { id: 'gcal_update_event', name: 'Update Event', mcpTool: 'mcp__claude_ai_Google_Calendar__gcal_update_event' },
      { id: 'gcal_delete_event', name: 'Delete Event', mcpTool: 'mcp__claude_ai_Google_Calendar__gcal_delete_event' },
      { id: 'gcal_respond_to_event', name: 'Respond to Event', mcpTool: 'mcp__claude_ai_Google_Calendar__gcal_respond_to_event' },
      { id: 'gcal_list_calendars', name: 'List Calendars', mcpTool: 'mcp__claude_ai_Google_Calendar__gcal_list_calendars' },
      { id: 'gcal_find_meeting_times', name: 'Find Meeting Times', mcpTool: 'mcp__claude_ai_Google_Calendar__gcal_find_meeting_times' },
      { id: 'gcal_find_my_free_time', name: 'Find Free Time', mcpTool: 'mcp__claude_ai_Google_Calendar__gcal_find_my_free_time' },
    ],
  },
  slack: {
    id: 'slack', name: 'Slack', icon: 'S', category: 'communication',
    description: 'Read and send messages in Slack workspaces',
    actions: [
      { id: 'slack_read_channel', name: 'Read Channel', mcpTool: 'mcp__claude_ai_Slack__slack_read_channel' },
      { id: 'slack_read_thread', name: 'Read Thread', mcpTool: 'mcp__claude_ai_Slack__slack_read_thread' },
      { id: 'slack_send_message', name: 'Send Message', mcpTool: 'mcp__claude_ai_Slack__slack_send_message' },
      { id: 'slack_send_message_draft', name: 'Send Draft', mcpTool: 'mcp__claude_ai_Slack__slack_send_message_draft' },
      { id: 'slack_schedule_message', name: 'Schedule Message', mcpTool: 'mcp__claude_ai_Slack__slack_schedule_message' },
      { id: 'slack_search_channels', name: 'Search Channels', mcpTool: 'mcp__claude_ai_Slack__slack_search_channels' },
      { id: 'slack_search_public', name: 'Search Public', mcpTool: 'mcp__claude_ai_Slack__slack_search_public' },
      { id: 'slack_search_public_and_private', name: 'Search All', mcpTool: 'mcp__claude_ai_Slack__slack_search_public_and_private' },
      { id: 'slack_search_users', name: 'Search Users', mcpTool: 'mcp__claude_ai_Slack__slack_search_users' },
      { id: 'slack_read_user_profile', name: 'Read User Profile', mcpTool: 'mcp__claude_ai_Slack__slack_read_user_profile' },
      { id: 'slack_create_canvas', name: 'Create Canvas', mcpTool: 'mcp__claude_ai_Slack__slack_create_canvas' },
      { id: 'slack_read_canvas', name: 'Read Canvas', mcpTool: 'mcp__claude_ai_Slack__slack_read_canvas' },
      { id: 'slack_update_canvas', name: 'Update Canvas', mcpTool: 'mcp__claude_ai_Slack__slack_update_canvas' },
    ],
  },
  ahrefs: {
    id: 'ahrefs', name: 'Ahrefs', icon: 'H', category: 'marketing',
    description: 'SEO analytics, keyword research, and backlink data',
    actions: [
      { id: 'ahrefs_site_explorer_overview', name: 'Site Metrics', mcpTool: 'mcp__claude_ai_Ahrefs__site-explorer-metrics' },
      { id: 'ahrefs_site_explorer_backlinks', name: 'Backlinks Stats', mcpTool: 'mcp__claude_ai_Ahrefs__site-explorer-backlinks-stats' },
      { id: 'ahrefs_site_explorer_organic_keywords', name: 'Organic Keywords', mcpTool: 'mcp__claude_ai_Ahrefs__site-explorer-organic-keywords' },
      { id: 'ahrefs_site_explorer_top_pages', name: 'Top Pages', mcpTool: 'mcp__claude_ai_Ahrefs__site-explorer-top-pages' },
      { id: 'ahrefs_site_explorer_domain_rating', name: 'Domain Rating', mcpTool: 'mcp__claude_ai_Ahrefs__site-explorer-domain-rating' },
      { id: 'ahrefs_keywords_explorer_overview', name: 'Keyword Overview', mcpTool: 'mcp__claude_ai_Ahrefs__keywords-explorer-overview' },
      { id: 'ahrefs_keywords_explorer_matching', name: 'Matching Terms', mcpTool: 'mcp__claude_ai_Ahrefs__keywords-explorer-matching-terms' },
      { id: 'ahrefs_serp_overview', name: 'SERP Overview', mcpTool: 'mcp__claude_ai_Ahrefs__serp-overview' },
      { id: 'ahrefs_doc', name: 'API Docs', mcpTool: 'mcp__claude_ai_Ahrefs__doc' },
    ],
  },
  granola: {
    id: 'granola', name: 'Granola', icon: 'G', category: 'productivity',
    description: 'Meeting notes and transcript search',
    actions: [
      { id: 'granola_list_meetings', name: 'List Meetings', mcpTool: 'mcp__claude_ai_Granola__list_meetings' },
      { id: 'granola_get_meetings', name: 'Get Meetings', mcpTool: 'mcp__claude_ai_Granola__get_meetings' },
      { id: 'granola_get_meeting_transcript', name: 'Get Transcript', mcpTool: 'mcp__claude_ai_Granola__get_meeting_transcript' },
      { id: 'granola_query_meetings', name: 'Query Meetings', mcpTool: 'mcp__claude_ai_Granola__query_granola_meetings' },
    ],
  },
  playwright: {
    id: 'playwright', name: 'Playwright', icon: 'P', category: 'dev-tools',
    description: 'Browser automation and web testing',
    actions: [
      { id: 'browser_navigate', name: 'Navigate', mcpTool: 'mcp__plugin_playwright_playwright__browser_navigate' },
      { id: 'browser_navigate_back', name: 'Navigate Back', mcpTool: 'mcp__plugin_playwright_playwright__browser_navigate_back' },
      { id: 'browser_snapshot', name: 'Snapshot', mcpTool: 'mcp__plugin_playwright_playwright__browser_snapshot' },
      { id: 'browser_take_screenshot', name: 'Screenshot', mcpTool: 'mcp__plugin_playwright_playwright__browser_take_screenshot' },
      { id: 'browser_click', name: 'Click', mcpTool: 'mcp__plugin_playwright_playwright__browser_click' },
      { id: 'browser_type', name: 'Type', mcpTool: 'mcp__plugin_playwright_playwright__browser_type' },
      { id: 'browser_fill_form', name: 'Fill Form', mcpTool: 'mcp__plugin_playwright_playwright__browser_fill_form' },
      { id: 'browser_select_option', name: 'Select Option', mcpTool: 'mcp__plugin_playwright_playwright__browser_select_option' },
      { id: 'browser_hover', name: 'Hover', mcpTool: 'mcp__plugin_playwright_playwright__browser_hover' },
      { id: 'browser_drag', name: 'Drag', mcpTool: 'mcp__plugin_playwright_playwright__browser_drag' },
      { id: 'browser_press_key', name: 'Press Key', mcpTool: 'mcp__plugin_playwright_playwright__browser_press_key' },
      { id: 'browser_file_upload', name: 'File Upload', mcpTool: 'mcp__plugin_playwright_playwright__browser_file_upload' },
      { id: 'browser_handle_dialog', name: 'Handle Dialog', mcpTool: 'mcp__plugin_playwright_playwright__browser_handle_dialog' },
      { id: 'browser_evaluate', name: 'Evaluate JS', mcpTool: 'mcp__plugin_playwright_playwright__browser_evaluate' },
      { id: 'browser_run_code', name: 'Run Code', mcpTool: 'mcp__plugin_playwright_playwright__browser_run_code' },
      { id: 'browser_console_messages', name: 'Console Messages', mcpTool: 'mcp__plugin_playwright_playwright__browser_console_messages' },
      { id: 'browser_network_requests', name: 'Network Requests', mcpTool: 'mcp__plugin_playwright_playwright__browser_network_requests' },
      { id: 'browser_tabs', name: 'Tabs', mcpTool: 'mcp__plugin_playwright_playwright__browser_tabs' },
      { id: 'browser_resize', name: 'Resize', mcpTool: 'mcp__plugin_playwright_playwright__browser_resize' },
      { id: 'browser_close', name: 'Close', mcpTool: 'mcp__plugin_playwright_playwright__browser_close' },
      { id: 'browser_wait_for', name: 'Wait For', mcpTool: 'mcp__plugin_playwright_playwright__browser_wait_for' },
      { id: 'browser_install', name: 'Install', mcpTool: 'mcp__plugin_playwright_playwright__browser_install' },
    ],
  },
  exa: {
    id: 'exa', name: 'Exa', icon: 'E', category: 'dev-tools',
    description: 'AI-powered web search and code context',
    actions: [
      { id: 'exa_web_search', name: 'Web Search', mcpTool: 'mcp__plugin_sales-skills_exa__web_search_exa' },
      { id: 'exa_get_code_context', name: 'Get Code Context', mcpTool: 'mcp__plugin_sales-skills_exa__get_code_context_exa' },
    ],
  },
};

// Resolve connector configs into a flat array of MCP tool permission strings
export function resolveConnectorPermissions(connectors, catalog = CONNECTOR_CATALOG) {
  if (!connectors?.length) return [];
  const tools = [];
  for (const cfg of connectors) {
    const connector = catalog[cfg.connectorId];
    if (!connector) continue;
    for (const action of connector.actions) {
      if (cfg.allEnabled || cfg.enabledActions?.includes(action.id)) {
        tools.push(action.mcpTool);
      }
    }
  }
  return tools;
}

// ── Catalog sync helpers ──

export function setCatalog(catalog) {
  CONNECTOR_CATALOG = catalog;
}

// Known service metadata overrides
const SERVICE_META = {
  Apollo_io:        { name: 'Apollo.io', icon: 'A', category: 'sales',         description: 'Sales intelligence and engagement platform' },
  Gmail:            { name: 'Gmail',     icon: 'M', category: 'communication', description: 'Read and draft emails via Gmail' },
  Google_Calendar:  { name: 'Google Calendar', icon: 'C', category: 'productivity', description: 'Manage calendar events and find availability' },
  Slack:            { name: 'Slack',     icon: 'S', category: 'communication', description: 'Read and send messages in Slack workspaces' },
  Ahrefs:           { name: 'Ahrefs',    icon: 'H', category: 'marketing',     description: 'SEO analytics, keyword research, and backlink data' },
  Granola:          { name: 'Granola',   icon: 'G', category: 'productivity',  description: 'Meeting notes and transcript search' },
  playwright_playwright: { name: 'Playwright', icon: 'P', category: 'dev-tools', description: 'Browser automation and web testing' },
  'sales-skills_exa':    { name: 'Exa',  icon: 'E', category: 'dev-tools',    description: 'AI-powered web search and code context' },
};

/**
 * Convert a connector key to a display name.
 * Apollo_io → Apollo.io, Google_Calendar → Google Calendar
 */
export function generateConnectorMeta(key) {
  if (SERVICE_META[key]) return { ...SERVICE_META[key] };
  const displayName = key
    .replace(/_io$/i, '.io')
    .replace(/_ai$/i, '.ai')
    .replace(/_/g, ' ');
  return {
    name: displayName,
    icon: displayName[0]?.toUpperCase() || '?',
    category: 'other',
    description: `${displayName} connector`,
  };
}

// Common prefixes to strip from action names
const ACTION_PREFIXES = [
  'apollo', 'gmail', 'gcal', 'slack', 'granola',
  'browser', 'exa', 'ahrefs',
];

/**
 * Convert a function name to a human-readable action name.
 * apollo_contacts_search → Search Contacts
 * browser_take_screenshot → Take Screenshot
 */
export function generateActionName(fnName) {
  let cleaned = fnName;
  // Strip known prefixes
  for (const prefix of ACTION_PREFIXES) {
    if (cleaned.startsWith(prefix + '_')) {
      cleaned = cleaned.slice(prefix.length + 1);
      break;
    }
  }
  // Convert snake_case to Title Case, handle hyphens too
  return cleaned
    .split(/[_-]/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Parse an array of MCP tool names into a connector catalog.
 * Merges with existing catalog metadata when available.
 */
export function parseMcpTools(toolNames) {
  // Group tools by connector key
  const groups = {};

  for (const tool of toolNames) {
    // Split by __ (double underscore) — gives 3 segments:
    // mcp__claude_ai_Apollo_io__apollo_contacts_search → ["mcp", "claude_ai_Apollo_io", "apollo_contacts_search"]
    // mcp__plugin_playwright_playwright__browser_click → ["mcp", "plugin_playwright_playwright", "browser_click"]
    const segments = tool.split('__');
    if (segments[0] !== 'mcp' || segments.length < 3) continue;

    let connectorKey, fnName;
    const middle = segments[1];

    if (middle.startsWith('claude_ai_')) {
      // mcp__{claude_ai_Service}__{fn}
      connectorKey = middle.replace(/^claude_ai_/, '');
      fnName = segments.slice(2).join('__');
    } else if (middle.startsWith('plugin_')) {
      // mcp__{plugin_name_type}__{fn}
      connectorKey = middle.replace(/^plugin_/, '');
      fnName = segments.slice(2).join('__');
    } else {
      continue;
    }

    if (!groups[connectorKey]) groups[connectorKey] = [];
    groups[connectorKey].push({ fnName, mcpTool: tool });
  }

  // Build catalog, merging with existing metadata
  const catalog = {};
  const existingCatalog = CONNECTOR_CATALOG;

  for (const [key, tools] of Object.entries(groups)) {
    // Find existing connector by matching key or checking existing actions' mcpTool prefixes
    let existingConnector = null;
    let connectorId = key.toLowerCase().replace(/_/g, '-');

    // Check for exact match in existing catalog
    for (const [id, conn] of Object.entries(existingCatalog)) {
      const sampleTool = tools[0]?.mcpTool || '';
      if (conn.actions?.some(a => sampleTool.startsWith(a.mcpTool?.split('__').slice(0, -1).join('__') || '---'))) {
        existingConnector = conn;
        connectorId = id;
        break;
      }
    }
    // Also try direct ID match
    if (!existingConnector && existingCatalog[connectorId]) {
      existingConnector = existingCatalog[connectorId];
    }

    const meta = existingConnector
      ? { name: existingConnector.name, icon: existingConnector.icon, category: existingConnector.category, description: existingConnector.description }
      : generateConnectorMeta(key);

    const actions = tools.map(({ fnName, mcpTool }) => ({
      id: fnName.replace(/-/g, '_'),
      name: generateActionName(fnName),
      mcpTool,
    }));

    catalog[connectorId] = {
      id: connectorId,
      ...meta,
      actions,
    };
  }

  return catalog;
}
