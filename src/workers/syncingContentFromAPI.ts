import axios from 'axios';
import { vector } from '../search/vector'
import { json } from 'stream/consumers';
import sqlite3 from 'sqlite3';

const getContent = async () => {
    const db = new sqlite3.Database('./my-database.db', async (err: Error | null) => {
        if (err) {
            console.error(err.message);
            return;
        }

        const currentVersion = db.get('SELECT version FROM settings', (err: Error | null, row: any) => {
            if (err) {
                console.error(err.message);
                return;
            }
            if (!row) {
                console.log('No row found');
                return;
            }
            console.log(`Current version: ${row.version}`);
            return row.version;
        }) as unknown as Promise<number> || 0;

        try {
            const response = await axios.get(`${process.env.IRC_BASE_URL}/api/contentAI`, {
                headers: {
                    Authorization: `Bearer ${process.env.IRC_API_TOKEN}`,
                },
            });

            if (currentVersion < response.data.version) {
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
            }

        } catch (error) {
            console.error('Error fetching files:', error);
            throw error;
        }
    });
};


export { getContent };