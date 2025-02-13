import React from 'react';

const DeclineOrderModal = ({ isOpen, closeModal, confirmDecline }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70 z-20">
            <div className="bg-white rounded-lg shadow-lg p-6 w-96 relative">
                <button className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-gray-700" onClick={closeModal}>
                    ✖
                </button>
                <h2 className="text-lg font-semibold mb-4">Decline Order</h2>
                <p className="mb-6">Are you sure you want to decline this order?</p>
                <div className="flex justify-end">
                    <button
                        className="bg-gray-300 text-black px-4 py-2 rounded-lg hover:bg-gray-400 transition duration-200 mr-2"
                        onClick={closeModal}
                    >
                        Cancel
                    </button>
                    <button
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-200"
                        onClick={confirmDecline}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeclineOrderModal;
