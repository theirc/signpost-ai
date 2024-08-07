import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: 'https://directus-qa.azurewebsites.net/graphql?access_token=rESssAZ6iU0uYxdnTTwCSJqzuzhxF1TP',
  generates: {
    'apollo-helpers.ts': {
      plugins: ['typescript-apollo-client-helpers']
    }
  }
}
export default config