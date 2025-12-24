(function() {
    'use strict';
    
    const BLOCKED_COUNTRIES = ['RU', 'BY'];
    const API_TIMEOUT = 5000;
    
    async function getUserCountry() {
        try {
            const apis = [
                'https://ipapi.co/json/',
                'https://ip-api.com/json/',
                'https://ipinfo.io/json'
            ];
            
            for (const apiUrl of apis) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
                    
                    const response = await fetch(apiUrl, {
                        signal: controller.signal,
                        headers: { 'Accept': 'application/json' }
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        const data = await response.json();
                        let countryCode = data.country_code || data.countryCode || data.country;
                        if (countryCode) return countryCode.toUpperCase();
                    }
                } catch (error) {
                    continue;
                }
            }
            throw new Error('All APIs are unavailable');
        } catch (error) {
            return null;
        }
    }
    
    function blockAccess() {
        document.body.innerHTML = `
            <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px; padding: 20px; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; max-width: 600px; margin: 100px auto;">
                <h1 style="color: #dc3545; margin-bottom: 20px;">Access Restricted</h1>
                <p style="color: #6c757d; line-height: 1.6;">Unfortunately, access to this site is restricted for your region.</p>
                <p style="color: #6c757d; line-height: 1.6;">If you believe this is a mistake, please contact the site administrator.</p>
            </div>
        `;
        window.stop && window.stop();
    }
    
    async function checkAccess() {
        try {
            const userCountry = await getUserCountry();
            if (userCountry && BLOCKED_COUNTRIES.includes(userCountry)) {
                blockAccess();
            }
        } catch (error) {
            console.error('Error while checking access:', error);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAccess);
    } else {
        checkAccess();
    }
})();