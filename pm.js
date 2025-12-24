window.orderData = {
    cart: [],
    total: 0,
    currentCurrency: 'btc',
    paymentTimer: null,
    timeLeft: 15 * 60,
    currencies: {
        btc: 40000,
        eth: 2000,
        usdt: 1
    },
    walletConnected: false,
    currentAccount: null,
    priceUpdateInterval: null,
    timestamp: Date.now()
};

document.addEventListener('DOMContentLoaded', function () {
    if (typeof Web3 === 'undefined') {
        console.error('Web3 library not loaded');
        showToastMessage('Error loading payment system');
        return;
    }

    window.web3 = new Web3(Web3.givenProvider || 'ws://localhost:8545');

    const cartData = loadCartData();
    window.orderData.cart = cartData;
    updateOrderSummary();

    renderOrderItems();

    updateCryptoPrices();
    window.orderData.priceUpdateInterval = setInterval(updateCryptoPrices, 60000);

    generateAllQRCodes();

    setupEventListeners();

    startPaymentTimer();

    startIncomingPaymentWatcher();

    checkWalletConnection();
});

function updateOrderSummary() {
    const subtotal = window.orderData.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = subtotal < 50 ? 5 : 0;
    window.orderData.total = subtotal + shipping;

    document.getElementById('order-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('order-shipping').textContent = `$${shipping.toFixed(2)}`;
    document.getElementById('order-total').textContent = `Total: $${window.orderData.total.toFixed(2)}`;
}

async function updateCryptoPrices() {
    try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd&_=${Date.now()}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.bitcoin || !data.ethereum || !data.tether) {
            console.error('API returned incomplete data:', data);
            showToastMessage('Received incomplete price data. Please try again later.');
            return;
        }

        window.orderData.currencies.btc = data.bitcoin.usd;
        window.orderData.currencies.eth = data.ethereum.usd;
        window.orderData.currencies.usdt = data.tether.usd;

        console.log('Updated rates:', {
            btc: window.orderData.currencies.btc,
            eth: window.orderData.currencies.eth,
            usdt: window.orderData.currencies.usdt
        });

        document.getElementById('btc-rate').textContent = `$${data.bitcoin.usd.toLocaleString()}`;
        document.getElementById('eth-rate').textContent = `$${data.ethereum.usd.toLocaleString()}`;
        document.getElementById('usdt-rate').textContent = `$${data.tether.usd.toLocaleString()}`;

        const now = new Date();
        document.getElementById('rate-update-time').textContent =
            `Rates updated: ${now.toLocaleTimeString()}`;


        updateCryptoAmounts();

        generateAllQRCodes();

        showToastMessage('Rates have been updated successfully!');

    } catch (error) {
        console.error('Error updating rates:', error);
        showToastMessage('Failed to update rates. Using last known values.');
    }
}

function loadCartData() {
    try {
        const sessionCart = sessionStorage.getItem('checkoutCart');
        if (sessionCart) return JSON.parse(sessionCart);

        const localCart = localStorage.getItem('cart');
        if (localCart) return JSON.parse(localCart);

        const urlParams = new URLSearchParams(window.location.search);
        const cartParam = urlParams.get('cart');
        if (cartParam) return JSON.parse(decodeURIComponent(cartParam));

        return [];
    } catch (e) {
        console.error('Error loading cart data:', e);
        return [];
    }
}

function renderOrderItems() {
    const container = document.getElementById('order-items');
    container.innerHTML = '';

    if (window.orderData.cart.length === 0) {
        container.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
        return;
    }

    window.orderData.cart.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'order-item';

        let imageUrl = item.image || 'placeholder.jpg';
        if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
            imageUrl = `/src/images/${imageUrl}`;
        }

        itemElement.innerHTML = `
                    <img src="${imageUrl}" alt="${item.name}" 
                         onerror="this.src='/src/images/placeholder.jpg'">
                    <div>
                        <h3>${item.name}</h3>
                        ${item.size ? `<p>Size: ${item.size}</p>` : ''}
                        ${item.color ? `<p>Color: ${item.color}</p>` : ''}
                        <p>${item.quantity} × $${item.price.toFixed(2)}</p>
                    </div>
                `;
        container.appendChild(itemElement);
    });
}

