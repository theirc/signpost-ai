
# Signpost AI Architecture and Configuration
The following document outlines the architecture and configuration of the AI bot currently used in Signpost.

## Overview
The infrastructure is based on four main components:

1. **MySQL Database**: Used to store the configuration of the bots.
2. **Node.js Server**: Provides HTTP support for external API REST requests, built inside a container hosted on an Azure App Service.
3. **Azure Kubernetes Service**: Hosts two containers:
    * Vector Database (Weaviate)
    * Ollama
4. **CMS (Directus)**: Used to create and maintain the configurations of the bots, also hosted as a container on an Azure App Service.

## Glossary of Terms Used in the Bot Flow and Configuration

* `Prompts`: The prompts can be set as simple text or selected from a list of prebuilt items in a collection that can be connected to a bot to generate a unique prompt.
* `Router`: Each bot has an internal AI-driven code named "router" that is used to extract information and detect several characteristics from the user's message.
* `Constitutional AI`: This is a collection of rules used by the bot after the final answer is generated and is used to censor any possible content that may be inappropriate or harmful.
* `Search Distance`: This value ranges from 0 to 1 and indicates how close the match of the vector database search is performed, from 0 (perfect match) to 1 (loose match).


## Default Configuration
In our CMS, we have a place where the user can set the default configuration, which is shared for any bot created. This configuration contains the following fields:

* `Default Prompt`: A text prompt is prepended to all the bots' prompts.
* `Default Constitutional Rules`: A list of rules prepended to all the bots' rules.
* `Default Search Distance`: The default search distance used in all the bots if no distance is set.
* `Default Maximum Results`: The default maximum results used in all the bots if no maximum result is set.
 
The default configuration is located in our CMS [here](https://directus-qa.azurewebsites.net/admin/content/botsconfig).

## Bot Configuration

To create a bot, the user needs to access the Directus CMS located [here](https://directus-qa.azurewebsites.net/admin/content/ai).

Each bot represents a minimal working unit with several options to personalize its behavior. Please note that some configurations are deprecated and may not work currently, and will be removed in the future.

The fields used to configure the bot are:

* `Title`: A descriptive name for the bot.
* `Type`: The type of knowledge base used by the bot. The available options are:
    * Zendesk: (*Deprecated*)
    * Zendesk Retriever: (*Deprecated*)
    * Services: (*Deprecated*)
    * Country: (*Deprecated*)
    * Weaviate: The vector database is used to search information.
    * Vectorless: In this mode, the bot will not search information in the vector database. (used for non RAG bots)
* `Search Distance`: The search distance used in the vector database.
* `Maximum Number of Results`: The maximum number of results returned by the vector database.
* `Zendesk Domains`: A list of possible domains to narrow the search of the Zendesk articles in the vector database.
* `Countries`: A list of possible countries to narrow the search of the Services in the vector database.
* `Solinum`: Enables the Solinum knowledge base in the vector database.
* `LLM`: The LLM provider used by the bot. The available options are: 
  * OpenAI
  * Claude
  * Gemini
  * Ollama
* `Temperature`: The temperature used by the model.
* `Model`: The model used according to the LLM provider. This field changes according to the provider selected.
* `Chat History`: Indicates that the bot should take into account the chat history.
* `System Prompt`: A list of items that will be added to the prompt.
* `Ignore Default Prompt`: Indicates that the bot should ignore the default prompt.
* `Ignore Default Constitution`: Indicates that the bot should ignore the default constitution.
* `Prompt`: A text-based prompt to be used by the bot.
* `Channels`: A list of communication channels used to send information to the user if requests contact information.
* `Constitution`: A list of rules that will be added to the constitution.
* `External Sources`: A list of external sources that will be added to the bot. (*Deprecated*)

## REST API

The current endpoint to execute the bot is located at https://directus-qa-support.azurewebsites.net/ai/

This endpoint accepts `POST` method with the following body:

```typescript
interface BotRequest {
  id?: number  // The id of the bot that will be executed.
  message?: string // The message that will be sent to the bot.
  history?: BotHistory[] // The chat history that will be used to generate the bot's answer.
}
```

The `BotHistory` type is as follows:

```typescript
type BotHistory = {
    isHuman: boolean // Indicates if the message was sent by the user or the bot.
    message: string // The message that will be sent to the bot.
}
```

Only the `id` and  `message` field is required.

If the method is executed successfully, the response will be:

```typescript
interface Answer {
  message?: string // The message that will be sent to the user.
  docs?: Doc[] // The list of documents found in the vector database's search.
  error?: string // The error message if an error occurs.
  isAnswer?: boolean // Indicates if the response is an answer.
}
```

## Bot execution process and workflow

The bot execution process and workflow is as follows:

* The user sends a message to the bot.
* The bot's configuration is fetched from the database using the `id` in the request.
* The final prompt is built using the default prompt, the list of prompts associated with the bot, and the text prompt specified in the configuration.
* The final list of constitutional rules is built using the default constitutional rules and the list of rules associated with the bot.
* The router is invoked to extract and detect the following characteristics from the user's message:
  * If the user is requesting contact information.
  * The search terms that will be used to search in the vector database.
  * Inference of the language used by the user.
  * Inference of the geographic location used by the user.

If the user is requesting contact information, the bot will respond with the list of channels specified in the bot's configuration. If not, the process is as follows:

* If the bot is not set as `vectorless` in the configuration, the vector database is searched using the extracted search terms and narrowed by the domains, services, and other knowledge bases specified in the bot's configuration.
* The search results and user's message are used to build a final prompt.
* If the `chat history` field is set in the bot's configuration and a is available in the request, the chat history is used.
* All the previous content (prompt, context, chat history) is sent to the LLM provider specified in the bot's configuration, using the model specified.
* If there are constitutional rules, the code iterates over each rule in order to modify the answer according to the instructions set in the constitutional rule.
* The final answer is returned to the user.




