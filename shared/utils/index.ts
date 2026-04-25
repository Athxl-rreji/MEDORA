export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    // Basic Haversine formula implementation placeholder
    return ((lat1 - lat2)**2 + (lon1 - lon2)**2)**0.5;
};
