import "./css/AdminAcceptDasherModal.css"; // Keep this if you have additional styles.

const UserNoShowModal = ({ isOpen, closeModal }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70 z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-96 relative">
                <button className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-gray-700" onClick={closeModal}>
                    ✖
                </button>
                <h2 className="text-2xl font-bold text-red-600 mb-2">Warning: No Show Alert</h2>
                <hr className="border-t border-gray-300 my-2" />
                <div className="mb-4">
                    <h4 className="text-lg font-medium">Your order has been marked as a no-show.</h4>
                    <p className="text-sm text-gray-600 mt-1">Please ensure you are available for future deliveries or contact support for assistance.</p>
                </div>
                <div className="flex justify-end">
                    <button
                        className="bg-yellow-500 text-white px-5 py-2 rounded-lg hover:bg-yellow-600 transition duration-200"
                        onClick={closeModal}
                    >
                        Understood
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserNoShowModal;
