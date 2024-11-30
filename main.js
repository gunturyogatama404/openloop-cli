import fetch from 'node-fetch';
import fs from 'fs';
import chalk from 'chalk';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { banner } from './utils/banner.js';
import { logger } from './utils/logger.js';

const getRandomQuality = () => {
    return Math.floor(Math.random() * (99 - 60 + 1)) + 60;
};

const getProxies = () => {
    return fs.readFileSync('proxy.txt', 'utf8').split('\n').map(line => line.trim()).filter(Boolean);
};

const getTokens = () => {
    return fs.readFileSync('token.txt', 'utf8').split('\n').map(line => line.trim()).filter(Boolean);
};

const shareBandwidth = async (token, proxy, proxies, index) => {
    try {
        const quality = getRandomQuality();
        const proxyAgent = new HttpsProxyAgent(proxy);

        // Log only the index (serial number) of the token being processed
        // logger(`Starting bandwidth share for token #${chalk.green(index + 1)} with proxy: ${chalk.cyan(proxy)}`, 'debug');

        const response = await fetch('https://api.openloop.so/bandwidth/share', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ quality }),
            agent: proxyAgent,  
        });

        if (!response.ok) {
            throw new Error(`Failed to share bandwidth! Status: ${response.statusText}`);
        }

        const data = await response.json();

        const logBandwidthShareResponse = (response) => {
            if (response && response.data && response.data.balances) {
                const balance = response.data.balances.POINT;
                logger(`Token #${chalk.green(index + 1)} - ${chalk.yellow(response.message)} | Score: ${chalk.yellow(quality)} | Total Earnings: ${chalk.yellow(balance)}`, 'info');
            }
        };

        logBandwidthShareResponse(data);
    } catch (error) {
        logger(`Error sharing bandwidth for token #${chalk.green(index + 1)} with proxy: ${chalk.cyan(proxy)}`, 'error', error.message);
        
        // If proxy fails, remove it from the list
        const index = proxies.indexOf(proxy);
        if (index > -1) {
            proxies.splice(index, 1); // Remove the failed proxy
        }
    }
};

const shareBandwidthForAllTokens = async () => {
    let tokens = getTokens();
    let proxies = getProxies();

    // Shuffle proxies to randomize the pairing
    let shuffledProxies = proxies.sort(() => Math.random() - 0.5);

    // Use Promise.all to run tasks concurrently
    const tasks = tokens.map((token, index) => {
        const proxy = shuffledProxies[index % shuffledProxies.length]; // Reuse proxies if more tokens than proxies
        return shareBandwidth(token, proxy, shuffledProxies, index);
    });

    try {
        // Wait for all promises to resolve
        await Promise.all(tasks);
    } catch (error) {
        logger('Error in sharing bandwidth for some tokens!', 'error', error.message);
    }
};

const main = () => {
    logger(banner, 'debug');
    logger('Starting bandwidth sharing each minute...');
    shareBandwidthForAllTokens(); 
    setInterval(shareBandwidthForAllTokens, 60 * 1000); 
};

main();