function updateCryptoAmounts() {

    const btcRate = window.orderData.currencies.btc || 40000;
    const ethRate = window.orderData.currencies.eth || 2000;
    const usdtRate = window.orderData.currencies.usdt || 1;

    const btcAmount = window.orderData.total / btcRate;
    const ethAmount = window.orderData.total / ethRate;
    const usdtAmount = window.orderData.total / usdtRate;

    const btcAmountElement = document.getElementById('btc-amount');
    const ethAmountElement = document.getElementById('eth-amount');
    const usdtAmountElement = document.getElementById('usdt-amount');
    const timeUpdateElement = document.getElementById('rate-update-time');

    if (btcAmountElement) {
        btcAmountElement.textContent = `${btcAmount < 0.0001 ? btcAmount.toFixed(10) : btcAmount.toFixed(8)} BTC ≈ $${window.orderData.total.toFixed(2)}`;
    } else {
        console.warn('Element btc-amount not found in DOM');
    }

    if (ethAmountElement) {
        ethAmountElement.textContent = `${ethAmount < 0.001 ? ethAmount.toFixed(8) : ethAmount.toFixed(6)} ETH ≈ $${window.orderData.total.toFixed(2)}`;
    } else {
        console.warn('Element eth-amount not found in DOM');
    }

    if (usdtAmountElement) {
        usdtAmountElement.textContent = `${usdtAmount.toFixed(2)} USDT ≈ $${window.orderData.total.toFixed(2)}`;
    } else {
        console.warn('Element usdt-amount not found in DOM');
    }

    const now = new Date();
    if (timeUpdateElement) {
        timeUpdateElement.textContent = `Rates updated: ${now.toLocaleTimeString()}`;
    } else {
        console.warn('Element rate-update-time not found in DOM');
    }

}

function generateAllQRCodes() {
    try {
        const btcAmount = window.orderData.total / window.orderData.currencies.btc;
        generateQRCode('btc-qr', `bitcoin:${document.getElementById('btc-address').textContent}?amount=${btcAmount < 0.0001 ? btcAmount.toFixed(10) : btcAmount.toFixed(8)}`);

        if (typeof web3 !== 'undefined') {
            const ethAmount = window.orderData.total / window.orderData.currencies.eth;
            generateQRCode('eth-qr', `ethereum:${document.getElementById('eth-address').textContent}?value=${web3.utils.toWei(ethAmount.toString(), 'ether')}`);
        } else {
            generateQRCode('eth-qr', `ethereum:${document.getElementById('eth-address').textContent}`);
        }

        updateUSDTQRCode();
    } catch (e) {
        console.error('Error generating QR codes:', e);
    }
}

function updateUSDTQRCode() {
    try {
        const network = document.getElementById('usdt-network').value;
        const address = document.getElementById('usdt-address').textContent;
        const qrContainer = document.getElementById('usdt-qr');

        qrContainer.innerHTML = '';
        qrContainer.style.backgroundColor = '#f8f8f8';

        if (network === 'erc20') {
            const amount = window.orderData.total / window.orderData.currencies.usdt;
            const uri = `ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7/transfer?address=${address}&uint256=${(amount * 1e6).toFixed(0)}`;
            generateQRCode('usdt-qr', uri);
        } else {
            generateQRCode('usdt-qr', address);
        }

        document.getElementById('usdt-address').textContent = address;
        document.getElementById('usdt-status').style.display = 'block';
    } catch (e) {
        console.error('Error updating USDT QR code:', e);
        document.getElementById('usdt-qr').innerHTML = '<p>Error generating QR code</p>';
    }
}

