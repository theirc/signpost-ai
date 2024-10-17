import { readFileSync } from 'node:fs';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const getFiles = async () => {
    try {
        const response = await axios.get(`${process.env.IRC_BASE_URL}/api/contentAI/files`, {
            headers: {
                Authorization: `Bearer ${process.env.IRC_API_TOKEN}`,
            },
        });
        response.data.data.forEach(async (file: any) => {
            await uploadFile(file);
        });
    } catch (error) {
        console.error('Error fetching files:', error);
        throw error;
    }
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