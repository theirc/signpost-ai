import { codec } from "./encoder"
import { saveMessage } from "./messages"
import { telerivet } from "./telerivet"

export const integrations = {
  telerivet,
  codec,
  saveMessage,
}