function setupEventListeners() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .spinner {
            animation: spin 1s linear infinite;
            width: 16px;
            height: 16px;
            margin-right: 8px;
            vertical-align: middle;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(styleElement);
    document.querySelectorAll('.crypto-method').forEach(method => {
        method.addEventListener('click', function () {
            document.querySelector('.crypto-method.selected').classList.remove('selected');
            this.classList.add('selected');
            window.orderData.currentCurrency = this.dataset.currency;

            document.querySelector('.crypto-details.active').classList.remove('active');
            document.getElementById(window.orderData.currentCurrency + '-details').classList.add('active');

            document.querySelectorAll('.payment-status').forEach(el => el.style.display = 'none');
            document.getElementById(window.orderData.currentCurrency + '-status').style.display = 'block';
        });
    });

    document.getElementById('usdt-network').addEventListener('change', function () {
        const network = this.value;
        let infoText = '';
        let address = '';

        switch (network) {
            case 'erc20':
                infoText = 'Network fee: ~$1-5. Confirmation: 2-5 minutes.';
                address = '0x2525f55Fb0708582E05620BAEB44eDFfB76b779f';
                break;
            case 'trc20':
                infoText = 'Network fee: ~$1. Confirmation: 1-3 minutes.';
                address = 'TBy5XCn9AkqLToUPWmok7QMSKmdCwqQ2t7';
                break;
            case 'bep20':
            case 'avax':
            case 'arbitrum':
            case 'optimism':
            case 'polygon':
                infoText = `Network fee: ~${getNetworkFee(network)}. Confirmation: 2-5 minutes.`;
                address = '0x2525f55Fb0708582E05620BAEB44eDFfB76b779f';
                break;
            default:
                infoText = 'Network fee: ~$0.5-5. Confirmation: 1-5 minutes.';
                address = '0x2525f55Fb0708582E05620BAEB44eDFfB76b779f';
        }

        document.getElementById('usdt-network-info').textContent = infoText;
        document.getElementById('usdt-address').textContent = address;
        updateUSDTQRCode();
    });

    function getNetworkFee(network) {
        const fees = {
            bep20: '0.5-2',
            avax: '0.3-1',
            arbitrum: '0.1-0.5',
            optimism: '0.1-0.3',
            polygon: '0.01-0.1'
        };
        return fees[network] || '0.5-5';
    }

    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const targetId = this.getAttribute('data-target');
            const textToCopy = document.getElementById(targetId).textContent;
            navigator.clipboard.writeText(textToCopy).then(() => {
                this.textContent = 'Copied!';
                setTimeout(() => this.textContent = 'Copy address', 2000);
            }).catch(e => {
                console.error('Copy failed:', e);
                this.textContent = 'Error copying';
            });
        });
    });

    document.getElementById('wallet-connect-btc').addEventListener('click', async function () {
        window.orderData.currentCurrency = 'btc';
        await connectWallet();
    });

    document.getElementById('wallet-connect-eth').addEventListener('click', async function () {
        window.orderData.currentCurrency = 'eth';
        await connectWallet();
    });

    document.getElementById('wallet-connect-usdt').addEventListener('click', async function () {
        window.orderData.currentCurrency = 'usdt';
        await connectWallet();
    });

    document.getElementById('pay-with-btc').addEventListener('click', () => initiateBTCPayment());
    document.getElementById('pay-with-eth').addEventListener('click', () => initiateETHPayment());
    document.getElementById('pay-with-usdt').addEventListener('click', () => initiateUSDTPayment());

    document.querySelectorAll('.wallet-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
            const currency = this.id.split('-')[2];
            window.orderData.currentCurrency = currency;

            const connected = await connectWallet();
            if (connected) {
                updateWalletButtons();
            }
        });
    });

    document.getElementById('refresh-rates').addEventListener('click', async function () {
        const button = this;
        const originalContent = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `
            <svg class="spinner" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2" stroke-opacity="0.3"/>
                <path d="M12 2C6.48 2 2 6.48 2 12" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Refreshing...
        `;

        showToastMessage('Refreshing rates...');

        try {
            await updateCryptoPrices();
        } catch (error) {
            console.error('Error updating rates:', error);
            showToastMessage('Error updating rates');
        } finally {
            setTimeout(() => {
                button.disabled = false;
                button.innerHTML = originalContent;
            }, 1000);
        }
    });
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        window.orderData.walletConnected = false;
        window.orderData.currentAccount = null;
        showToastMessage('Wallet disconnected');
    } else {
        window.orderData.walletConnected = true;
        window.orderData.currentAccount = accounts[0];
        showToastMessage('Account changed: ' + shortenAddress(accounts[0]));
    }
    updateWalletButtons();
}

function handleChainChanged(chainId) {

    setTimeout(async () => {
        try {
            const accounts = await ethereum.request({ method: 'eth_accounts' });
            window.orderData.walletConnected = accounts.length > 0;
            window.orderData.currentAccount = accounts.length > 0 ? accounts[0] : null;

            updateWalletButtons();

            const networks = {
                '0x1': 'Ethereum',
                '0x38': 'Binance Smart Chain',
                '0x89': 'Polygon',
                '0xa86a': 'Avalanche',
                '0xa4b1': 'Arbitrum One',
                '0xa': 'Optimism'
            };

            const networkName = networks[chainId] || 'Unknown network';
            showToastMessage(`Network changed to: ${networkName}`);

        } catch (e) {
            console.error('Error checking wallet status after network change:', e);
        }
    }, 500);
}

async function connectWallet() {
    try {
        const btn = document.getElementById(`wallet-connect-${window.orderData.currentCurrency}`);
        if (btn) btn.classList.add('loading');

        if (!window.ethereum) {
            showToastMessage('Please install MetaMask to connect');
            window.open('https://metamask.io/download/', '_blank');
            return false;
        }

        const accounts = await ethereum.request({
            method: 'eth_requestAccounts'
        }).catch(error => {
            if (error.code === 4001) {
                showToastMessage('Connection request denied');
            }
            return [];
        });

        if (accounts.length === 0) return false;

        const chainId = await ethereum.request({ method: 'eth_chainId' });
        const supportedChains = ['0x1', '0x38', '0x89'];
        if (!supportedChains.includes(chainId)) {
            showToastMessage('Please switch to a supported network');
            return false;
        }

        window.orderData.walletConnected = true;
        window.orderData.currentAccount = accounts[0];

        ethereum.on('accountsChanged', handleAccountsChanged);
        ethereum.on('chainChanged', handleChainChanged);

        updateWalletButtons();
        showToastMessage('Wallet connected: ' + shortenAddress(accounts[0]));

        return true;
    } catch (error) {
        console.error('Connection error:', error);
        showToastMessage('Error connecting: ' + error.message);
        return false;
    }
    finally {
        const btn = document.getElementById(`wallet-connect-${window.orderData.currentCurrency}`);
        if (btn) btn.classList.remove('loading');
    }
}

