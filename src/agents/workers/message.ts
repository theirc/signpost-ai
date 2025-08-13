declare global {
  interface MessageWorker extends AIWorker {
    fields: {
      content: NodeIO
      toNumber: NodeIO
      quickReplies: NodeIO
      routeId: NodeIO
      output: NodeIO
    }
    parameters: {
      integrationChannel?: string
      telerivetApiKey?: string
      telerivetProjectId?: string
      defaultToNumber?: string
      defaultQuickReplies?: string[]
      defaultRouteId?: string
      username?: string
    }
  }
}

// Constants matching the Cloudscript
const MAX_MESSAGE_LENGTH = 1024;
const MESSAGE_SPLIT_THRESHOLD = 0.8;
const MAX_QUICK_REPLY_LENGTH = 20;
const MAX_QUICK_REPLIES_PER_MESSAGE = 3;

// Helper function to clean message text (shared between environments)
function cleanMessage(text: string): string {
  text = text.replace(/\*/g, '');
  text = text.replace(/\[[^\]]*\]/g, '');
  text = text.replace(/[ ]{2,}/g, ' ');
  return text;
}

// Message splitting function matching Cloudscript exactly (shared between environments)
function splitMessageForWhatsApp(text: string, maxLength: number = MAX_MESSAGE_LENGTH): string[] {
  if (text.length <= maxLength) {
    return [text];
  }
  
  const messages: string[] = [];
  let remainingText = text;
  
  while (remainingText.length > 0) {
    let chunk = remainingText.substring(0, maxLength);
    
    if (remainingText.length > maxLength) {
      const lastSpace = chunk.lastIndexOf(' ');
      if (lastSpace > maxLength * MESSAGE_SPLIT_THRESHOLD) {
        chunk = chunk.substring(0, lastSpace);
      }
    }
    
    messages.push(chunk);
    remainingText = remainingText.substring(chunk.length).trim();
  }
  
  return messages;
}

// Extract media URLs from content (markdown image format: ![alt](url)) - shared between environments
function extractMediaUrls(content: string): { mediaUrls: string[], processedContent: string } {
  const mediaUrls: string[] = [];
  let processedContent = content;
  const imageMatches = processedContent.match(/!\[\]\((https?:\/\/[^\s)]+)\)/g);
  if (imageMatches) {
    imageMatches.forEach((match: string) => {
      const urlMatch = match.match(/!\[\]\((https?:\/\/[^\s)]+)\)/);
      if (urlMatch) {
        mediaUrls.push(urlMatch[1]);
      }
    });
    // Remove image markdown from content
    processedContent = processedContent.replace(/!\[\]\([^\)]+\)/g, "").trim();
  }
  return { mediaUrls, processedContent };
}

