declare global {
  interface MessageWorker extends AIWorker {
    fields: {
      content: NodeIO
      toNumber: NodeIO
      quickReplies: NodeIO
      routeId: NodeIO
      fileAttachment: NodeIO
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

// Helper function to detect if input is a URL
function isUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Helper function to upload file attachment to temporary Supabase storage and get signed URL
async function uploadFileAttachmentTemporarily(fileData: any): Promise<string | null> {
  if (!fileData || !fileData.buffer) {
    return null;
  }

  try {
    const { buffer, mimeType, filename } = fileData;
    
    // Import supabase (dynamic import to handle different environments)
    const { supabase } = await import('../db');
    
    // Create a unique filename for temporary storage
    const tempFileName = `temp-attachments/${Date.now()}-${Math.random().toString(36).substring(7)}-${filename}`;
    
    // Convert buffer to File/Blob for upload
    const fileBlob = new Blob([buffer], { type: mimeType });
    
    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents') // Using existing documents bucket
      .upload(tempFileName, fileBlob, {
        cacheControl: '60', // Cache for only 60 seconds
        upsert: false // Don't overwrite, each upload should be unique
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return null;
    }

    // Create signed URL that expires in 60 seconds
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(uploadData.path, 60);

    if (signedUrlError) {
      console.error('Signed URL creation error:', signedUrlError);
      return null;
    }

    console.log(`Temporary file uploaded: ${tempFileName}, expires in 60 seconds`);
    
    // Schedule cleanup after 65 seconds (5 second buffer)
    setTimeout(async () => {
      try {
        await supabase.storage.from('documents').remove([uploadData.path]);
        console.log(`Cleaned up temporary file: ${tempFileName}`);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary file:', cleanupError);
      }
    }, 65000);

    return signedUrlData.signedUrl;

  } catch (error) {
    console.error('Error uploading file attachment:', error);
    return null;
  }
}

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
      { type: "file", direction: "input", title: "File Attachment", name: "fileAttachment" },
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
  const fileAttachment = worker.fields.fileAttachment?.value || null
  
  // Log all field values with detailed file attachment info
  console.log(`${logPrefix} - Field Values:`, {
    content: content || 'NOT SET',
    toNumber: toNumber || 'NOT SET',
    quickReplies: quickReplies || [],
    routeId: routeId || 'NOT SET',
    fileAttachment: fileAttachment ? {
      type: typeof fileAttachment,
      value: fileAttachment,
      isUrl: typeof fileAttachment === 'string' ? isUrl(fileAttachment) : false,
      hasFilename: fileAttachment?.filename,
      hasBuffer: !!fileAttachment?.buffer
    } : 'NOT SET'
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
    
    // Handle file attachment if provided
    let fileAttachmentUrl: string | null = null
    if (fileAttachment) {
      console.log(`${logPrefix} - Processing file attachment:`, typeof fileAttachment, fileAttachment)
      
      // Check if the file attachment is actually a URL string (from text node)
      if (typeof fileAttachment === 'string') {
        if (isUrl(fileAttachment)) {
          console.log(`${logPrefix} - File attachment is a URL string, using directly`)
          fileAttachmentUrl = fileAttachment
        } else {
          console.log(`${logPrefix} - File attachment is a string but not a URL:`, fileAttachment)
          worker.fields.output.value = "Error: File attachment is a string but not a valid URL"
          return
        }
      } else if (fileAttachment && typeof fileAttachment === 'object' && fileAttachment.buffer) {
        // It's actual file data, upload it
        console.log(`${logPrefix} - File attachment is file data, uploading...`)
        fileAttachmentUrl = await uploadFileAttachmentTemporarily(fileAttachment)
        if (!fileAttachmentUrl) {
          worker.fields.output.value = "Error: Failed to upload file attachment to temporary storage"
          console.error(`${logPrefix} - File attachment upload failed`)
          return
        }
        console.log(`${logPrefix} - File attachment uploaded to temporary URL (expires in 60s)`)
      } else {
        worker.fields.output.value = "Error: Invalid file attachment format"
        console.error(`${logPrefix} - Invalid file attachment format:`, fileAttachment)
        return
      }
    }
    
    // Combine media URLs from markdown images and file attachment
    const allMediaUrls = [...mediaUrls]
    if (fileAttachmentUrl) {
      allMediaUrls.push(fileAttachmentUrl)
    }
    
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
          const mediaUrlsForPart = (i === 0) ? allMediaUrls : [];
          
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
           const apiResponse = await sendTelerivetMessage(worker, toNumber, cleanPart, routeId, quickRepliesForPart, [], isBrowser);
           
           // Add delay between message parts like Cloudscript
           if (i < messageParts.length - 1) {
             await new Promise(resolve => setTimeout(resolve, 500));
           }
         }
       }
       
       // Set output based on actual results
       worker.fields.output.value = `All message parts sent successfully to ${toNumber}`
       return; // Exit early since we handled the message parts
    }
    
    // Single message - handle like Cloudscript: media first, then text with quick replies
    if (allMediaUrls.length > 0) {
      // Send images first
      for (let imgIndex = 0; imgIndex < allMediaUrls.length; imgIndex++) {
        await sendTelerivetMessage(worker, toNumber, "", routeId, [], [allMediaUrls[imgIndex]], isBrowser);
        // Small delay between images
        if (imgIndex < allMediaUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
         // Then send text content with quick replies - split if too long
     const cleanText = cleanMessage(processedContent);
     const textMessages = splitMessageForWhatsApp(cleanText);
     
     let lastApiResponse: any = null;
     
     for (let i = 0; i < textMessages.length; i++) {
       const messageText = textMessages[i];
       const quickRepliesForMessage = (i === textMessages.length - 1) ? quickReplies : [];
       
       const apiResponse = await sendTelerivetMessage(worker, toNumber, messageText, routeId, quickRepliesForMessage, [], isBrowser);
       if (apiResponse) lastApiResponse = apiResponse;
       
       // Add delay between split messages if not the last one
       if (i < textMessages.length - 1) {
         await new Promise(resolve => setTimeout(resolve, 500));
       }
     }
     
     // Set success output with actual API results
     if (lastApiResponse) {
       worker.fields.output.value = `Message sent successfully to ${toNumber}. API Response: ${JSON.stringify(lastApiResponse)}`
     } else {
       worker.fields.output.value = `Message sent successfully to ${toNumber}`
     }
    
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

