/**
 * Schema Templates
 * Pre-built extraction schemas for common analysis patterns.
 * Isomorphic
 */

import type { ExtractionField } from './types'

export const schemaTemplates: Record<
  string,
  {
    name: string
    description: string
    category: 'support' | 'survey' | 'feedback' | 'custom'
    storage_target: 'contact' | 'message'
    fields: Partial<ExtractionField>[]
  }
> = {
  'customer-satisfaction': {
    name: 'Customer Satisfaction Analysis',
    description: 'Extract satisfaction levels, sentiment, and feedback from support conversations',
    category: 'support',
    storage_target: 'contact',
    fields: [
      {
        name: 'Satisfaction Level',
        variable_name: 'satisfaction_level',
        description: 'Overall customer satisfaction (1-5)',
        extraction_method: { type: 'ai', ai_prompt: 'Based on the conversation, rate the customer satisfaction level from 1 (very dissatisfied) to 5 (very satisfied). Return only the number.', ai_model: 'openai/gpt-4.1-nano' },
        required: false,
        data_type: 'number',
      },
      {
        name: 'Customer Sentiment',
        variable_name: 'customer_sentiment',
        description: 'Overall sentiment of the customer',
        extraction_method: { type: 'ai', ai_prompt: "Classify the customer's overall sentiment as: positive, neutral, or negative. Return only one word.", ai_model: 'openai/gpt-4.1-nano' },
        required: false,
        data_type: 'string',
      },
      {
        name: 'Main Issue',
        variable_name: 'main_issue',
        description: 'The primary issue or topic discussed',
        extraction_method: { type: 'ai', ai_prompt: 'What was the main issue or topic the customer brought up? Summarize in 5-10 words.', ai_model: 'openai/gpt-4.1-nano' },
        required: false,
        data_type: 'string',
      },
      {
        name: 'Resolution Status',
        variable_name: 'resolution_status',
        description: 'Whether the issue was resolved',
        extraction_method: { type: 'ai', ai_prompt: "Was the customer's issue resolved? Return: resolved, partially_resolved, or unresolved.", ai_model: 'openai/gpt-4.1-nano' },
        required: false,
        data_type: 'string',
      },
    ],
  },

  'urgency-detection': {
    name: 'Urgency & Priority Detection',
    description: 'Identify urgent requests and priority levels in conversations',
    category: 'support',
    storage_target: 'contact',
    fields: [
      {
        name: 'Is Urgent',
        variable_name: 'is_urgent',
        description: 'Whether the conversation contains urgent language',
        extraction_method: { type: 'keyword', keywords: ['urgent', 'emergency', 'asap', 'immediately', 'critical', 'help now'], keyword_match: 'any', case_sensitive: false },
        required: false,
        data_type: 'boolean',
      },
      {
        name: 'Priority Level',
        variable_name: 'priority_level',
        description: 'Priority classification based on content',
        extraction_method: { type: 'ai', ai_prompt: 'Classify the priority level as: high, medium, or low. Consider urgency, impact, and customer tone.', ai_model: 'openai/gpt-4.1-nano' },
        required: false,
        data_type: 'string',
      },
      {
        name: 'Deadline Mentioned',
        variable_name: 'deadline_mentioned',
        description: 'Any deadline or time constraint mentioned',
        extraction_method: { type: 'ai', ai_prompt: 'Did the customer mention any deadline or time constraint? If yes, extract it. If no, return null.', ai_model: 'openai/gpt-4.1-nano' },
        required: false,
        data_type: 'string',
      },
    ],
  },

  'product-feedback': {
    name: 'Product Feedback Extraction',
    description: 'Extract product mentions, feature requests, and feedback',
    category: 'feedback',
    storage_target: 'contact',
    fields: [
      {
        name: 'Products Mentioned',
        variable_name: 'products_mentioned',
        description: 'List of products or services discussed',
        extraction_method: { type: 'ai', ai_prompt: 'List all products, services, or features mentioned by the customer. Return as comma-separated values.', ai_model: 'openai/gpt-4.1-nano' },
        required: false,
        data_type: 'string',
      },
      {
        name: 'Feature Request',
        variable_name: 'feature_request',
        description: 'Any feature requests made',
        extraction_method: { type: 'ai', ai_prompt: 'Did the customer request any new features or improvements? If yes, summarize. If no, return null.', ai_model: 'openai/gpt-4.1-nano' },
        required: false,
        data_type: 'string',
      },
      {
        name: 'Positive Feedback',
        variable_name: 'positive_feedback',
        description: 'Positive comments or praise',
        extraction_method: { type: 'ai', ai_prompt: 'Extract any positive feedback, praise, or compliments. If none, return null.', ai_model: 'openai/gpt-4.1-nano' },
        required: false,
        data_type: 'string',
      },
      {
        name: 'Complaints',
        variable_name: 'complaints',
        description: 'Issues or complaints raised',
        extraction_method: { type: 'ai', ai_prompt: 'Summarize any complaints or problems raised. If none, return null.', ai_model: 'openai/gpt-4.1-nano' },
        required: false,
        data_type: 'string',
      },
    ],
  },

  'contact-info': {
    name: 'Contact Information Extraction',
    description: 'Extract emails, phone numbers, and other contact details',
    category: 'custom',
    storage_target: 'contact',
    fields: [
      {
        name: 'Email Address',
        variable_name: 'extracted_email',
        description: 'Email address mentioned in conversation',
        extraction_method: { type: 'pattern', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', pattern_flags: 'i', extraction_group: 0 },
        required: false,
        data_type: 'string',
      },
      {
        name: 'Phone Number',
        variable_name: 'extracted_phone',
        description: 'Phone number mentioned (various formats)',
        extraction_method: { type: 'pattern', pattern: '\\+?[1-9]\\d{1,14}|\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}', pattern_flags: '', extraction_group: 0 },
        required: false,
        data_type: 'string',
      },
      {
        name: 'Full Name',
        variable_name: 'customer_name',
        description: 'Customer name if mentioned',
        extraction_method: { type: 'ai', ai_prompt: 'Did the customer provide their full name? If yes, extract it. If no, return null.', ai_model: 'openai/gpt-4.1-nano' },
        required: false,
        data_type: 'string',
      },
    ],
  },

  'survey-response': {
    name: 'Survey Response Analysis',
    description: 'Extract and categorize survey responses from conversations',
    category: 'survey',
    storage_target: 'contact',
    fields: [
      {
        name: 'NPS Score',
        variable_name: 'nps_score',
        description: 'Net Promoter Score (0-10)',
        extraction_method: { type: 'ai', ai_prompt: 'If this is an NPS survey, extract the score (0-10). Otherwise return null.', ai_model: 'openai/gpt-4.1-nano' },
        required: false,
        data_type: 'number',
      },
      {
        name: 'Survey Category',
        variable_name: 'survey_category',
        description: 'Type of survey or feedback',
        extraction_method: { type: 'ai', ai_prompt: 'What type of survey is this? (e.g., satisfaction, nps, product_feedback, support_quality). Return one category.', ai_model: 'openai/gpt-4.1-nano' },
        required: false,
        data_type: 'string',
      },
      {
        name: 'Open Feedback',
        variable_name: 'open_feedback',
        description: 'Any open-ended feedback provided',
        extraction_method: { type: 'ai', ai_prompt: "Extract any open-ended feedback or comments the customer provided. Preserve their words.", ai_model: 'openai/gpt-4.1-nano' },
        required: false,
        data_type: 'string',
      },
    ],
  },
}

export function getTemplatesByCategory(category: string) {
  return Object.entries(schemaTemplates)
    .filter(([, t]) => t.category === category)
    .map(([id, t]) => ({ id, ...t }))
}

export function getAllTemplates() {
  return Object.entries(schemaTemplates).map(([id, t]) => ({ id, ...t }))
}
