import { readFileSync } from 'node:fs';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import sqlite3 from 'sqlite3';

const getFiles = async () => {
    const db = new sqlite3.Database('./my-database.db', async (err: Error | null) => {

        if (err) {
            console.error(err.message);
            return;
        }

        const currentVersion = db.get('SELECT version FROM settings WHERE id = 2', (err: Error | null, row: any) => {
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
            const response = await axios.get(`${process.env.IRC_BASE_URL}/api/files`, {
                headers: {
                    Authorization: `Bearer ${process.env.IRC_API_TOKEN}`
                },
            });
            const files = response.data.data;
            if (currentVersion < response.data.version) {
                forEach(files, async (file: any) => {
                    await uploadFile(file);
                })
                db.run('UPDATE settings SET version = ?', [response.data.version]);
            }
        } catch (error) {
            return error;
        }
    });

};

const uploadFile = async (file: any) => {
    try {
        const fileData = await getFileBuffer(file.url);
        let data = new FormData();
        data.append('file', fileData.toString('base64'), file.key);

        let config = {
            method: 'post',
            url: process.env.DIRECTUS + '/files',
            headers: {
                'Authorization': 'Bearer ' + process.env.DIRECTUS_AUTH
            },
            data: data
        };

        axios.request(config)
            .then((response) => {
                console.log('File uploaded successfully:', response.data);
            })
            .catch((error) => {
                console.log(error);
            });


    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
};


async function getFileBuffer(url: string) {
    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'arraybuffer'
        });
        const buffer = Buffer.from(response.data, 'binary');
        return buffer;
    } catch (error) {
        console.error('Error fetching the file:', error);
        throw error;
    }
}

export { getFiles };

function forEach(files: any, arg1: (file: any) => Promise<void>) {
    throw new Error('Function not implemented.');
}
