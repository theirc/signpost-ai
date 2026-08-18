// The agent can split its answer into several separate messages with the <break> tag (a Cloudscript convention).
// Files and audio travel with the first message, quick replies with the last one so the keyboard is the last thing the user sees.
export function splitBreaks(out: ChannelOutput): ChannelOutput[] {

  const response = out.response || ""
  if (!response.includes("<break>")) return [out]

  const parts = response.split("<break>").map(p => p.trim()).filter(p => p.length > 0)
  if (parts.length <= 1) return [{ ...out, response: parts[0] || "" }]

  return parts.map((response, i) => ({
    response,
    files: i === 0 ? out.files : [],
    quickReplies: i === parts.length - 1 ? out.quickReplies : [],
    audio: i === 0 ? out.audio : undefined,
  }))

}