function updateWalletButtons() {
    const walletBtns = document.querySelectorAll('.wallet-btn');
    const payBtns = document.querySelectorAll('.pay-button');

    try {
        if (window.orderData.walletConnected && window.orderData.currentAccount) {
            walletBtns.forEach(btn => {
                btn.style.display = 'none';
                btn.textContent = 'Connect wallet';
                btn.classList.remove('loading');
            });
            payBtns.forEach(btn => {
                btn.style.display = 'block';
            });

            const walletInfoElems = document.querySelectorAll('.wallet-info');
            if (walletInfoElems) {
                walletInfoElems.forEach(elem => {
                    elem.style.display = 'block';
                    elem.textContent = 'Connected: ' + shortenAddress(window.orderData.currentAccount);
                });
            }
        } else {
            walletBtns.forEach(btn => {
                btn.style.display = 'block';
                btn.textContent = 'Connect wallet';
                btn.classList.remove('loading');
            });
            payBtns.forEach(btn => {
                btn.style.display = 'none';
            });

            const walletInfoElems = document.querySelectorAll('.wallet-info');
            if (walletInfoElems) {
                walletInfoElems.forEach(elem => {
                    elem.style.display = 'none';
                });
            }
        }
    } catch (e) {
        console.error('Button update error:', e);
    }
}

async function initiatePayment() {
    if (!window.orderData.walletConnected) {
        const connected = await connectWallet();
        if (!connected) return;
    }

    switch (window.orderData.currentCurrency) {
        case 'btc':
            await initiateBTCPayment();
            break;
        case 'eth':
            await initiateETHPayment();
            break;
        case 'usdt':
            await initiateUSDTPayment();
            break;
        default:
            showToastMessage('Please select a payment method');
    }
}

async function checkWalletConnection() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                window.orderData.walletConnected = true;
                window.orderData.currentAccount = accounts[0];

                ethereum.removeAllListeners('accountsChanged');
                ethereum.removeAllListeners('chainChanged');

                ethereum.on('accountsChanged', handleAccountsChanged);
                ethereum.on('chainChanged', handleChainChanged);

                updateWalletButtons();
            } else {
                window.orderData.walletConnected = false;
                window.orderData.currentAccount = null;
                updateWalletButtons();
            }
        } catch (e) {
            console.error('Error checking wallet connection:', e);
            window.orderData.walletConnected = false;
            updateWalletButtons();
        }
    } else {
        window.orderData.walletConnected = false;
        updateWalletButtons();
    }
}

async function switchNetwork(targetChainId) {
    try {
        if (!window.ethereum) {
            showToastMessage('MetaMask is not installed');
            return false;
        }

        const currentChainId = await ethereum.request({ method: 'eth_chainId' });
        if (currentChainId === targetChainId) return true;

        try {
            await ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: targetChainId }],
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            return true;
        } catch (switchError) {
            if (switchError.code === 4902) {
                const networks = {
                    '0x1': { // Ethereum Mainnet
                        name: 'Ethereum Mainnet',
                        notice: 'Please add the Ethereum network manually in your wallet'
                    },
                    '0x38': { // BSC
                        name: 'Binance Smart Chain',
                        notice: 'Please add the BSC network manually in your wallet'
                    },
                    '0x89': { // Polygon
                        name: 'Polygon Mainnet',
                        notice: 'Please add the Polygon network manually in your wallet'
                    },
                    '0xa86a': { // Avalanche
                        name: 'Avalanche C-Chain',
                        notice: 'Please add the Avalanche network manually in your wallet'
                    },
                    '0xa4b1': { // Arbitrum
                        name: 'Arbitrum One',
                        notice: 'Please add the Arbitrum network manually in your wallet'
                    },
                    '0xa': { // Optimism
                        name: 'Optimism',
                        notice: 'Please add the Optimism network manually in your wallet'
                    }
                };

                if (networks[targetChainId]) {
                    showToastMessage(networks[targetChainId].notice);
                } else {
                    showToastMessage('Please add the required network manually in your wallet');
                }
            } else {
                showToastMessage('Network switch error: ' + switchError.message);
            }
            return false;
        }
    } catch (error) {
        console.error('Network switch error:', error);
        showToastMessage('Network switch error: ' + error.message);
        return false;
    }
}

function initiateBTCPayment() {
    const amount = (window.orderData.total / window.orderData.currencies.btc).toFixed(8);
    const address = document.getElementById('btc-address').textContent;

    showToastMessage(`Copy BTC address or use QR code. Amount: ${amount} BTC`);
    document.getElementById('btc-status').style.display = 'block';
}

