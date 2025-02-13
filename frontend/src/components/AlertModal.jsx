import React from 'react';

const AlertModal = ({ isOpen, closeModal, title, message, onConfirm, showConfirmButton }) => {
    if (!isOpen) return null;

    const getTitleColor = () => {
        if (title === 'Success') return 'text-green-600';
        if (title === 'Error') return 'text-red-600';
        return 'text-black';
    };
    const handleOverlayClick = (e) => {
        // Prevent the modal from closing when clicking inside the map
        e.stopPropagation();
      };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70 z-50" onClick={closeModal}>
            <div className="bg-white rounded-none shadow-lg p-6 w-96 relative" onClick={handleOverlayClick}>
                <button className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-gray-700" onClick={closeModal}>
                    ✖
                </button>
                <h2 className={`text-2xl font-bold ${getTitleColor()} mb-4`}>{title}</h2>
                <hr className="border-t border-gray-300 my-2" />
                <div className="mb-6">
                    <h4 className="text-lg font-medium">{message}</h4>
                </div>
                <div className="flex justify-end">
                    {showConfirmButton && (
                        <button
                            className="bg-[#a14447] text-white px-5 py-2 rounded-lg hover:bg-[#823033] transition duration-200"
                            onClick={() => {
                                onConfirm();
                                closeModal();
                            }}
                        >
                            Confirm
                        </button>
                    )}
                    <button
                        className="bg-gray-300 text-black px-5 py-2 rounded-lg hover:bg-gray-400 transition duration-200 ml-2"
                        onClick={closeModal}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AlertModal;
