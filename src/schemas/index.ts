import { createJsonTranslator, createLanguageModel, } from "typechat"
import { createTypeScriptJsonValidator } from "typechat/ts"

const model = createLanguageModel({
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
})


async function create<T extends Object>(question: string, schema: string, schemaName: string): Promise<T> {

  const validator = createTypeScriptJsonValidator<T>(schema, schemaName)
  const translator = createJsonTranslator<T>(model, validator)

  const routeresponse = await translator.translate(question)
  if (routeresponse.success) return routeresponse.data
  return null


}

export const schemas = {
  create
}