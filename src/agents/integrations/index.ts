import { codec } from "./encoder"
import { getOrCreateContact, saveMessage } from "./messages"
import { telerivet } from "./telerivet"

export const integrations = {
  telerivet,
  codec,
  getOrCreateContact,
  saveMessage,
}