async function initiateETHPayment() {
    const initialWalletState = window.orderData.walletConnected;

    try {
        if (!window.orderData.walletConnected) {
            const connected = await connectWallet();
            if (!connected) {
                showToastMessage('Please connect your wallet first');
                return;
            }
        }

        const ethChainId = '0x1';
        const switched = await switchNetwork(ethChainId);
        if (!switched) {
            showToastMessage('Failed to switch to Ethereum network');
            window.orderData.walletConnected = initialWalletState;
            updateWalletButtons();
            return;
        }

        const accounts = await ethereum.request({ method: 'eth_accounts' }).catch(() => []);
        if (accounts.length === 0) {
            showToastMessage('Wallet disconnected. Please reconnect.');
            window.orderData.walletConnected = false;
            window.orderData.currentAccount = null;
            updateWalletButtons();
            return;
        }

        window.orderData.currentAccount = accounts[0];

        const ethRate = window.orderData.currencies.eth || 1;
        const ethAmount = window.orderData.total / ethRate;

        const ethAmountRounded = Number(ethAmount).toFixed(18);

        let ethAmountInWei;
        try {
            ethAmountInWei = web3.utils.toWei(ethAmountRounded, 'ether');
        } catch (e) {
            console.error('Error converting amount:', e);
            showToastMessage('Error calculating ETH amount');
            return;
        }

        const transactionParameters = {
            from: window.orderData.currentAccount,
            to: document.getElementById('eth-address').textContent,
            value: web3.utils.toHex(ethAmountInWei),
            gas: web3.utils.toHex(21000),
            gasPrice: web3.utils.toHex(await web3.eth.getGasPrice())
        };

        showToastMessage(`Transaction confirmation: ${ethAmount.toFixed(6)} ETH (≈$${window.orderData.total.toFixed(2)})`);

        try {
            const txHash = await ethereum.request({
                method: 'eth_sendTransaction',
                params: [transactionParameters],
            });

            document.getElementById('eth-status').style.display = 'block';
            showToastMessage(`Transaction sent. Hash: ${shortenAddress(txHash)}`);
            trackTransaction(txHash, 'eth');
        } catch (txError) {
            console.error('Error sending ETH transaction:', txError);

            if (txError.code === 4001) {
                showToastMessage('Transaction rejected by user');
            } else {
                showToastMessage('Error sending ETH: ' + (txError.message || txError));
            }

            setTimeout(async () => {
                try {
                    const currentAccounts = await ethereum.request({ method: 'eth_accounts' });
                    window.orderData.walletConnected = currentAccounts.length > 0;
                    window.orderData.currentAccount = currentAccounts.length > 0 ? currentAccounts[0] : null;
                } catch (e) {
                    console.error('Error checking accounts after cancellation:', e);
                    window.orderData.walletConnected = initialWalletState;
                }
                updateWalletButtons();
            }, 500);
        }

    } catch (error) {
        console.error('Error initiating ETH payment:', error);
        showToastMessage('Error sending ETH: ' + (error.message || error));

        try {
            const accounts = await ethereum.request({ method: 'eth_accounts' }).catch(() => []);
            window.orderData.walletConnected = accounts.length > 0;
            window.orderData.currentAccount = accounts.length > 0 ? accounts[0] : null;
        } catch (e) {
            console.error('Error checking wallet state:', e);
        }

        updateWalletButtons();
    }
}

