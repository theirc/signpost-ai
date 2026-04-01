import { codec } from "./encoder"
import { getOrCreateContact } from "./messages"
import { telerivet } from "./telerivet"

export const integrations = {
  telerivet,
  codec,
  getOrCreateContact,
}