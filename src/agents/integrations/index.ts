import { codec } from "./encoder"
import { contacts } from "./contacts"
import { getOrCreateContact, saveMessage } from "./messages"
import { telerivet } from "./telerivet"

export const integrations = {
  telerivet,
  codec,
  contacts,
  getOrCreateContact,
  saveMessage,
}