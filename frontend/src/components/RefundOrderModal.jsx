import React, { useState } from "react";
import axios from "../utils/axiosConfig";
import AlertModal from "./AlertModal";

const RefundOrderModal = ({ isOpen, closeModal, orderData }) => {
    const [alertModal, setAlertModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        showConfirmButton: false,
    });

    if (!isOpen) return null;

    const confirmRefund = async () => {
        try {
            const referenceNumber = orderData?.id;

            if (!referenceNumber) {
                setAlertModal({
                    isOpen: true,
                    title: 'Error',
                    message: 'No reference number found for this order.',
                    showConfirmButton: false,
                });
                return;
            }

            const paymentResponse = await axios.get(`/payments/get-payment-by-reference/${referenceNumber}`);
            const paymentId = paymentResponse.data.payment_id;

            if (paymentId) {
                const refundPayload = {
                    paymentId: paymentId,
                    amount: orderData.totalPrice + orderData.deliveryFee,
                    reason: "requested_by_customer",
                    notes: "Refund initiated by admin."
                };

                const refundResponse = await axios.post("/payments/process-refund", refundPayload);

                if (refundResponse.status === 200) {
                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: 'Refund successful!',
                        showConfirmButton: false,
                    });
                    await axios.put(`/shops/update/${orderData.shopId}/wallet`, null, { params: { totalPrice: -(orderData.totalPrice) } });
                    setTimeout(() => {
                        closeModal(); // Close the refund modal after 3 seconds
                    }, 3000);

                    const updateResponse = orderData.dasherId !== null
                        ? await axios.post('/orders/update-order-status', {
                            orderId: orderData.id,
                            status: "active_waiting_for_cancel_confirmation"
                        })
                        : await axios.post('/orders/update-order-status', {
                            orderId: orderData.id,
                            status: "cancelled_by_customer"
                        });

                    if (updateResponse.status === 200) {
                        
                    }
                } else {
                    setAlertModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to process refund. Please try again.',
                        showConfirmButton: false,
                    });
                }
            } else {
                setAlertModal({
                    isOpen: true,
                    title: 'Error',
                    message: 'Payment ID not found.',
                    showConfirmButton: false,
                });
            }
        } catch (error) {
            console.error("Error processing refund:", error);
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: 'Failed to process refund. Please try again.',
                showConfirmButton: false,
            });
        }
    };

    return (
        <>
            <AlertModal
                isOpen={alertModal.isOpen}
                closeModal={() => setAlertModal({ ...alertModal, isOpen: false })}
                title={alertModal.title}
                message={alertModal.message}
                onConfirm={alertModal.onConfirm}
                showConfirmButton={alertModal.showConfirmButton}
            />  
            <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70 z-40">
                <div className="bg-white rounded-lg shadow-lg p-6 w-96 relative">
                    <button 
                        className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-gray-700" 
                        onClick={closeModal}
                    >
                        ✖
                    </button>
                    <h2 className="text-2xl font-bold mb-4">Refund Order</h2>
                    <hr className="border-t border-gray-300 my-2" />
                    <h4 className="text-lg mb-4">Are you sure you want to refund this order?</h4>
                    <div className="flex justify-between">
                        <button 
                            className="bg-gray-300 text-black px-4 py-2 rounded-lg hover:bg-gray-400" 
                            onClick={closeModal}
                        >
                            No
                        </button>
                        <button 
                            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600" 
                            onClick={confirmRefund}
                        >
                            Yes, Refund
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default RefundOrderModal;
