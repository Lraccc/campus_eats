import React, { useEffect, useState } from "react";
import axios from "../utils/axiosConfig";
import DasherNoShowModal from "./DasherNoShowModal";

const DasherCompletedModal = ({ isOpen, closeModal, shopData, orderData }) => {
    const [checkingConfirmation, setCheckingConfirmation] = useState(false);
    const [pollingInterval, setPollingInterval] = useState(null);
    const [isNoShowModalOpen, setIsNoShowModalOpen] = useState(false);

    useEffect(() => {
        if (pollingInterval) {
            return () => clearInterval(pollingInterval); // Cleanup function
        }
    }, [pollingInterval]);

    if (!isOpen) return null;

    const checkOrderConfirmation = async () => {
        try {
            const response = await axios.get(`/orders/${orderData.id}`);
            const updatedOrder = response.data;

            if (updatedOrder.status === "completed") {
                clearInterval(pollingInterval);  // Stop the interval once confirmed
                setCheckingConfirmation(false);
                proceedWithCompletion();
            }
        } catch (error) {
            console.error("Error checking order status:", error);
        }
    };

    const confirmAccept = async () => {
        try {
            await axios.post('/orders/update-order-status', {
                orderId: orderData.id,
                status: "active_waiting_for_confirmation"
            });

            setCheckingConfirmation(true);
            const intervalId = setInterval(checkOrderConfirmation, 5000);
            setPollingInterval(intervalId);
        } catch (error) {
            console.error("Error confirming order completion:", error);
        }
    };

    const proceedWithCompletion = async () => {
        try {
            const completedOrder = {
                orderId: orderData.id,
                dasherId: orderData.dasherId,
                shopId: orderData.shopId,
                userId: orderData.uid,
                paymentMethod: orderData.paymentMethod,
                deliveryFee: shopData.deliveryFee,
                totalPrice: orderData.totalPrice,
                items: orderData.items
            };

            const response = await axios.post('/payments/confirm-order-completion', completedOrder);
            if (response.status === 200) {
                await axios.put(`/dashers/update/${orderData.dasherId}/status`, null, {
                    params: { status: 'active' }
                });
                closeModal();
                window.location.reload();
            }
        } catch (error) {
            console.error('Error completing the order:', error);
        }
    };

    const handleNoShowClick = () => {
        setIsNoShowModalOpen(true);
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70 z-50">
            <div className="bg-white rounded-none shadow-lg p-6 w-96 relative">
                <button className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-gray-700" onClick={closeModal}>
                    ✖
                </button>
                <h2 className="text-2xl font-bold text-black mb-2">Order Completion</h2>
                <hr className="border-t border-gray-300 my-2" />
                <div className="mb-4">
                    <h4 className="text-lg font-medium text-center">Payment has been completed.</h4>
                    {checkingConfirmation && (
                        <p className="text-gray-500 text-center">Waiting for user confirmation...</p>
                    )}
                </div>
                <div className="flex justify-center mt-4">
                    <button className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition duration-200" onClick={confirmAccept} disabled={checkingConfirmation}>
                        Confirm
                    </button>
                </div>
                <hr className="border-t border-gray-300 my-2" />
                <div className="mt-2 text-xs text-red-500 cursor-pointer underline hover:text-red-700 text-center" onClick={handleNoShowClick}>
                    Customer did not show? Click Here
                </div>
            </div>
            {isNoShowModalOpen && (
                <DasherNoShowModal
                    isOpen={isNoShowModalOpen}
                    closeModal={() => setIsNoShowModalOpen(false)}
                    orderData={orderData}
                    shopData={shopData}
                />
            )}
        </div>
    );
};

export default DasherCompletedModal;
