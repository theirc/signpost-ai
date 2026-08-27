export const mimeTypes: { [ext: string]: string } = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  mp4: "video/mp4", mov: "video/quicktime", "3gp": "video/3gpp", webm: "video/webm",
  mp3: "audio/mpeg", ogg: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav",
  pdf: "application/pdf", txt: "text/plain",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

export function extensionOf(url: string): string {
  return (url.split("?")[0].split(".").pop()?.toLowerCase() ?? "").trim()
}

export function mimeOf(url: string): string {
  return mimeTypes[extensionOf(url)] || "application/octet-stream"
}