// Helper function to send individual Telerivet messages (shared between environments)
async function sendTelerivetMessage(
  worker: MessageWorker, 
  toNumber: string, 
  content: string, 
  routeId: string, 
  quickReplies: string[], 
  mediaUrls: string[],
  isBrowser: boolean
): Promise<any> {
  const logPrefix = `[Send Message Worker (${worker.id})]`
  
  // Prepare the message payload according to Telerivet API spec
  const messagePayload: any = {
    content: content,
    to_number: toNumber,
    message_type: "text"
  }

  // Add optional fields if provided
  if (routeId) messagePayload.route_id = routeId
  
  // Add media URLs if provided
  if (mediaUrls && mediaUrls.length > 0) {
    messagePayload.media_urls = mediaUrls;
  }
  
  // Add quick replies for WhatsApp if provided
  if (quickReplies && quickReplies.length > 0) {
    // Filter and validate quick replies like Cloudscript
    const validQuickReplies = quickReplies
      .map(text => (text || "").trim())
      .filter(text => text.length >= 1 && text.length <= MAX_QUICK_REPLY_LENGTH);
    
    if (validQuickReplies.length > 0) {
      if (validQuickReplies.length > MAX_QUICK_REPLIES_PER_MESSAGE) {
        // More than 3 options - use interactive list menu
        messagePayload.route_params = {
          whatsapp: {
            list_button: {
              text: "Choose an option",
              items: validQuickReplies.map((text, index) => ({
                id: `option_${index}`,
                title: text,
              }))
            }
          }
        }
      } else {
        // 3 or fewer options - use simple quick reply buttons
        messagePayload.route_params = {
          whatsapp: {
            quick_replies: validQuickReplies.map(text => ({ text: text }))
          }
        }
      }
    }
  }

  // Log the constructed message payload
  console.log(`${logPrefix} - Message Payload:`, messagePayload)

  // Send via Telerivet API
  const telerivetUrl = `https://api.telerivet.com/v1/projects/${worker.parameters.telerivetProjectId}/messages/send`
  console.log(`${logPrefix} - Telerivet URL:`, telerivetUrl)
  
  if (isBrowser) {
    // Use the proxy API to avoid CORS issues
    console.log(`${logPrefix} - Using proxy API for browser environment`)
    
    // Add API key to the message payload for Telerivet
    const messagePayloadWithKey = {
      ...messagePayload,
      api_key: worker.parameters.telerivetApiKey
    }
    
    const proxyPayload = {
      url: telerivetUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      data: messagePayloadWithKey,
      timeout: 10000
    }
    
    console.log(`${logPrefix} - Proxy Payload:`, proxyPayload)
    
    const proxyResponse = await fetch('/api/axiosFetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(proxyPayload)
    })
    
    console.log(`${logPrefix} - Proxy Response Status:`, proxyResponse.status, proxyResponse.statusText)
    
    if (proxyResponse.ok) {
      const proxyResult = await proxyResponse.json()
      console.log(`${logPrefix} - Proxy Result:`, proxyResult)
      
      if (proxyResult?.error) {
        throw new Error(`Proxy error: ${proxyResult.error} ${proxyResult.message || ''}`)
      } else {
        return proxyResult?.data
      }
    } else {
      const errorText = await proxyResponse.text()
      throw new Error(`Proxy service failed: ${proxyResponse.status} - ${errorText}`)
    }
  } else {
    // Backend environment - make direct call
    console.log(`${logPrefix} - Making direct API call from backend`)
    
    const messagePayloadWithKey = {
      ...messagePayload,
      api_key: worker.parameters.telerivetApiKey
    }
    
    const response = await fetch(telerivetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayloadWithKey)
    })

    if (response.ok) {
      const result = await response.json()
      return result
    } else {
      const errorText = await response.text()
      throw new Error(`Failed to send message: ${response.status} - ${errorText}`)
    }
  }
}

function create(agent: Agent) {
  return agent.initializeWorker(
    {
      type: "message",
      conditionable: true,
      parameters: {
        integrationChannel: "telerivet",
        telerivetApiKey: "",
        telerivetProjectId: "",
        defaultToNumber: "",
        defaultQuickReplies: [],
        defaultRouteId: "",
        username: "",
      },
    },
    [
      { type: "string", direction: "input", title: "Content", name: "content" },
      { type: "string", direction: "input", title: "To Number", name: "toNumber" },
      { type: "string[]", direction: "input", title: "Quick Replies", name: "quickReplies" },
      { type: "string", direction: "input", title: "Route ID", name: "routeId" },
      { type: "string", direction: "output", title: "Output", name: "output" },
    ],
    message,
  ) as MessageWorker
}

