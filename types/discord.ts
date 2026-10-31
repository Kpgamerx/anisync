/**
 * Discord HTTP interaction types for the webhook-based bot
 * (app/api/discord/interactions/route.ts).
 *
 * Only the subset of the Discord Interactions API that AniSync consumes
 * is modeled — application commands, message components, and responses.
 */

export type InteractionType =
  | "PING" // 1
  | "APPLICATION_COMMAND" // 2
  | "MESSAGE_COMPONENT" // 3
  | "APPLICATION_COMMAND_AUTOCOMPLETE" // 4
  | "MODAL_SUBMIT"; // 5

export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
} as const;

export type InteractionResponseType =
  | "PONG" // 1
  | "CHANNEL_MESSAGE_WITH_SOURCE" // 4
  | "DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE" // 5
  | "DEFERRED_UPDATE_MESSAGE" // 6
  | "UPDATE_MESSAGE" // 7
  | "MODAL"; // 9

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  MODAL: 9,
} as const;

export type ApplicationCommandType = "CHAT_INPUT"; // 1

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  discriminator: string;
  avatar: string | null;
  bot?: boolean;
}

export interface GuildMember {
  user?: DiscordUser;
  nick?: string | null;
  permissions?: string;
}

export interface ApplicationCommandInteractionDataOption {
  name: string;
  type: number; // 1=subcommand, 3=string, 4=int, 5=bool, 6=user, 8=role
  value?: unknown;
  options?: ApplicationCommandInteractionDataOption[];
  focused?: boolean;
}

export interface ApplicationCommandInteractionData {
  id: string;
  name: string;
  type?: number;
  guild_id?: string;
  options?: ApplicationCommandInteractionDataOption[];
  resolved?: {
    users?: Record<string, DiscordUser>;
    members?: Record<string, GuildMember>;
  };
}

export interface MessageComponentInteractionData {
  custom_id: string;
  component_type: number; // 2=button, 3=select
}

export interface DiscordInteraction {
  id: string;
  application_id: string;
  type: number; // InteractionType
  token: string;
  guild_id?: string;
  channel_id?: string;
  member?: GuildMember;
  user?: DiscordUser;
  data?: ApplicationCommandInteractionData | MessageComponentInteractionData;
  locale?: string;
  message?: {
    id: string;
    content: string;
  };
}

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface EmbedThumbnail {
  url: string;
}

export interface EmbedImage {
  url: string;
}

export interface EmbedAuthor {
  name: string;
  url?: string;
  icon_url?: string;
}

export interface EmbedFooter {
  text: string;
  icon_url?: string;
}

export interface DiscordEmbed {
  title?: string;
  type?: "rich";
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: EmbedFooter;
  image?: EmbedImage;
  thumbnail?: EmbedThumbnail;
  author?: EmbedAuthor;
  fields?: EmbedField[];
}

export interface DiscordButtonComponent {
  type: 2;
  style: 1 | 2 | 3 | 4 | 5; // Primary | Secondary | Success | Danger | Link
  label?: string;
  custom_id?: string;
  url?: string;
  disabled?: boolean;
  emoji?: { name: string; animated?: boolean };
}

export interface DiscordActionRow {
  type: 1;
  components: Array<DiscordButtonComponent | DiscordSelectMenuComponent>;
}

export interface DiscordSelectMenuOption {
  label: string;
  value: string;
  description?: string;
  emoji?: { name: string };
  default?: boolean;
}

export interface DiscordSelectMenuComponent {
  type: 3;
  custom_id: string;
  options: DiscordSelectMenuOption[];
  placeholder?: string;
  min_values?: number;
  max_values?: number;
}

export type DiscordComponent = DiscordActionRow;

export interface InteractionCallbackData {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordComponent[];
  flags?: number; // 64 = ephemeral
  tts?: boolean;
  attachments?: Array<{ id: string }>;
}

export interface InteractionResponse {
  type: number; // InteractionResponseType
  data?: InteractionCallbackData;
}

/** Helper to build a deferred (thinking…) response. */
export function deferredResponse(ephemeral = false): InteractionResponse {
  return {
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    ...(ephemeral ? { data: { flags: 64 } } : {}),
  };
}

/** Helper to build an immediate ephemeral message response. */
export function ephemeralMessageResponse(
  content: string,
  embeds?: DiscordEmbed[],
  components?: DiscordComponent[],
): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, embeds, components, flags: 64 },
  };
}

/** Helper to build a public message response. */
export function messageResponse(
  embeds?: DiscordEmbed[],
  components?: DiscordComponent[],
  content?: string,
): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, embeds, components },
  };
}

/** Helper to build a PONG response for Discord's URL verification handshake. */
export function pongResponse(): InteractionResponse {
  return { type: InteractionResponseType.PONG };
}
