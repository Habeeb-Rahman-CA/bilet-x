/**
 * Raw Slack Web API models — the subset we consume from conversations.list,
 * conversations.history, and users.info.
 */
export interface SlackConversation {
  id: string;
  is_im?: boolean;
  is_mpim?: boolean;
  is_group?: boolean;
  is_channel?: boolean;
  is_archived?: boolean;
  is_open?: boolean;
  user?: string; // DM: the other user's ID
  name?: string; // group/channel name
  name_normalized?: string;
}

export interface SlackMessage {
  ts: string; // Timestamp with microsecond precision, doubles as message ID
  type?: string;
  subtype?: string;
  text?: string;
  user?: string; // Sender's user ID
  bot_id?: string;
  team?: string;
}

export interface SlackUserProfile {
  display_name?: string;
  real_name?: string;
  image_48?: string;
  image_72?: string;
}

export interface SlackUser {
  id: string;
  name?: string;
  real_name?: string;
  profile?: SlackUserProfile;
  is_bot?: boolean;
  deleted?: boolean;
}

export interface SlackConversationsListResponse {
  ok: boolean;
  error?: string;
  channels?: SlackConversation[];
  response_metadata?: { next_cursor?: string };
}

export interface SlackHistoryResponse {
  ok: boolean;
  error?: string;
  messages?: SlackMessage[];
  has_more?: boolean;
}

export interface SlackUsersInfoResponse {
  ok: boolean;
  error?: string;
  user?: SlackUser;
}
