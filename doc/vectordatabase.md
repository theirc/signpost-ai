The vector database is a database for storing and searching vector data, using Weaviate as the underlying storage.

The access to this database is through exported object `vector` in the `/search` directory.
To save information in the database, you need to choose a domain (an unique identifier for all your data) and just call `vector.upsertArticle` function.
This is an example of how to do it:

```ts

import { vector } from './search/vector'

await vector.upsertArticle(
  "id_of_the_article",
  {
    body: "The body of the article", //supports html, markdown and plain text.
    title: "The title of the article",
    domain: "The unique domain for all your articles",
    source: "The link to the article",
    lat: 12.34, // "Optional: The latitude of the location associated with the article"
    lon: 12.34, // "Optional: The longitude of the location associated with the article"
  }
)

```


