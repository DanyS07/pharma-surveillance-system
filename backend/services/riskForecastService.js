const axios = require('axios');

async function fetchRiskForecast({ pharmacyIds = [], top = 20, sales = null }) {
    try {
        const response = await axios.post(
            `${process.env.AI_SERVICE_URL}/api/risk/forecast`,
            {
                pharmacyIds,
                top,
                sales,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.AI_API_KEY || '',
                },
                timeout: 30000,
            }
        );

        return response.data;
    } catch (err) {
        console.error('Risk forecasting AI service error:', err.message);
        return {
            success: false,
            summary: {
                totalGroups: 0,
                highRisk: 0,
                mediumRisk: 0,
                criticalRisk: 0,
                lowRisk: 0,
                monitored: 0,
            },
            pharmacyResults: [],
            areaResults: [],
        };
    }
}

module.exports = {
    fetchRiskForecast,
};
