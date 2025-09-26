import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';
import { AUTH_TOKEN_KEY } from './authService';

export interface WalletData {
    wallet: number;
    accountType: string;
    userId: string;
}

/**
 * Service for managing wallet-related operations and data synchronization
 */
export class WalletService {
    private static instance: WalletService;
    private walletChangeListeners: ((walletData: WalletData) => void)[] = [];

    private constructor() {}

    public static getInstance(): WalletService {
        if (!WalletService.instance) {
            WalletService.instance = new WalletService();
        }
        return WalletService.instance;
    }

    /**
     * Subscribe to wallet changes
     */
    public onWalletChange(callback: (walletData: WalletData) => void): () => void {
        this.walletChangeListeners.push(callback);
        
        // Return unsubscribe function
        return () => {
            const index = this.walletChangeListeners.indexOf(callback);
            if (index > -1) {
                this.walletChangeListeners.splice(index, 1);
            }
        };
    }

    /**
     * Notify all listeners about wallet changes
     */
    public notifyWalletChange(walletData: WalletData): void {
        this.walletChangeListeners.forEach(listener => {
            try {
                listener(walletData);
            } catch (error) {
                console.error('Error in wallet change listener:', error);
            }
        });
    }

    /**
     * Fetch the latest wallet data for a user
     */
    public async fetchWalletData(userId: string, accountType: string): Promise<WalletData | null> {
        try {
            const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            if (!token) {
                throw new Error('No authentication token found');
            }

            let wallet = 0;

            if (accountType === 'dasher') {
                const response = await axios.get(`${API_URL}/api/dashers/${userId}`, {
                    headers: { 
                        Authorization: token,
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    },
                    params: { _t: Date.now() } // Cache busting
                });
                wallet = response.data.wallet || 0;
            } else if (accountType === 'shop') {
                const response = await axios.get(`${API_URL}/api/shops/${userId}`, {
                    headers: { 
                        Authorization: token,
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    },
                    params: { _t: Date.now() } // Cache busting
                });
                wallet = response.data.wallet || 0;
            }

            const walletData: WalletData = {
                wallet,
                accountType,
                userId
            };

            // Notify listeners about the wallet change
            this.notifyWalletChange(walletData);

            return walletData;
        } catch (error) {
            console.error('Error fetching wallet data:', error);
            return null;
        }
    }

    /**
     * Update wallet after a transaction and notify listeners
     */
    public async updateWalletAfterTransaction(
        userId: string, 
        accountType: string, 
        transactionType: 'topup' | 'cashout' | 'order'
    ): Promise<WalletData | null> {
        console.log(`Updating wallet after ${transactionType} for ${accountType} ${userId}`);
        
        // Wait a short time for the backend to process the transaction
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return this.fetchWalletData(userId, accountType);
    }

    /**
     * Force refresh wallet data with cache busting
     */
    public async forceRefreshWallet(userId: string, accountType: string): Promise<WalletData | null> {
        console.log(`Force refreshing wallet for ${accountType} ${userId}`);
        return this.fetchWalletData(userId, accountType);
    }
}

// Export singleton instance
export const walletService = WalletService.getInstance();