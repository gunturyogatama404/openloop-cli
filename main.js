import fetch from 'node-fetch';  // Ensure using node-fetch version 3+
import fs from 'fs';
import chalk from 'chalk';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { logger } from './utils/logger.js';  // Ensure logger is set up

// Function to shuffle the array (Fisher-Yates Shuffle)
const shuffleArray = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]; // Swap elements
    }
};

const getRandomQuality = () => {
    return Math.floor(Math.random() * (99 - 60 + 1)) + 60;
};

const getProxies = () => {
    const proxies = fs.readFileSync('proxy.txt', 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    return proxies.map(proxy => {
        if (proxy.includes('://')) {
            return proxy;
        } else {
            return `http://${proxy}`;  // Add default protocol if missing
        }
    });
};

const getTokens = () => {
    return fs.readFileSync('token.txt', 'utf8').split('\n').map(line => line.trim()).filter(Boolean);
};

const shareBandwidth = async (token, proxy, proxies) => {
    const quality = getRandomQuality();
    const proxyAgent = new HttpsProxyAgent(proxy);
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await fetch('https://api.openloop.so/bandwidth/share', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ quality }),  // Ensure the body is properly stringified
                agent: proxyAgent,  // Send the proxy agent
            });

            if (!response.ok) {
                throw new Error(`Failed to share bandwidth! Status: ${response.statusText}`);
            }

            const data = await response.json();

            const logBandwidthShareResponse = (response) => {
                if (response && response.data && response.data.balances) {
                    const balance = response.data.balances.POINT;
                    logger(
                        `Bandwidth : ${chalk.yellow(response.message)} | Proxy: ${chalk.green(proxy)} | Score: ${chalk.yellow(quality)} | Total Earnings: ${chalk.yellow(balance)}`
                        );
                }
            };

            logBandwidthShareResponse(data);
            return; // Exit if successful
        } catch (error) {
            attempt++;
            if (attempt >= maxRetries) {
                const index = proxies.indexOf(proxy);
                if (index > -1) {
                    proxies.splice(index, 1);  // Remove proxy from list
                }
                return;
            } else {
                await new Promise((resolve) => setTimeout(resolve, 1000));  // Retry after 1 second
            }
        }
    }
};

const shareBandwidthForAllTokens = async () => {
    const tokens = getTokens();
    let proxies = getProxies();  // Use proxies in a variable to modify

    // Ensure enough proxies for the number of tokens
    if (tokens.length > proxies.length) {
        logger(`Not enough proxies for the number of tokens. Please add more proxies.`, 'error');
        return;
    }

    // Shuffle proxies
    shuffleArray(proxies);

    const tasks = tokens.map((token, index) => {
        if (index < proxies.length) {
            const proxy = proxies[index];
            return shareBandwidth(token, proxy, proxies);  // Pass proxy and proxies list into the function
        }
    });

    try {
        // Wait for all tasks to finish
        await Promise.all(tasks);
    } catch (error) {
        logger(`Error while sharing bandwidth: ${error.message}`, 'error');
    }
};

const main = () => {
    logger('Starting bandwidth sharing for all tokens concurrently...');
    shareBandwidthForAllTokens();  // Share bandwidth for all tokens
};

main();
