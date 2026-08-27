import type { MetaPlatform } from "./types"

export const baseUrl = "https://graph.facebook.com/v25.0"

export const MAX_QUICK_REPLIES = 13
export const MAX_QUICK_REPLY_LENGTH = 20

// Instagram DMs travel over the same Send API as Messenger, with a shorter text limit,
// a different profile shape and no support for documents.
export const platforms = {
  messenger: { maxTextLength: 2000, profileFields: "first_name,last_name", supportsFiles: true },
  instagram: { maxTextLength: 1000, profileFields: "name,username", supportsFiles: false },
} satisfies { [platform: string]: MetaPlatform }
