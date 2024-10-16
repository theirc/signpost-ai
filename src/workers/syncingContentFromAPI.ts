import axios from 'axios';
import { vector } from '../search/vector'
import { json } from 'stream/consumers';

const getContent = async () => {
    try {
        const response = await axios.get(`${process.env.IRC_BASE_URL}/api/contentAI`, {
            headers: {
                Authorization: `Bearer ${process.env.IRC_API_TOKEN}`,
            },
        });

        await vector.deleteCollections();
        await vector.createCollection();
        response.data.data.forEach(async (article: any) => {
            const title = article.title as string;
            if (!title) return;
            if (article.engines.length > 0) {
                article.engines.forEach(async (engine: any) => {
                    await vector.upsertArticle(
                        article.id + '_' + engine.id,
                        {
                            body: JSON.stringify(engine),
                            title: article.title + ' ' + engine.title,
                            domain: "ahlan-simsim",
                            source: engine.source_reference_external.length > 0 ? engine.source_reference_external[0] : '',
                            lat: 0,
                            lon: 0
                        }
                    )
                    console.log(`Upserted article ${article.id} with engine ${engine.id}`)
                })
            }
        })
    } catch (error) {
        console.error('Error fetching files:', error);
        throw error;
    }
};


export { getContent };