async function initiateUSDTPayment() {
    try {
        const initialWalletState = window.orderData.walletConnected;

        if (!window.orderData.walletConnected) {
            const connected = await connectWallet();
            if (!connected) {
                showToastMessage('Please connect your wallet first');
                return;
            }
        }

        const network = document.getElementById('usdt-network').value;
        const toAddress = document.getElementById('usdt-address').textContent;
        const amount = window.orderData.total / window.orderData.currencies.usdt;

        let usdtContractAddress, decimals, chainId;

        switch (network) {
            case 'erc20':
                usdtContractAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
                decimals = 6;
                chainId = '0x1';t
                break;
            case 'trc20':
                showToastMessage('For TRC-20, please use manual transfer via Tron network');
                return;
            case 'bep20':
                usdtContractAddress = '0x55d398326f99059fF775485246999027B3197955';
                decimals = 18;
                chainId = '0x38';
                break;
            case 'polygon':
                usdtContractAddress = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
                decimals = 6;
                chainId = '0x89';
                break;
            case 'avax':
                usdtContractAddress = '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7';
                decimals = 6;
                chainId = '0xa86a';
                break;
            case 'arbitrum':
                usdtContractAddress = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';
                decimals = 6;
                chainId = '0xa4b1';
                break;
            case 'optimism':
                usdtContractAddress = '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58';
                decimals = 6;
                chainId = '0xa';
                break;
            default:
                showToastMessage('Unsupported network selected');
                return;
        }

        const switched = await switchNetwork(chainId);
        if (!switched) {
            showToastMessage(`Failed to switch to required network for ${network}`);
            window.orderData.walletConnected = initialWalletState;
            updateWalletButtons();
            return;
        }

        const accounts = await ethereum.request({ method: 'eth_accounts' }).catch(() => []);
        if (accounts.length === 0) {
            showToastMessage('Wallet disconnected. Please reconnect.');
            window.orderData.walletConnected = false;
            window.orderData.currentAccount = null;
            updateWalletButtons();
            return;
        }

        window.orderData.currentAccount = accounts[0];

        let tokenAmount;
        try {
            if (decimals === 18) {
                tokenAmount = web3.utils.toWei(amount.toString(), 'ether');
            } else {
                const tokenAmountInteger = Math.floor(amount * (10 ** decimals));
                tokenAmount = tokenAmountInteger.toString();
            }
        } catch (e) {
            console.error('Error converting amount:', e);
            showToastMessage('Error calculating USDT amount');
            return;
        }

        const contract = new web3.eth.Contract([{
            "constant": false,
            "inputs": [
                { "name": "_to", "type": "address" },
                { "name": "_value", "type": "uint256" }
            ],
            "name": "transfer",
            "outputs": [{ "name": "", "type": "bool" }],
            "type": "function"
        }], usdtContractAddress);

        const data = contract.methods.transfer(toAddress, tokenAmount).encodeABI();

        const gasLimit = await contract.methods.transfer(toAddress, tokenAmount)
            .estimateGas({ from: window.orderData.currentAccount })
            .catch(() => 100000);

        const transactionParameters = {
            from: window.orderData.currentAccount,
            to: usdtContractAddress,
            value: '0x0',
            data: data,
            gas: web3.utils.toHex(gasLimit),
            gasPrice: web3.utils.toHex(await web3.eth.getGasPrice())
        };

        showToastMessage(`Sending ${amount.toFixed(2)} USDT on ${network}...`);

        try {
            const txHash = await ethereum.request({
                method: 'eth_sendTransaction',
                params: [transactionParameters],
            });

            document.getElementById('usdt-status').innerHTML =
                `Payment sent! Waiting for confirmation... <span class="timer">${Math.floor(window.orderData.timeLeft / 60)}:${window.orderData.timeLeft % 60 < 10 ? '0' + window.orderData.timeLeft % 60 : window.orderData.timeLeft % 60}</span>`;

            showToastMessage(`USDT transaction sent. Hash: ${shortenAddress(txHash)}`);

            trackTransaction(txHash, 'usdt');
        } catch (txError) {
            console.error('Error sending transaction:', txError);

            if (txError.code === 4001) {
                showToastMessage('Transaction rejected by user');
            } else {
                showToastMessage('Error sending USDT: ' + (txError.message || txError));
            }

            setTimeout(async () => {
                try {
                    const currentAccounts = await ethereum.request({ method: 'eth_accounts' });
                    window.orderData.walletConnected = currentAccounts.length > 0;
                    window.orderData.currentAccount = currentAccounts.length > 0 ? currentAccounts[0] : null;
                } catch (e) {
                    console.error('Error checking accounts after cancellation:', e);
                    window.orderData.walletConnected = initialWalletState;
                }
                updateWalletButtons();
            }, 500);
        }

    } catch (error) {
        console.error('Error processing USDT payment:', error);
        showToastMessage('Error sending USDT: ' + (error.message || error));

        try {
            const accounts = await ethereum.request({ method: 'eth_accounts' }).catch(() => []);
            window.orderData.walletConnected = accounts.length > 0;
            window.orderData.currentAccount = accounts.length > 0 ? accounts[0] : null;
        } catch (e) {
            console.error('Error checking wallet status:', e);
        }

        updateWalletButtons();
    }
}

async function trackTransaction(txHash, currency) {
    try {
        const receipt = await web3.eth.getTransactionReceipt(txHash);

        if (!receipt) {
            setTimeout(() => trackTransaction(txHash, currency), 5000);
            return;
        }

        if (receipt.status) {
            showToastMessage(`Transaction ${currency.toUpperCase()} confirmed!`);

            let explorerUrl;
            if (currency === 'btc') {
                explorerUrl = `https://www.blockchain.com/btc/tx/${txHash}`;
            } else if (currency === 'eth') {
                explorerUrl = `https://etherscan.io/tx/${txHash}`;
            } else if (currency === 'usdt') {
                const network = document.getElementById('usdt-network').value;
                switch (network) {
                    case 'eth':
                        explorerUrl = `https://etherscan.io/tx/${txHash}`;
                        break;
                    case 'erc20':
                        explorerUrl = `https://etherscan.io/tx/${txHash}`;
                        break;
                    case 'trc20':
                        explorerUrl = `https://tronscan.org/#/transaction/${txHash}`;
                        break;
                    case 'bep20':
                        explorerUrl = `https://bscscan.com/tx/${txHash}`;
                        break;
                    case 'avax':
                        explorerUrl = `https://snowtrace.io/tx/${txHash}`;
                        break;
                    case 'arbitrum':
                        explorerUrl = `https://arbiscan.io/tx/${txHash}`;
                        break;
                    case 'optimism':
                        explorerUrl = `https://optimistic.etherscan.io/tx/${txHash}`;
                        break;
                    case 'polygon':
                        explorerUrl = `https://polygonscan.com/tx/${txHash}`;
                        break;
                    default:
                        explorerUrl = `https://etherscan.io/tx/${txHash}`;
                        break;
                }
            }

            document.getElementById(`${currency}-status`).innerHTML =
                `Payment confirmed! <a href="${explorerUrl}" target="_blank">View transaction</a>`;

            const prevOrder = JSON.parse(localStorage.getItem('lastOrder')) || {};
            const customer = prevOrder.customer || {};

            localStorage.setItem('lastOrder', JSON.stringify({
                total: window.orderData.total,
                cart: window.orderData.cart,
                customer: customer
            }));

            const user = JSON.parse(localStorage.getItem('user')) || {};
            if (user && user.email) {
                const ordersKey = 'orders_' + user.email;
                const orders = JSON.parse(localStorage.getItem(ordersKey)) || [];
                const newOrder = {
                    id: Date.now(),
                    items: window.orderData.cart,
                    total: window.orderData.total,
                    date: new Date().toISOString(),
                    address: customer.address || user.address || '',
                    status: 'completed'
                };
                orders.push(newOrder);
                localStorage.setItem(ordersKey, JSON.stringify(orders));
            }

            setTimeout(() => {
                window.location.href = 'order-success.html';
            }, 2000);
        } else {
            showToastMessage(`Transaction ${currency.toUpperCase()} failed`);
            document.getElementById(`${currency}-status`).textContent =
                'Transaction error. Please try again.';
        }
    } catch (error) {
        console.error('Error tracking transaction:', error);
        setTimeout(() => trackTransaction(txHash, currency), 5000);
    }
}

