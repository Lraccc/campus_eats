import React, { useState } from "react";
import axios from "../utils/axiosConfig";
import AlertModal from './AlertModal';

const DasherCancelByDasherModal = ({ isOpen, closeModal, shopData, orderData }) => {
    const [alertModal, setAlertModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        showConfirmButton: true,
    });

    if (!isOpen) return null;

    const confirmCancel = async () => {
        try {
            const removeDasherResponse = await axios.post('/orders/remove-dasher', {
                orderId: orderData.id
            });

            if (removeDasherResponse.status === 200) {
                 await axios.put(`/dashers/update/${orderData.dasherId}/status`, null, {
                    params: { status: 'active' }
                });

                setAlertModal({
                    isOpen: true,
                    title: 'Success',
                    message: 'Dasher has been removed from the order.',
                    showConfirmButton: false,
                });
                setTimeout(() => {
                    setAlertModal({ ...alertModal, isOpen: false });
                    closeModal();
                    window.location.reload();
                }, 3000);
            }
        } catch (error) {
            console.error('Error updating order status:', error);
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: 'There was an error removing the dasher. Please try again.',
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
            <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70 z-20">
                <div className="bg-white rounded-lg shadow-lg p-6 w-96 relative">
                    <button className="absolute top-1 right-2 text-2xl text-gray-500 hover:text-gray-700" onClick={closeModal}>
                        ✖
                    </button>
                    <h4 className="text-lg font-semibold mb-4">Are you sure you want to cancel this order?</h4>
                    <div className="flex justify-end mt-6">
                        <button
                            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-500 transition duration-200 mr-2"
                            onClick={confirmCancel}
                        >
                            Yes, Cancel
                        </button>
                        <button
                            className="bg-gray-300 text-black px-4 py-2 rounded-lg hover:bg-gray-400 transition duration-200"
                            onClick={closeModal}
                        >
                            No
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default DasherCancelByDasherModal;