async function execute(worker: MessageWorker) {
  const logPrefix = `[Send Message Worker (${worker.id})]`
  
  // Detect environment
  const isBrowser = typeof window !== 'undefined'
  console.log(`${logPrefix} - Environment: ${isBrowser ? 'Browser' : 'Backend'}`)
  
  // Log all worker parameters
  console.log(`${logPrefix} - Worker Parameters:`, {
    integrationChannel: worker.parameters.integrationChannel || 'NOT SET',
    telerivetApiKey: worker.parameters.telerivetApiKey ? `${worker.parameters.telerivetApiKey.substring(0, 8)}...` : 'NOT SET',
    telerivetProjectId: worker.parameters.telerivetProjectId || 'NOT SET',
    defaultToNumber: worker.parameters.defaultToNumber || 'NOT SET',
    defaultQuickReplies: worker.parameters.defaultQuickReplies || [],
    defaultRouteId: worker.parameters.defaultRouteId || 'NOT SET',
    username: worker.parameters.username || 'NOT SET'
  })
  
  const content = worker.fields.content?.value as string || ""
  const toNumber = worker.fields.toNumber?.value as string || worker.parameters.defaultToNumber || ""
  const quickReplies = worker.fields.quickReplies?.value as string[] || worker.parameters.defaultQuickReplies || []
  const routeId = worker.fields.routeId?.value as string || worker.parameters.defaultRouteId || ""
  
  // Log all field values
  console.log(`${logPrefix} - Field Values:`, {
    content: content || 'NOT SET',
    toNumber: toNumber || 'NOT SET',
    quickReplies: quickReplies || [],
    routeId: routeId || 'NOT SET'
  })
  
  if (!content || !toNumber) {
    worker.fields.output.value = "Error: Content and to_number are required"
    console.error(`${logPrefix} - Validation failed: content=${!!content}, toNumber=${!!toNumber}`)
    return
  }

  // Check integration channel
  if (!worker.parameters.integrationChannel || worker.parameters.integrationChannel === '') {
    worker.fields.output.value = "Error: Integration channel is required"
    console.error(`${logPrefix} - Integration channel not set`)
    return
  }

  // Only Telerivet is implemented for now - others will be added later
  if (worker.parameters.integrationChannel !== 'telerivet') {
    worker.fields.output.value = `Error: ${worker.parameters.integrationChannel} integration is coming soon`
    console.error(`${logPrefix} - Unsupported integration channel: ${worker.parameters.integrationChannel}`)
    return
  }

  try {
    // Extract media URLs and process content (shared logic)
    const { mediaUrls, processedContent } = extractMediaUrls(content)
    
    // Handle <break> symbol splitting like Cloudscript
    const messageParts = processedContent.split('<break>');
    const hasBreak = messageParts.length > 1;
    
    // Process message parts
    if (hasBreak) {
      // Send multiple messages with breaks - match Cloudscript behavior exactly
      for (let i = 0; i < messageParts.length; i++) {
        const part = messageParts[i].trim();
        if (part) {
          const cleanPart = cleanMessage(part);
          const quickRepliesForPart = (i === messageParts.length - 1) ? quickReplies : [];
          const mediaUrlsForPart = (i === 0) ? mediaUrls : [];
          
          // Send media first if this is the first part and we have media
          if (i === 0 && mediaUrlsForPart.length > 0) {
            for (let imgIndex = 0; imgIndex < mediaUrlsForPart.length; imgIndex++) {
              await sendTelerivetMessage(worker, toNumber, "", routeId, [], [mediaUrlsForPart[imgIndex]], isBrowser);
              // Small delay between images like Cloudscript
              if (imgIndex < mediaUrlsForPart.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
          }
          
          // Send the text content (without media since we sent it separately)
          await sendTelerivetMessage(worker, toNumber, cleanPart, routeId, quickRepliesForPart, [], isBrowser);
          
          // Add delay between message parts like Cloudscript
          if (i < messageParts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      return; // Exit early since we handled the message parts
    }
    
    // Single message - handle like Cloudscript: media first, then text with quick replies
    if (mediaUrls.length > 0) {
      // Send images first
      for (let imgIndex = 0; imgIndex < mediaUrls.length; imgIndex++) {
        await sendTelerivetMessage(worker, toNumber, "", routeId, [], [mediaUrls[imgIndex]], isBrowser);
        // Small delay between images
        if (imgIndex < mediaUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    // Then send text content with quick replies - split if too long
    const cleanText = cleanMessage(processedContent);
    const textMessages = splitMessageForWhatsApp(cleanText);
    
    for (let i = 0; i < textMessages.length; i++) {
      const messageText = textMessages[i];
      const quickRepliesForMessage = (i === textMessages.length - 1) ? quickReplies : [];
      
      await sendTelerivetMessage(worker, toNumber, messageText, routeId, quickRepliesForMessage, [], isBrowser);
      
      // Add delay between split messages if not the last one
      if (i < textMessages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Set success output
    worker.fields.output.value = `Message sent successfully to ${toNumber}`
    
  } catch (error: any) {
    worker.fields.output.value = `Error sending message: ${error.message}`
    console.error(`${logPrefix} - Error in execute:`, error)
  }
}

export const message: WorkerRegistryItem = {
  title: "Send Message",
  category: "tool",
  type: "message",
  description: "Sends messages via various integration channels (Telerivet, Twilio coming soon)",
  execute,
  create,
  get registry() {
    return message
  },
}