function generateQRCode(elementId, data) {
    try {
        const qr = qrcode(0, 'L');
        qr.addData(data);
        qr.make();

        const imgTag = qr.createImgTag(4);
        const styledImg = imgTag.replace('<img', '<img style="width:160px;height:160px;"');

        document.getElementById(elementId).innerHTML = styledImg;
    } catch (e) {
        console.error('QR generation error:', e);
        document.getElementById(elementId).innerHTML = '<p>Error generating QR</p>';
    }
}

function shortenAddress(address) {
    return address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : '';
}

function showToastMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function startPaymentTimer() {
    window.orderData.paymentTimer = setInterval(() => {
        window.orderData.timeLeft--;
        const minutes = Math.floor(window.orderData.timeLeft / 60);
        const seconds = window.orderData.timeLeft % 60;

        document.querySelectorAll('.timer').forEach(timer => {
            timer.textContent = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
        });

        if (window.orderData.timeLeft <= 0) {
            clearInterval(window.orderData.paymentTimer);
            showToastMessage('Payment time has expired. Please start over.');
        }
    }, 1000);
}


function startIncomingPaymentWatcher() {
    const API_KEYS = {
        ETH: '8B5MTGYCBJSWZNI7S1KVPVCFWR9SWDHB9C',
        POLY: 'T4B6ZMQJED3Q2FEKISRD6TT7VMZU9I1HR3',
        BSC: 'SVKR7BQRPRABRGXAWV6IUTDSPMTDP18GXA',
        ARB: 'CVAYCGJ1ZBY1ZK6P66HF9YHN7PBQ8ZJEXM',
        OPT: 'UUWSURZ2A624XMCVHEEYKSZR8XIE22NVY5'
    };

    const INTERVAL = 45000;
    let watcher;

    let initialBalances = {};

    const CONTRACTS = {
        USDT: {
            erc20: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            bep20: '0x55d398326f99059fF775485246999027B3197955',
            trc20: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
            avalanche: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
            arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            optimism: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'
        }
    };

    function getOrderKey() {
        return window.orderData.timestamp || Date.now();
    }

    function isOrderAlreadyPaid() {
        const orderKey = getOrderKey();
        const paidOrders = JSON.parse(localStorage.getItem('paidOrders') || '[]');
        return paidOrders.includes(orderKey);
    }

    function markOrderAsPaid() {
        const orderKey = getOrderKey();
        const paidOrders = JSON.parse(localStorage.getItem('paidOrders') || '[]');
        paidOrders.push(orderKey);
        localStorage.setItem('paidOrders', JSON.stringify(paidOrders));
    }

    async function checkBTC() {
        try {
            const address = document.getElementById('btc-address').textContent;
            const response = await fetch(`https://blockchain.info/q/addressbalance/${address}?confirmations=2`);
            const balance = parseInt(await response.text()) / 1e8;
            const usdValue = balance * window.orderData.currencies.btc;

            if (initialBalances.btc === undefined) {
                initialBalances.btc = usdValue;
                return;
            }

            const increase = usdValue - initialBalances.btc;
            if (increase >= window.orderData.total) {
                handleSuccess('btc', usdValue);
            }
        } catch (e) {
            console.error('BTC Check Error:', e);
        }
    }

    async function checkETH() {
        try {
            const address = document.getElementById('eth-address').textContent;
            const url = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${API_KEYS.ETH}`;
            const response = await fetch(url);
            const { result } = await response.json();
            const balance = result / 1e18;
            const usdValue = balance * window.orderData.currencies.eth;

            if (initialBalances.eth === undefined) {
                initialBalances.eth = usdValue;
                return;
            }

            const increase = usdValue - initialBalances.eth;
            if (increase >= window.orderData.total) {
                handleSuccess('eth', usdValue);
            }
        } catch (e) {
            console.error('ETH Check Error:', e);
        }
    }

    async function checkUSDTNetwork(network, address) {

        try {
            let apiUrl, decimals, apiKey;
            switch (network) {
                case 'erc20':
                    apiUrl = `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${CONTRACTS.USDT.erc20}&address=${address}`;
                    decimals = 6;
                    apiKey = API_KEYS.ETH;
                    break;
                case 'polygon':
                    apiUrl = `https://api.polygonscan.com/api?module=account&action=tokenbalance&contractaddress=${CONTRACTS.USDT.polygon}&address=${address}`;
                    decimals = 6;
                    apiKey = API_KEYS.POLY;
                    break;
                case 'bep20':
                    apiUrl = `https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${CONTRACTS.USDT.bep20}&address=${address}`;
                    decimals = 18;
                    apiKey = API_KEYS.BSC;
                    break;
                case 'avalanche':
                    apiUrl = `https://api.routescan.io/v2/network/avalanche/evm/43114/etherscan/api?module=account&action=tokenbalance&contractaddress=${CONTRACTS.USDT.avalanche}&address=${address}`;
                    decimals = 6;
                    apiKey = null;
                    break;
                case 'arbitrum':
                    apiUrl = `https://api.arbiscan.io/api?module=account&action=tokenbalance&contractaddress=${CONTRACTS.USDT.arbitrum}&address=${address}`;
                    decimals = 6;
                    apiKey = API_KEYS.ARB;
                    break;
                case 'optimism':
                    apiUrl = `https://api-optimistic.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${CONTRACTS.USDT.optimism}&address=${address}`;
                    decimals = 6;
                    apiKey = API_KEYS.OPT;
                    break;
                case 'trc20':
                    return await checkTRC20(address);
                default:
                    return;
            }

            if (apiKey) {
                apiUrl += `&apikey=${apiKey}`;
            }

            const response = await fetch(apiUrl);
            const responseData = await response.json();
            const { status, result } = responseData;

            if (status === "1") {
                const balance = result / Math.pow(10, decimals);
                const usdValue = balance * window.orderData.currencies.usdt;

                const balanceKey = `usdt_${network}`;

                if (initialBalances[balanceKey] === undefined) {
                    initialBalances[balanceKey] = usdValue;
                    return false;
                }

                const increase = usdValue - initialBalances[balanceKey];

                if (increase + 1e-10 >= window.orderData.total) {
                    handleSuccess('usdt', usdValue, network);
                    return true;
                } else {
                }
            } else {
            }
        } catch (e) {
            console.error(`💥 USDT ${network} Check Error:`, e);
        }
        return false;
    }

    async function checkAllUSDTNetworks() {
        const address = document.getElementById('usdt-address').textContent;
        const networks = ['erc20', 'polygon', 'bep20', 'avalanche', 'arbitrum', 'optimism', 'trc20'];

        for (const network of networks) {
            const paymentDetected = await checkUSDTNetwork(network, address);
            if (paymentDetected) {
                return;
            }
        }
    }

    async function checkTRC20(address) {
        try {
            const response = await fetch(`https://apilist.tronscanapi.com/api/account/tokens?address=${address}&start=0&limit=20`);
            const responseData = await response.json();

            if (!responseData || !responseData.data) {
                return false;
            }

            const { data } = responseData;
            const usdt = data.find(t => t.tokenId === CONTRACTS.USDT.trc20);

            if (usdt?.balance) {
                const balance = parseFloat(usdt.balance);
                const usdValue = balance * window.orderData.currencies.usdt;

                if (initialBalances.usdt_trc20 === undefined) {
                    initialBalances.usdt_trc20 = usdValue;
                    return false;
                }

                const increase = usdValue - initialBalances.usdt_trc20;
                if (increase + 1e-10 >= window.orderData.total) {
                    handleSuccess('usdt', usdValue, 'trc20');
                    return true;
                }
            }
            return false;
        } catch (e) {
            console.error('TRC20 Check Error:', e);
            return false;
        }
    }

    async function checkAll() {
        await checkBTC();
        await checkETH();
        await checkAllUSDTNetworks();
    }

    async function initializeAllBalances() {

        await checkBTC();
        await checkETH();
        await checkAllUSDTNetworks();

    }

    function handleSuccess(currency, amount, network = '') {
        clearInterval(watcher);

        markOrderAsPaid();

        const prevOrder = JSON.parse(localStorage.getItem('lastOrder')) || {};
        const customer = prevOrder.customer || {};

        localStorage.setItem('lastOrder', JSON.stringify({
            total: prevOrder.total || window.orderData.total,
            cart: prevOrder.cart || window.orderData.cart,
            customer: customer
        }));

        window.location.href = `order-success.html?currency=${currency}&network=${network}`;
    }

    if (isOrderAlreadyPaid()) {
        return;
    }

    initializeAllBalances().then(() => {
        watcher = setInterval(checkAll, INTERVAL);
    });

    window.forceCheck = checkAll;
}