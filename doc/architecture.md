
# Signpost AI Architecture and Configuration
The following document outlines the architecture and configuration of the AI Agents currently used in Signpost.

## Overview

This project provides the code used to run AI Agents, and it is based on a Node.js server using express to serve.
It supports several AI technologies such as OpenAI, Anthropic, and Gemini, as well as Ollama, which allows the use of any open source AI models.
It does not have external dependencies other than the services that can be used and their corresponding libraries.

## Glossary of Terms Used in the Agent Flow and Configuration

* `Agent`: The Agent represents the main configuration and contains specific settings to be used to execute workers.
* `Worker`: The Worker is a component that can be executed by the Agent. It is responsible for performing a specific task, such as generating text, searching the knowledge base, or sending a message.

## Support Objects

The system includes two objects that are used as namespaced access to several functionalities and services in a simple and consistent way.

* `ai`: The AI object provides access to the different AI technologies.
* `audio`: The Audio object provides access to the different audio technologies, such as speech-to-text and text-to-speech.

## Agent structure

The Agent is the main part of the system and it's the request that need to be sent to the server in order to get an answer.
The Agent contains the following fields:

* `title`: The title of the agent. (Optional)
* `workers`: The list of workers that the agent will execute.
* `input`: The input that will be used in the flow.
* `prompt`: The initial prompt that will be used in the flow. (Optional)
* `history`: The chat history that will be used to generate the bot's answer. (Optional)
* `audio`: The audio that will be used to generate the bot's answer. (Optional)
* `variables`: The variables that will be used to generate the bot's answer. (Optional)

## Worker structure

The Worker is a component that can be executed by the Agent. It is responsible for performing a specific task, such as generating text, searching the knowledge base, or sending a message.
The Worker contains a set of default fields, and specific workers can extend that configuration with more fields if required. The default fields are:

* `title`: The title of the worker. (Optional)
* `type`: The type of the worker. (Required)
* `input`: The input is used to instruct the worker from where it takes the data. It can be any predefined field or a custom field. (Optional)
* `output`: The output that will be used by the worker to put the generated data. It can be any predefined field or a custom field and some workers support templates. (Optional)
* `end`: If it's true, the flow will end after this worker. (Optional)
* `condition`: The condition to check before running the worker. (Optional)
* `left`: The left part of the condition. (Optional)
* `operator`: The operator of the condition. (Optional)
* `right`: The right part of the condition. (Optional)

## Worker Types

The Worker Types are:

* `ai`: The AI Worker is used to generate text.
* `schema`: The Schema Worker is used to generate data based on a schema. This worker always output to custom fields.
* `search`: The Search Worker is used to search the knowledge base. 
* `tts`: The TTS Worker is used to generate audio.
* `zendesk`: The Zendesk Worker is used to interact with the Zendesk API.
* `documentselector`: The DocumentSelector Worker is used to select documents based on a prompt.
* `stt`: The STT Worker is used to transcribe audio.
 
## Exeecution Flow

The execution of the Agent is sequential and each worker is executed one by one. An optional condition can be used to decide if a worker is exectuted or not,
and an optional `end` can be used to end the flow. In this way, it's easy to simulate a tree structure of workers.

* The execution is started with an object request with the `Agent` type, which contains the configuration along with the workers that need to be executed.
* A `payload` is generated, which is a simple JS object that will carry the information during the flow. This object contains any input data sent in the Agent.
* The code starts to iterate over the workers. On each step, any condition is checked if defined, and the worker is executed if the condition is met.
* The worker is executed, taking information from the `payload` using the `input` field. Some workers uses predefined fields, like the Document Selector (which access the documents in the payload) or the STT that uses the audio input.
* The output is then generated using the `output` field. Some workers use predefined fields, like the TTS that uses the audio field.
* Once executed, if the worker has the field `end` set to `true`, the flow ends.

Once the execution is finished, the `payload` object is returned.

Please see the code for more details of the configuration of each worker.









