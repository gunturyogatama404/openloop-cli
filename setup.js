import { banner } from './utils/banner.js';
import { logger } from './utils/logger.js';
import fetch from 'node-fetch';
import readline from 'readline';
import fs from 'fs';

// Membaca konfigurasi dari file config.json
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const askQuestion = (query) => {
    return new Promise((resolve) => rl.question(query, resolve));
};

// Fungsi untuk auto-generate email dengan domain dari config.json
const generateEmail = () => {
    const randomDomain = config.domains[Math.floor(Math.random() * config.domains.length)];
    const randomString = Math.random().toString(36).substring(2, 12); // 10 karakter random
    return `${randomString}${randomDomain}`;
};

const loginUser = async (email, password) => {
    try {
        const loginPayload = { username: email, password };
        const loginResponse = await fetch('https://api.openloop.so/users/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(loginPayload),
        });

        if (!loginResponse.ok) {
            throw new Error(`Login failed! Status: ${loginResponse.status}`);
        }

        const loginData = await loginResponse.json();
        const accessToken = loginData.data.accessToken;
        logger('Login successful get Token:', 'success', accessToken);

        fs.appendFileSync('token.txt', accessToken + '\n', 'utf8');
        logger('Access token saved to token.txt');
    } catch (error) {
        logger('Error during login:', 'error', error.message);
    }
};

const registerUser = async () => {
    try {
        const generatedEmail = generateEmail(); // Auto-generate email
        logger(`Generated email: ${generatedEmail}`, 'info');

        const password = config.password || await askQuestion('Enter your password: '); // Menggunakan password dari config
        const inviteCode = config.inviteCode || await askQuestion('Enter your invite code: '); // Menggunakan inviteCode dari config

        const registrationPayload = {
            name: generatedEmail,
            username: generatedEmail,
            password,
            inviteCode,
        };

        const registerResponse = await fetch('https://api.openloop.so/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(registrationPayload),
        });

        if (registerResponse.status === 401) {
            logger('Email already exists. Attempting to login...');
            await loginUser(generatedEmail, password);
            return;
        }

        if (!registerResponse.ok) {
            throw new Error(`Registration failed! Status: ${registerResponse.status}`);
        }

        const registerData = await registerResponse.json();
        logger('Registration successful:', 'success', registerData.message);

        await loginUser(generatedEmail, password);
    } catch (error) {
        logger('Error during registration:', 'error', error.message);
    }
};

const main = async () => {
    try {
        const accountCount = parseInt(await askQuestion('How many accounts do you want to create? '), 10);

        if (isNaN(accountCount) || accountCount <= 0) {
            logger('Invalid input. Please enter a valid number.', 'error');
            rl.close();
            return;
        }

        for (let i = 0; i < accountCount; i++) {
            logger(`Creating account ${i + 1} of ${accountCount}...`, 'info');
            await registerUser();
        }

        logger('Account creation process completed!', 'success');
    } catch (error) {
        logger('An error occurred during the process:', 'error', error.message);
    } finally {
        rl.close();
    }
};

main();
