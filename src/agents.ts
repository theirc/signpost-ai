import { workers } from "./workers"

export async function executeAgent(a: Agent): Promise<any> {

  a.variables ||= {}
  a.input ||= ""
  a.prompt ||= ""
  a.workers ||= []
  a.history ||= []
  a.documents = []


  const payload = {
    input: a.input,
    prompt: a.prompt,
    documents: [],
    ...a.variables,
  }


  for (let w of a.workers) {
    if (!workers[w.type]) continue

    if (w.condition && w.condition.operator && w.condition.left) {

      let result = true

      const leftMember = w.condition.left
      const rightMember = w.condition.right
      const op = w.condition.operator

      const left = payload[leftMember]
      const right = payload[rightMember] || (rightMember as RightOperands)

      if (right == "true") {
        result = !!left
      } else if (right == "false") {
        result = !left
      } else {
        if (right) {
          if (op == "!=") {
            result = left != right
          } else if (op == "=") {
            result = left == right
          } else if (op == ">") {
            result = left > right
          } else if (op == "<") {
            result = left < right
          } else if (op == ">=") {
            result = left >= right
          } else if (op == "<=") {
            result = left <= right
          } else if (op == "contains") {
            result = (left + "").includes(right)
          } else if (op == "notcontain") {
            result = !(left + "").includes(right)
          } else if (op == "startswith") {
            result = (left + "").startsWith(right)
          } else if (op == "notstartswith") {
            result = !(left + "").startsWith(right)
          } else if (op == "endswith") {
            result = (left + "").endsWith(right)
          } else if (op == "notendswith") {
            result = !(left + "").endsWith(right)
          } else {
            if (op == "null") {
              result = left == null
            } else if (op == "notnull") {
              result = left != null
            }
          }
        }
      }
      if (!result) continue
    }


    await workers[w.type](w, a, payload)
    if (w.end) break

  }

  return payload

}

