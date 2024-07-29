
export interface RouterSchema {

  //Determine if the input is primarily about communication channels (such as email, phone, messaging apps, social media, etc.) or methods of contact between individuals or groups. If the question is related to communication channels or contact, this value should be true.
  isContact?: boolean

  //based on the input, extract the minimal search terms that will be used to search the knowledge base
  searchTerms?: string

  //based on the input, try to infer the location, like country, city, or any other geographic information you can extract
  location?: string

  //based on the input, try to infer the language of the input
  language?: string

}


export const routerSchema =
  `
export interface RouterSchema {

  //Determine if the input is primarily about communication channels (such as email, phone, messaging apps, social media, etc.) or methods of contact between individuals or groups. If the question is related to communication channels or contact, this value should be true.
  isContact?: boolean

  //based on the input, extract the minimal search terms that will be used to search the knowledge base
  searchTerms?: string

  //based on the input, try to infer the location, like country, city, or any other geographic information you can extract
  location?: string

  //based on the input, try to infer the language of the input
  language?: string

}

`

