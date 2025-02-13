import React from "react";
import axios from "../utils/axiosConfig";


const DasherNoShowModal = ({ isOpen, closeModal, orderData, shopData }) => {
    const postOffenses = async () => {
    if (orderData && orderData.dasherId !== null) {
        try {
            const response = await axios.post(`/users/${orderData.uid}/offenses`);
            if (response.status !== 200) {
                throw new Error("Failed to post offenses");
            }
            console.log(response.data);
        } catch (error) {
            console.error("Error posting offenses:", error);
        }
    }
};
    if (!isOpen) return null;

    const confirm = async () => {
        try {
            const updateResponse = await axios.post('/orders/update-order-status', {
                orderId: orderData.id,
                status: "no-show"
            });

            if (updateResponse.status === 200) {
                await postOffenses();
                await axios.put(`/dashers/update/${orderData.dasherId}/status`, null, {
                    params: { status: 'active' }
                });
                window.location.reload();
            }
        } catch (error) {
            console.error('Error updating order status:', error);
        }   
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70 z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-96 relative">
                <button className="absolute top-2 right-3 text-2xl text-gray-500 hover:text-gray-700" onClick={closeModal}>
                    ✖
                </button>
                <h2 className="text-2xl font-bold text-black mb-2 text-center">Marked Order as No Show</h2>
                <hr className="border-t border-gray-300 my-2" />
                <div className="mb-4 text-center">
                    <h4 className="text-lg font-medium">The customer failed to show up for the delivery.</h4>
                </div>
                <div className="flex justify-center space-x-4 mt-4">
                    <button className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition duration-200" onClick={confirm}>
                        Confirm
                    </button>
                    <button className="bg-gray-300 text-black px-4 py-2 rounded-lg hover:bg-gray-400 transition duration-200" onClick={closeModal}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DasherNoShowModal;
