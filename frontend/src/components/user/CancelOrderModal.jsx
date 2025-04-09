import { useState } from "react";

const CancelOrderModal = ({ isOpen, closeModal, shopData, orderData, onCancelConfirmed }) => {
    const[isLoading, setIsLoading] = useState(false);
    if (!isOpen) return null;
    console.log('shopData:', shopData);
    console.log('orderData:', orderData);
    const confirmCancel = async () => {
        setIsLoading(true); 
        try {
           await onCancelConfirmed();
            closeModal();
        } catch (error) {
            console.error('Error updating order status:', error);
        } finally {
            setIsLoading(false);

        }
    };
    
    return (
         <div className="aadm-modal-overlay">
            <div className="aadm-modal-content">
                <button className="aadm-close" onClick={closeModal}>X</button>
                <h2></h2>
                <div className="aadm-input-container">
                    <h4>Are you sure you want to cancel this order?</h4>
                </div>
                    
                <div className="aadm-modal-buttons">
                    <button className="aadm-cancel" onClick={confirmCancel} disabled={isLoading}>
                        {isLoading ? 'Cancelling...' : 'Yes, Cancel'}
                    </button>
                    <button className="aadm-confirm" onClick={closeModal} disabled={isLoading}>
                        No
                    </button>
                </div>
                {orderData.dasherId && (<div className="text-xs text-red-600 font-bold mt-2">Cancelling this order will count as an offense.</div>)}
            </div>
            
        </div>
    );
};
export default CancelOrderModal;