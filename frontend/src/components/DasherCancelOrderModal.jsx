import React, { useState } from "react";
import axios from "../utils/axiosConfig";
import "./css/AdminAcceptDasherModal.css";
//TODO: will also update dasher status to active
const DasherCancelOrderModal = ({ isOpen, closeModal, shopData, orderData }) => {
    const [isLoading, setIsLoading] = useState(false);
    if (!isOpen) return null;
    console.log('shopData:', shopData);
    console.log('orderData:', orderData);
    const confirmCancel = async () => {
        setIsLoading(true);
        try {
            
            const updateResponse = await axios.post('/orders/update-order-status', {
                orderId: orderData.id,
                status: "cancelled_by_customer"
            });
    
            if (updateResponse.status === 200) {
                 await axios.put(`/dashers/update/${orderData.dasherId}/status`, null, {
                    params: { status: 'active' }
                });
                window.location.reload();
            }
        } catch (error) {
            console.error('Error updating order status:', error);
        }finally{         
            setIsLoading(false);
        }
    };
    
    return (
        <div className="aadm-modal-overlay">
            <div className="aadm-modal-content">
                <button className="aadm-close" onClick={closeModal}>X</button>
                <h2></h2>
                <div className="aadm-input-container">
                    <h4>Customer Requested to cancel order</h4>
                </div>
                <div className="aadm-modal-buttons">
                    <button className="aadm-cancel" onClick={confirmCancel}>
                        {isLoading ? 'Confirming...' : 'Confirm'}
                        </button>                    
                </div>
            </div>
        </div>
    );
};
export default DasherCancelOrderModal;